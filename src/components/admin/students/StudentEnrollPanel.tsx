"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEnrollment } from "@/lib/actions/admin/enrollments";
import { listProgramsForSelectAction, listBatchesForSelectAction } from "@/lib/actions/admin/search";
import { selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { ProgramRow } from "@/lib/supabase/types";
import type { BatchOption } from "@/lib/queries/admin/batches";

interface EnrollmentDisplayRow {
  id: string;
  program_name: string;
  batch_name: string | null;
  status: string;
  enrolled_on: string;
}

export function StudentEnrollPanel({ studentId, enrollments }: { studentId: string; enrollments: EnrollmentDisplayRow[] }) {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const [programResult, batchResult] = await Promise.all([listProgramsForSelectAction(), listBatchesForSelectAction()]);
      if (programResult.ok) setPrograms(programResult.data);
      if (batchResult.ok) setBatches(batchResult.data);
    });
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!programId) {
      setNotice({ tone: "error", message: "Choose a program." });
      return;
    }
    startTransition(async () => {
      const result = await createEnrollment({ studentId, programId, batchId: batchId || undefined, notes: "" });
      setNotice(result.success ? { tone: "success", message: "Enrollment created." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Program enrollments</h2>

      {enrollments.length === 0 ? (
        <p className="mt-2 text-body-sm text-muted-foreground">No enrollments yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {enrollments.map((row) => (
            <li key={row.id} className="rounded-md border border-border p-3 text-body-sm">
              <p className="text-foreground">
                {row.program_name}
                {row.batch_name ? ` · ${row.batch_name}` : ""}
              </p>
              <p className="text-muted-foreground">
                {row.status} · enrolled {row.enrolled_on}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="enroll-program" className="text-body-sm font-medium text-foreground">
            Program
          </label>
          <select id="enroll-program" className={selectClasses} value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">Select a program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="enroll-batch" className="text-body-sm font-medium text-foreground">
            Batch (optional)
          </label>
          <select id="enroll-batch" className={selectClasses} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">No batch yet</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.batch_code})
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline" isLoading={pending} disabled={pending}>
          Enroll
        </Button>
      </form>
    </div>
  );
}
