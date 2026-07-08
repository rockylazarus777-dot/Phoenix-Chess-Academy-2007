"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEnrollment } from "@/lib/actions/admin/enrollments";
import { searchStudentsAction, listProgramsForSelectAction, listBatchesForSelectAction } from "@/lib/actions/admin/search";
import { FormField, inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { StudentOption } from "@/lib/queries/admin/students";
import type { ProgramRow } from "@/lib/supabase/types";
import type { BatchOption } from "@/lib/queries/admin/batches";

export function EnrollmentForm() {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [notes, setNotes] = useState("");
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

  function handleStudentSearch(value: string) {
    setStudentQuery(value);
    startTransition(async () => {
      if (value.trim().length === 0) {
        setStudentOptions([]);
        return;
      }
      const result = await searchStudentsAction(value);
      setStudentOptions(result.ok ? result.data : []);
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId) {
      setNotice({ tone: "error", message: "Search for and select a student first." });
      return;
    }
    if (!programId) {
      setNotice({ tone: "error", message: "Choose a program." });
      return;
    }
    startTransition(async () => {
      const result = await createEnrollment({ studentId, programId, batchId: batchId || undefined, notes });
      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }
      router.push("/admin/enrollments");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <FormField label="Student (name or code)" name="studentQuery" required>
        <input id="studentQuery" className={inputClasses} value={studentQuery} onChange={(e) => handleStudentSearch(e.target.value)} required />
      </FormField>
      {studentOptions.length > 0 ? (
        <ul className="rounded-md border border-border">
          {studentOptions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setStudentId(option.id);
                  setStudentQuery(`${option.full_name} (${option.student_code})`);
                  setStudentOptions([]);
                }}
                className={`w-full px-3 py-2 text-left text-body-sm hover:bg-surface-elevated ${studentId === option.id ? "bg-surface-elevated" : ""}`}
              >
                {option.full_name} — {option.student_code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <FormField label="Program" name="programId" required>
        <select id="programId" className={selectClasses} value={programId} onChange={(e) => setProgramId(e.target.value)} required>
          <option value="">Select a program</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Batch (optional)" name="batchId">
        <select id="batchId" className={selectClasses} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">No batch yet</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} ({batch.batch_code})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Notes" name="notes">
        <input id="notes" className={inputClasses} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </FormField>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          Create enrollment
        </Button>
      </div>
    </form>
  );
}
