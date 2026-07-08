import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { listCoachBatches, type CoachBatchListRow } from "@/lib/queries/coach/batches";
import { getCoachBatchRoster } from "@/lib/queries/coach/roster";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ProgressEvaluationForm } from "@/components/portal/coach/ProgressEvaluationForm";

export const metadata = buildMetadata({
  title: "New Progress Evaluation",
  description: "Create a student development progress evaluation for one of your assigned batches.",
  path: "/coach/progress/new",
  index: false,
});

function BatchPicker({ batches }: { batches: CoachBatchListRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">New Progress Evaluation</h1>
      <p className="text-body-sm text-muted-foreground">Select the assigned batch this evaluation belongs to.</p>
      <ul className="flex flex-col gap-3">
        {batches.map((batch) => (
          <li key={batch.id} className="rounded-lg border border-border p-4">
            <Link href={`/coach/progress/new?batchId=${batch.id}`} className="text-body font-medium text-primary-text hover:underline">
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
 * `/coach/progress/new` — a two-step, server-rendered flow rather than a
 * client-side batch/roster switcher: without a valid (or authorized)
 * `?batchId=` the page shows a plain list of the coach's own assigned
 * batches (from `listCoachBatches()`) — an unrecognized/unauthorized
 * `batchId` falls back to this same picker rather than a dead end, since
 * it exposes nothing about batches the coach doesn't already have. Once a
 * `batchId` is supplied and re-authorized server-side via
 * `getAssignedBatch()`, the page resolves ONLY that batch's roster
 * (`getCoachBatchRoster()`) and hands it — narrow, batch-scoped, never
 * academy-wide — to `ProgressEvaluationForm`. This avoids ever sending a
 * multi-batch roster payload to the client. An optional `?studentId=` is
 * validated against that same roster before being used as a prefill. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "New Evaluation Page".
 */
export default async function NewProgressEvaluationPage({
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

  const rosterResult = await getCoachBatchRoster(assigned.batch.id);
  if (!rosterResult.ok) {
    return <CoachPortalState code={rosterResult.code} />;
  }
  if (rosterResult.data.length === 0) {
    return <CoachPortalState code="NO_STUDENTS" />;
  }

  const initialStudentId = rosterResult.data.some((student) => student.student_id === studentId) ? (studentId as string) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">New Progress Evaluation</h1>
      <ProgressEvaluationForm
        batch={{
          id: assigned.batch.id,
          name: assigned.batch.name,
          batchCode: assigned.batch.batchCode,
          programId: assigned.batch.programId,
          programName: assigned.batch.programName,
        }}
        roster={rosterResult.data}
        initialStudentId={initialStudentId}
      />
    </div>
  );
}
