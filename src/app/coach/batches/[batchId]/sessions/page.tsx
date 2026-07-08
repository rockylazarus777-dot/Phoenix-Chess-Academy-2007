import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { listCoachBatchSessions } from "@/lib/queries/coach/sessions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { SessionStatusBadge } from "@/components/portal/SessionStatusBadge";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";
import { formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Batch Class Sessions",
  description: "Class sessions for a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * `/coach/batches/[batchId]/sessions` — contextual session list for one
 * assigned batch, reusing `getAssignedBatch()` for authorization exactly
 * like the Students/Class Schedule tabs. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Coach Session List".
 */
export default async function CoachBatchSessionsPage({ params }: { params: Promise<{ batchId: string }> }) {
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
  const result = await listCoachBatchSessions(batch.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{batch.name} — Class Sessions</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">{batch.batchCode}</p>
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      <div>
        <Link
          href={`/coach/sessions/new?batchId=${batch.id}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Session
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_SESSIONS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((session) => (
            <li key={session.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/coach/sessions/${session.id}`} className="text-body font-medium text-primary-text hover:underline">
                  {session.sessionDate}
                </Link>
                <SessionStatusBadge status={session.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {formatTimeOfDay(session.startTime)}–{formatTimeOfDay(session.endTime)} ({session.timezone}) · {session.trainingMode}
                {session.locationName ? ` · ${session.locationName}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
