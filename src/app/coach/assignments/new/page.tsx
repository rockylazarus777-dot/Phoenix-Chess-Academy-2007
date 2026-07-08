import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { listCoachBatches, type CoachBatchListRow } from "@/lib/queries/coach/batches";
import { getCoachBatchRoster } from "@/lib/queries/coach/roster";
import { listCoachBatchSessions } from "@/lib/queries/coach/sessions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentForm } from "@/components/portal/coach/AssignmentForm";

export const metadata = buildMetadata({
  title: "New Assignment",
  description: "Create a chess assignment for one of your assigned batches.",
  path: "/coach/assignments/new",
  index: false,
});

function BatchPicker({ batches }: { batches: CoachBatchListRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">New Assignment</h1>
      <p className="text-body-sm text-muted-foreground">Select the assigned batch this assignment belongs to.</p>
      <ul className="flex flex-col gap-3">
        {batches.map((batch) => (
          <li key={batch.id} className="rounded-lg border border-border p-4">
            <Link href={`/coach/assignments/new?batchId=${batch.id}`} className="text-body font-medium text-primary-text hover:underline">
              {batch.name} ({batch.batchCode})
            </Link>
            <p className="mt-1 text-body-sm text-muted-foreground">{batch.programName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * `/coach/assignments/new` — the same two-step, server-rendered flow as
 * `/coach/progress/new` (Phase 15): without a valid/authorized `?batchId=`,
 * show a plain list of the coach's own assigned batches; once authorized,
 * resolve ONLY that batch's roster and sessions (never academy-wide) and
 * hand them to `AssignmentForm`. An optional `?studentId=` is validated
 * against the roster before being used as a prefill. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "New Assignment Page".
 */
export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string; studentId?: string }>;
}) {
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

  const { batchId, studentId } = await searchParams;

  const batchesResult = await listCoachBatches(identity.coach.id);
  if (!batchesResult.ok) {
    return <CoachPortalState code={batchesResult.code} />;
  }
  if (batchesResult.data.length === 0) {
    return <CoachPortalState code="NO_BATCHES" />;
  }

  const requestedBatchIsAssigned = Boolean(batchId) && batchesResult.data.some((batch) => batch.id === batchId);
  if (!requestedBatchIsAssigned) {
    return <BatchPicker batches={batchesResult.data} />;
  }

  const assigned = await getAssignedBatch(identity.coach.id, batchId as string);
  if (!assigned.ok) {
    if (assigned.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    return <BatchPicker batches={batchesResult.data} />;
  }

  const [rosterResult, sessionsResult] = await Promise.all([
    getCoachBatchRoster(assigned.batch.id),
    listCoachBatchSessions(assigned.batch.id),
  ]);

  if (!rosterResult.ok) {
    return <CoachPortalState code={rosterResult.code} />;
  }
  if (!sessionsResult.ok) {
    return <CoachPortalState code={sessionsResult.code} />;
  }

  const initialStudentId = rosterResult.data.some((student) => student.student_id === studentId) ? (studentId as string) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">New Assignment</h1>
      <AssignmentForm
        batch={{
          id: assigned.batch.id,
          name: assigned.batch.name,
          batchCode: assigned.batch.batchCode,
          programId: assigned.batch.programId,
          programName: assigned.batch.programName,
        }}
        roster={rosterResult.data}
        sessions={sessionsResult.data}
        initialStudentId={initialStudentId}
      />
    </div>
  );
}
