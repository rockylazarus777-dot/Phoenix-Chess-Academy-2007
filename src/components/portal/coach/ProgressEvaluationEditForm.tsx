"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProgressEvaluation } from "@/lib/actions/coach/progress";
import { DevelopmentAreaRatingsEditor, type AreaRatingsValue } from "@/components/portal/coach/DevelopmentAreaRatingsEditor";
import type { DevelopmentArea, ProgressAreaRatingJson } from "@/lib/supabase/types";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const textareaClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function toInitialAreaRatings(rows: ProgressAreaRatingJson[] | null): AreaRatingsValue {
  const initial: AreaRatingsValue = {};
  for (const row of rows ?? []) {
    initial[row.area] = { rating: row.rating, comment: row.comment ?? "" };
  }
  return initial;
}

/**
 * Edit form for an existing DRAFT evaluation — rendered inline on the
 * detail page (`/coach/progress/[evaluationId]`) rather than a separate
 * `/edit` route, per the spec's "choose the cleanest architecture, do not
 * overcomplicate" guidance. `student_id`/`batch_id`/`program_id`/
 * `coach_id`/`created_by`/`status`/`published_at`/`published_by` are never
 * fields on this form — they cannot be changed here, and the parent page
 * only renders this form at all when `coach_can_manage` (returned by
 * `get_coach_progress_evaluation()`) is true. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Edit Architecture".
 */
export function ProgressEvaluationEditForm({
  evaluationId,
  initialPeriodStart,
  initialPeriodEnd,
  initialSummary,
  initialStrengths,
  initialDevelopmentFocus,
  initialCoachRecommendation,
  initialAreaRatings,
}: {
  evaluationId: string;
  initialPeriodStart: string;
  initialPeriodEnd: string;
  initialSummary: string;
  initialStrengths: string;
  initialDevelopmentFocus: string;
  initialCoachRecommendation: string;
  initialAreaRatings: ProgressAreaRatingJson[] | null;
}) {
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);
  const [summary, setSummary] = useState(initialSummary);
  const [strengths, setStrengths] = useState(initialStrengths);
  const [developmentFocus, setDevelopmentFocus] = useState(initialDevelopmentFocus);
  const [coachRecommendation, setCoachRecommendation] = useState(initialCoachRecommendation);
  const [areaRatings, setAreaRatings] = useState<AreaRatingsValue>(() => toInitialAreaRatings(initialAreaRatings));
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

    startTransition(async () => {
      const result = await updateProgressEvaluation({
        evaluationId,
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
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

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
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
