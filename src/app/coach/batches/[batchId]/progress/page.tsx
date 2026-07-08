import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { listCoachBatchProgress } from "@/lib/queries/coach/progress";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ProgressEvaluationStatusBadge } from "@/components/portal/ProgressEvaluationStatusBadge";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";

export const metadata = buildMetadata({
  title: "Batch Student Progress",
  description: "Student development progress evaluations for a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * `/coach/batches/[batchId]/progress` — contextual evaluation list for one
 * assigned batch, reusing `getAssignedBatch()` for authorization exactly
 * like the Students/Class Schedule/Class Sessions tabs. Shows every
 * evaluation for the batch under the documented continuity decision (any
 * coach currently assigned may read the batch's evaluations, including
 * another coach's) — author display name only, never coach contact
 * details. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Batch
 * Progress Page".
 */
export default async function CoachBatchProgressPage({ params }: { params: Promise<{ batchId: string }> }) {
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

  const { batchId } = await params;
  const assigned = await getAssignedBatch(identity.coach.id, batchId);

  if (!assigned.ok) {
    if (assigned.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const batch = assigned.batch;
  const result = await listCoachBatchProgress(batch.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{batch.name} — Student Progress</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">{batch.batchCode}</p>
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      <div>
        <Link
          href={`/coach/progress/new?batchId=${batch.id}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Evaluation
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_PROGRESS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((row) => (
            <li key={row.evaluation_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/coach/progress/${row.evaluation_id}`} className="text-body font-medium text-primary-text hover:underline">
                  {row.student_full_name} ({row.student_code})
                </Link>
                <ProgressEvaluationStatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {row.program_name ?? "—"} · {row.evaluation_period_start} – {row.evaluation_period_end} · by {row.author_name}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
