import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { listCoachProgressEvaluations } from "@/lib/queries/coach/progress";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ProgressEvaluationStatusBadge } from "@/components/portal/ProgressEvaluationStatusBadge";
import type { ProgressEvaluationStatus } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Student Progress",
  description: "Student development progress evaluations for batches assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/progress",
  index: false,
});

const SECTIONS: { status: ProgressEvaluationStatus; heading: string }[] = [
  { status: "DRAFT", heading: "Draft Evaluations" },
  { status: "PUBLISHED", heading: "Published Evaluations" },
  { status: "ARCHIVED", heading: "Archived Evaluations" },
];

/**
 * "Student Progress" — every evaluation visible under the coach historical
 * read rule (evaluation.coach_id = current coach OR coach currently
 * manages evaluation.batch_id), grouped by real `status` (status-based
 * headings, matching the Coach Session List precedent). No fabricated
 * overall/percentage score is ever shown — only the individually stored
 * fields. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Progress
 * List".
 */
export default async function CoachProgressPage() {
  const identity = await getCurrentCoach();

  if (identity.status !== "OK") {
    return (
      <CoachPortalState
        code={identity.status === "NOT_LINKED" ? "COACH_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <CoachPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await listCoachProgressEvaluations();
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h4 text-foreground">Student Progress</h1>
        <Link
          href="/coach/progress/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Evaluation
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_PROGRESS" />
      ) : (
        <div className="flex flex-col gap-8">
          {SECTIONS.map(({ status, heading }) => {
            const evaluations = result.data.filter((row) => row.status === status);
            if (evaluations.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{heading}</h2>
                <ul className="flex flex-col gap-3">
                  {evaluations.map((row) => (
                    <li key={row.evaluation_id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/coach/progress/${row.evaluation_id}`} className="text-body font-medium text-primary-text hover:underline">
                          {row.student_full_name} ({row.student_code})
                        </Link>
                        <ProgressEvaluationStatusBadge status={row.status} />
                      </div>
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        {row.batch_name} · {row.program_name ?? "—"} · {row.evaluation_period_start} – {row.evaluation_period_end}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
