"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgressEvaluation } from "@/lib/actions/coach/progress";
import { DevelopmentAreaRatingsEditor, type AreaRatingsValue } from "@/components/portal/coach/DevelopmentAreaRatingsEditor";
import type { CoachRosterStudentRow, DevelopmentArea } from "@/lib/supabase/types";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const selectClasses = inputClasses;
const textareaClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export interface ProgressEvaluationBatchContext {
  id: string;
  name: string;
  batchCode: string;
  programId: string | null;
  programName: string;
}

/**
 * New-evaluation form for one already-authorized assigned batch. The
 * batch and program are fixed display context (never editable here) — the
 * coach only selects a student from `roster`, which the Server Component
 * parent already resolved via `getCoachBatchRoster(batchId)` (itself
 * `coach_has_batch`-scoped), never an academy-wide student list. Submitting
 * a `studentId` outside this roster is still rejected server-side by
 * `createProgressEvaluation()` re-authorizing through
 * `getAuthorizedBatchStudent()` — this select is a UX convenience, never
 * the security boundary. No `coachId`/`createdBy` field exists anywhere in
 * this form; the server always derives both. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "New Evaluation Page" and "Coach
 * Student Roster For Evaluation".
 */
export function ProgressEvaluationForm({
  batch,
  roster,
  initialStudentId,
}: {
  batch: ProgressEvaluationBatchContext;
  roster: CoachRosterStudentRow[];
  initialStudentId: string;
}) {
  const [studentId, setStudentId] = useState(initialStudentId);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [summary, setSummary] = useState("");
  const [strengths, setStrengths] = useState("");
  const [developmentFocus, setDevelopmentFocus] = useState("");
  const [coachRecommendation, setCoachRecommendation] = useState("");
  const [areaRatings, setAreaRatings] = useState<AreaRatingsValue>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const entries = (Object.entries(areaRatings) as [DevelopmentArea, { rating: number; comment: string }][])
      .filter(([, entry]) => entry.rating > 0)
      .map(([area, entry]) => ({ area, rating: entry.rating, comment: entry.comment }));

    if (entries.length === 0) {
      setError("Rate at least one development area.");
      return;
    }
    if (!studentId) {
      setError("Select a student.");
      return;
    }
    if (!batch.programId) {
      setError("This batch has no program context configured.");
      return;
    }

    startTransition(async () => {
      const result = await createProgressEvaluation({
        studentId,
        batchId: batch.id,
        programId: batch.programId as string,
        periodStart,
        periodEnd,
        summary,
        strengths,
        developmentFocus,
        coachRecommendation,
        areaRatings: entries,
      });
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.push(`/coach/progress/${result.data?.id ?? ""}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-surface p-3 text-body-sm text-muted-foreground">
        Batch: <span className="font-medium text-foreground">{batch.name}</span> ({batch.batchCode}) · Program:{" "}
        <span className="font-medium text-foreground">{batch.programName}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="studentId" className="text-body-sm font-medium text-foreground">
          Student <span className="text-danger">*</span>
        </label>
        <select id="studentId" className={selectClasses} value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          <option value="">Select a student</option>
          {roster.map((student) => (
            <option key={student.student_id} value={student.student_id}>
              {student.full_name} ({student.student_code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodStart" className="text-body-sm font-medium text-foreground">
            Evaluation Period Start <span className="text-danger">*</span>
          </label>
          <input
            id="periodStart"
            type="date"
            className={inputClasses}
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="periodEnd" className="text-body-sm font-medium text-foreground">
            Evaluation Period End <span className="text-danger">*</span>
          </label>
          <input id="periodEnd" type="date" className={inputClasses} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="summary" className="text-body-sm font-medium text-foreground">
          Overall Summary
        </label>
        <textarea id="summary" className={`${textareaClasses} min-h-24`} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="strengths" className="text-body-sm font-medium text-foreground">
          Strengths
        </label>
        <textarea
          id="strengths"
          className={`${textareaClasses} min-h-20`}
          maxLength={1500}
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="developmentFocus" className="text-body-sm font-medium text-foreground">
          Development Focus
        </label>
        <textarea
          id="developmentFocus"
          className={`${textareaClasses} min-h-20`}
          maxLength={1500}
          value={developmentFocus}
          onChange={(e) => setDevelopmentFocus(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coachRecommendation" className="text-body-sm font-medium text-foreground">
          Coach Recommendation
        </label>
        <textarea
          id="coachRecommendation"
          className={`${textareaClasses} min-h-20`}
          maxLength={1500}
          value={coachRecommendation}
          onChange={(e) => setCoachRecommendation(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body-sm font-medium text-foreground">
          Development Area Ratings <span className="text-danger">*</span>
        </p>
        <DevelopmentAreaRatingsEditor value={areaRatings} onChange={setAreaRatings} />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Draft Evaluation"}
        </button>
      </div>
    </form>
  );
}
