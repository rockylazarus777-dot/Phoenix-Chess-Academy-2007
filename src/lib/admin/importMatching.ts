import "server-only";
import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ImportStudentRow } from "@/lib/validation/admin/import";

/**
 * Duplicate-matching hierarchy for bulk student import (see
 * docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Import Duplicate Strategy"):
 *
 *   1. student_code (if supplied and it matches an existing record)
 *   2. FIDE ID (if supplied and it matches an existing record)
 *   3. normalized email + date of birth
 *   4. normalized phone + date of birth
 *   5. anything else -> not flagged as a duplicate; left for manual
 *      review by the admin reading the preview (we never merge by name
 *      alone, and we never guess).
 *
 * This runs a small, fixed number of batched `.in()` queries against
 * the candidate values collected from the whole file, rather than one
 * query per row — the row count is bounded by MAX_IMPORT_ROWS, so this
 * stays well clear of the "fetch everything into the browser" anti-
 * pattern the rest of Phase 10 avoids; these lookups happen entirely
 * server-side and only touch the handful of values actually present in
 * the uploaded file.
 */

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  return hasPlus ? `+${digits}` : digits;
}

interface ExistingStudentRow {
  id: string;
  student_code: string;
  fide_id: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
}

export interface DuplicateMatch {
  studentId: string;
  reason: string;
}

export async function findDuplicateMatches(
  rows: ImportStudentRow[],
): Promise<Map<number, DuplicateMatch>> {
  const supabase = getAdminSupabaseClient();

  const studentCodes = [...new Set(rows.map((r) => r.student_code?.trim()).filter((v): v is string => !!v))];
  const fideIds = [...new Set(rows.map((r) => r.fide_id?.trim()).filter((v): v is string => !!v))];
  const emails = [...new Set(rows.map((r) => normalizeEmail(r.email ?? "")).filter((v): v is string => !!v))];
  const phones = [...new Set(rows.map((r) => normalizePhone(r.phone ?? "")).filter((v): v is string => !!v))];

  const candidates: ExistingStudentRow[] = [];

  if (studentCodes.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, student_code, fide_id, email, phone, date_of_birth")
      .in("student_code", studentCodes as never);
    if (data) candidates.push(...(data as unknown as ExistingStudentRow[]));
  }
  if (fideIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, student_code, fide_id, email, phone, date_of_birth")
      .in("fide_id", fideIds as never);
    if (data) candidates.push(...(data as unknown as ExistingStudentRow[]));
  }
  if (emails.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, student_code, fide_id, email, phone, date_of_birth")
      .in("email", emails as never);
    if (data) candidates.push(...(data as unknown as ExistingStudentRow[]));
  }
  if (phones.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, student_code, fide_id, email, phone, date_of_birth")
      .in("phone", phones as never);
    if (data) candidates.push(...(data as unknown as ExistingStudentRow[]));
  }

  const byCode = new Map(candidates.filter((c) => c.student_code).map((c) => [c.student_code, c]));
  const byFide = new Map(candidates.filter((c) => c.fide_id).map((c) => [c.fide_id as string, c]));
  const byEmailDob = new Map(
    candidates
      .filter((c) => c.email && c.date_of_birth)
      .map((c) => [`${normalizeEmail(c.email as string)}|${c.date_of_birth}`, c]),
  );
  const byPhoneDob = new Map(
    candidates
      .filter((c) => c.phone && c.date_of_birth)
      .map((c) => [`${normalizePhone(c.phone as string)}|${c.date_of_birth}`, c]),
  );

  const matches = new Map<number, DuplicateMatch>();

  rows.forEach((row, index) => {
    const code = row.student_code?.trim();
    if (code && byCode.has(code)) {
      matches.set(index, { studentId: byCode.get(code)!.id, reason: `Matches existing student code ${code}.` });
      return;
    }

    const fide = row.fide_id?.trim();
    if (fide && byFide.has(fide)) {
      matches.set(index, { studentId: byFide.get(fide)!.id, reason: `Matches existing FIDE ID ${fide}.` });
      return;
    }

    const email = normalizeEmail(row.email ?? "");
    const dob = row.date_of_birth?.trim();
    if (email && dob) {
      const key = `${email}|${dob}`;
      if (byEmailDob.has(key)) {
        matches.set(index, {
          studentId: byEmailDob.get(key)!.id,
          reason: "Matches existing record by email + date of birth.",
        });
        return;
      }
    }

    const phone = normalizePhone(row.phone ?? "");
    if (phone && dob) {
      const key = `${phone}|${dob}`;
      if (byPhoneDob.has(key)) {
        matches.set(index, {
          studentId: byPhoneDob.get(key)!.id,
          reason: "Matches existing record by phone + date of birth.",
        });
      }
    }
  });

  return matches;
}
