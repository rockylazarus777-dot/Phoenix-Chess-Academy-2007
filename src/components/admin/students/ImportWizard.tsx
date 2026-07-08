"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewStudentImport, confirmStudentImport } from "@/lib/actions/admin/import";
import type { ImportPreview } from "@/lib/validation/admin/import";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

/**
 * Two-step, explicit-confirmation import UI. Selecting a file only ever
 * runs the preview (parse + validate + duplicate-check) — nothing is
 * inserted until the admin reviews the preview and clicks "Confirm
 * import" as a separate action. See
 * docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Bulk Import Architecture".
 */
export function ImportWizard() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [result, setResult] = useState<{ insertedCount: number; skippedCount: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handlePreview(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setResult(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setNotice({ tone: "error", message: "Choose a CSV file first." });
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const response = await previewStudentImport(formData);
      if (!response.success || !response.data) {
        setNotice({ tone: "error", message: response.message ?? "Something went wrong." });
        setPreview(null);
        return;
      }
      setPreview(response.data);
    });
  }

  function handleConfirm() {
    if (!preview) return;
    const validRows = preview.rows.filter((r) => r.status === "VALID" && r.data).map((r) => r.data!);
    if (validRows.length === 0) {
      setNotice({ tone: "error", message: "No valid rows to import." });
      return;
    }
    startTransition(async () => {
      const response = await confirmStudentImport(validRows);
      if (!response.success) {
        setNotice({ tone: "error", message: response.message ?? "Something went wrong." });
        return;
      }
      setResult(response.data ?? null);
      setNotice({ tone: "success", message: "Import completed." });
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={handlePreview} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-file" className="text-body-sm font-medium text-foreground">
            CSV file
          </label>
          <input id="import-file" ref={fileInputRef} type="file" accept=".csv,text/csv" className="text-body-sm text-foreground" />
          <p className="text-xs text-muted-foreground">
            Required columns: full_name, date_of_birth, country. Optional: gender, email, phone, whatsapp, state, city, address,
            fide_id, fide_rating, chess_association_id, current_level, joined_on, notes, student_code. Max 500 rows, 2 MB.
          </p>
        </div>
        <div>
          <Button type="submit" variant="outline" size="sm" isLoading={pending} disabled={pending}>
            Preview import
          </Button>
        </div>
      </form>

      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      {result ? (
        <p className="text-body-sm text-foreground">
          Imported {result.insertedCount} student(s). Skipped {result.skippedCount} as likely duplicates.
        </p>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-foreground">
            {preview.totalRows} row(s): {preview.validCount} valid, {preview.duplicateCount} likely duplicates, {preview.invalidCount} invalid.
          </p>

          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-body-sm">
              <thead className="sticky top-0 border-b border-border bg-surface">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Row</th>
                  <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                    <td className="px-3 py-2 text-foreground">{row.data?.full_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.status === "VALID" ? (
                        <span className="text-success">Valid</span>
                      ) : row.status === "DUPLICATE" ? (
                        <span className="text-warning">Duplicate</span>
                      ) : (
                        <span className="text-danger">Invalid</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.status === "DUPLICATE" ? row.duplicateReason : row.status === "INVALID" ? row.errors?.join("; ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Button type="button" isLoading={pending} disabled={pending || preview.validCount === 0} onClick={handleConfirm}>
              Confirm import ({preview.validCount} row(s))
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
