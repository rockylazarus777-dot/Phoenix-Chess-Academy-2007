"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import { parseCsv } from "@/lib/admin/csv";
import { findDuplicateMatches } from "@/lib/admin/importMatching";
import {
  IMPORT_ALLOWED_HEADERS,
  IMPORT_REQUIRED_HEADERS,
  IMPORT_INSERT_CHUNK_SIZE,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_IMPORT_ROWS,
  importStudentRowSchema,
  type ImportPreview,
  type ImportRowResult,
  type ImportStudentRow,
} from "@/lib/validation/admin/import";

/**
 * Step 1 of the import flow: upload -> parse -> validate -> preview.
 * NEVER inserts anything. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Bulk Import Architecture" for the full four-step flow this and
 * confirmStudentImport() together implement.
 */
export async function previewStudentImport(formData: FormData): Promise<AdminActionResult<ImportPreview>> {
  await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, message: "Choose a CSV file to upload." };
  }
  if (!/\.csv$/i.test(file.name) || (file.type && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel")) {
    return { success: false, message: getSafeAdminMessage("IMPORT_VALIDATION_FAILED") + " Only .csv files are accepted." };
  }
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return {
      success: false,
      message: `File is too large. The maximum size is ${Math.floor(MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { success: false, message: getSafeAdminMessage("IMPORT_VALIDATION_FAILED") };
  }

  const parsed = parseCsv(text, MAX_IMPORT_ROWS);
  if (!parsed.ok) {
    return { success: false, message: parsed.error };
  }

  const { headers, rows } = parsed.data;

  const unknownHeaders = headers.filter((h) => !(IMPORT_ALLOWED_HEADERS as readonly string[]).includes(h));
  if (unknownHeaders.length > 0) {
    return {
      success: false,
      message: `Unrecognized column(s): ${unknownHeaders.join(", ")}. Use the provided template headers only.`,
    };
  }
  const missingRequired = IMPORT_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingRequired.length > 0) {
    return { success: false, message: `Missing required column(s): ${missingRequired.join(", ")}.` };
  }

  const parsedRows: ImportStudentRow[] = [];
  const results: ImportRowResult[] = [];

  rows.forEach((values, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const record: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      record[h] = values[colIdx] ?? "";
    });

    const validated = importStudentRowSchema.safeParse(record);
    if (!validated.success) {
      results.push({
        rowNumber,
        status: "INVALID",
        errors: validated.error.issues.map((issue) => `${String(issue.path[0] ?? "")}: ${issue.message}`),
      });
      parsedRows.push(record as unknown as ImportStudentRow); // placeholder to keep index alignment
      return;
    }
    results.push({ rowNumber, status: "VALID", data: validated.data });
    parsedRows.push(validated.data);
  });

  try {
    const validIndexes = results
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.status === "VALID")
      .map(({ idx }) => idx);

    if (validIndexes.length > 0) {
      const rowsToCheck = validIndexes.map((idx) => parsedRows[idx]);
      const duplicateMap = await findDuplicateMatches(rowsToCheck);

      duplicateMap.forEach((match, localIdx) => {
        const globalIdx = validIndexes[localIdx];
        results[globalIdx] = {
          ...results[globalIdx],
          status: "DUPLICATE",
          duplicateReason: match.reason,
          duplicateOfStudentId: match.studentId,
        };
      });
    }
  } catch {
    logAdminEvent({ area: "import", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const preview: ImportPreview = {
    totalRows: results.length,
    validCount: results.filter((r) => r.status === "VALID").length,
    invalidCount: results.filter((r) => r.status === "INVALID").length,
    duplicateCount: results.filter((r) => r.status === "DUPLICATE").length,
    rows: results,
  };

  return { success: true, data: preview };
}

/**
 * Step 2: explicit, separate confirmation. Only rows the admin has
 * reviewed and that are still VALID are inserted — never on file
 * selection, never automatically. Business records only: no accounts
 * are created and no invitations are sent as a side effect of import
 * (see src/lib/actions/admin/accounts.ts for that, a deliberately
 * separate, later action).
 *
 * Server-side re-validates and re-checks duplicates rather than
 * trusting the client's copy of the preview, since the preview result
 * traveled through the browser and time may have passed.
 */
export async function confirmStudentImport(
  rows: ImportStudentRow[],
): Promise<AdminActionResult<{ insertedCount: number; skippedCount: number }>> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
  if (rows.length === 0) {
    return { success: false, message: "No rows to import." };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { success: false, message: `Cannot import more than ${MAX_IMPORT_ROWS} rows at once.` };
  }

  const revalidated = rows.map((row) => importStudentRowSchema.safeParse(row));
  if (revalidated.some((r) => !r.success)) {
    return { success: false, message: getSafeAdminMessage("IMPORT_VALIDATION_FAILED") };
  }
  const validRows = revalidated.map((r) => (r as { success: true; data: ImportStudentRow }).data);

  try {
    const duplicateMap = await findDuplicateMatches(validRows);
    const toInsert = validRows.filter((_, idx) => !duplicateMap.has(idx));
    const skippedCount = validRows.length - toInsert.length;

    const supabase = getAdminSupabaseClient();
    let insertedCount = 0;

    for (let i = 0; i < toInsert.length; i += IMPORT_INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + IMPORT_INSERT_CHUNK_SIZE).map((row) => ({
        full_name: row.full_name,
        date_of_birth: row.date_of_birth,
        gender: row.gender || null,
        email: row.email || null,
        phone: row.phone || null,
        whatsapp: row.whatsapp || null,
        country: row.country,
        state: row.state || null,
        city: row.city || null,
        address: row.address || null,
        fide_id: row.fide_id || null,
        fide_rating: row.fide_rating ? Number.parseInt(row.fide_rating, 10) : null,
        chess_association_id: row.chess_association_id || null,
        current_level: row.current_level || null,
        joined_on: row.joined_on || null,
        notes: row.notes || null,
        // student_code is intentionally omitted — DB-generated via
        // generate_student_code(); a supplied student_code in the CSV
        // is used only for duplicate detection, never as the new code.
      }));

      const { error } = await supabase.from("students").insert(chunk as never);
      if (error) {
        logAdminEvent({ area: "import", code: "UNKNOWN" });
        // Stop on first chunk failure rather than silently skipping —
        // report exactly how many rows made it in before the failure.
        await recordAdminAudit({
          actor: profile,
          action: "BULK_IMPORT_COMPLETED",
          entityType: "import",
          entityId: null,
          summary: `Bulk student import stopped after a chunk error. ${insertedCount} of ${toInsert.length} rows inserted.`,
          metadata: { inserted: insertedCount, attempted: toInsert.length, skipped_duplicates: skippedCount },
        });
        revalidatePath("/admin/students");
        return {
          success: false,
          message: `${insertedCount} of ${toInsert.length} rows were imported before an error occurred. No partial row was corrupted — re-review the remaining rows and try again.`,
        };
      }
      insertedCount += chunk.length;
    }

    await recordAdminAudit({
      actor: profile,
      action: "BULK_IMPORT_COMPLETED",
      entityType: "import",
      entityId: null,
      summary: `Bulk student import completed: ${insertedCount} inserted, ${skippedCount} skipped as duplicates.`,
      metadata: { inserted: insertedCount, skipped_duplicates: skippedCount },
    });

    revalidatePath("/admin/students");
    return { success: true, data: { insertedCount, skippedCount } };
  } catch {
    logAdminEvent({ area: "import", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
