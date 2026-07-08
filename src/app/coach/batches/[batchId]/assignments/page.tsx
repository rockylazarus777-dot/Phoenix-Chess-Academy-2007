import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { listCoachBatchAssignments } from "@/lib/queries/coach/assignments";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";
import { formatAssignmentDueDate } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Batch Assignments",
  description: "Assignments for a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * `/coach/batches/[batchId]/assignments` — contextual assignment list for
 * one assigned batch, reusing `getAssignedBatch()` for authorization
 * exactly like the Students/Class Schedule/Class Sessions/Student Progress
 * tabs. Shows every assignment for the batch under the documented
 * continuity decision — author display name only, never coach contact
 * details. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Batch Assignments
 * Page".
 */
export default async function CoachBatchAssignmentsPage({ params }: { params: Promise<{ batchId: string }> }) {
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
  const result = await listCoachBatchAssignments(batch.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{batch.name} — Assignments</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">{batch.batchCode}</p>
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      <div>
        <Link
          href={`/coach/assignments/new?batchId=${batch.id}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Assignment
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_ASSIGNMENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((row) => (
            <li key={row.assignment_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/coach/assignments/${row.assignment_id}`} className="text-body font-medium text-primary-text hover:underline">
                  {row.title}
                </Link>
                <AssignmentStatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {row.audience_type === "STUDENT" && row.student_full_name
                  ? `${row.student_full_name} (${row.student_code})`
                  : "Whole batch"}{" "}
                · {row.program_name ?? "—"} · by {row.author_name}
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">Due: {formatAssignmentDueDate(row.due_at)}</p>
              {row.status !== "DRAFT" ? (
                <p className="mt-1 text-body-sm text-muted-foreground">
                  {row.submission_count} submitted · {row.recipient_count} recipients
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
