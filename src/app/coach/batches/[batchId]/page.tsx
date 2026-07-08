import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getCoachBatchRoster } from "@/lib/queries/coach/roster";
import { getCoachBatchSchedule } from "@/lib/queries/coach/schedule";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { CoachStatusBadge, batchStatusTone } from "@/components/portal/coach/CoachStatusBadge";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Batch Overview",
  description: "Overview of a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

const PREVIEW_LIMIT = 5;

/**
 * `/coach/batches/[batchId]` — every request independently re-verifies
 * the coach/batch assignment via `getAssignedBatch()`. `batchId` is
 * treated purely as a resource identifier: an invalid UUID, a
 * nonexistent batch, and a real-but-unassigned batch all render
 * `notFound()` identically — see
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Batch Enumeration Protection".
 */
export default async function CoachBatchOverviewPage({ params }: { params: Promise<{ batchId: string }> }) {
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

  const [rosterResult, scheduleResult] = await Promise.all([
    getCoachBatchRoster(batch.id),
    getCoachBatchSchedule(batch.id),
  ]);

  const roster = rosterResult.ok ? rosterResult.data : [];
  const schedule = scheduleResult.ok ? scheduleResult.data : [];
  const anyUnavailable = !rosterResult.ok || !scheduleResult.ok;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{batch.name}</h1>
          <CoachStatusBadge label={batch.status} tone={batchStatusTone(batch.status)} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {batch.batchCode} · {batch.programName} · {batch.trainingMode}
          {batch.level ? ` · ${batch.level}` : ""}
          {batch.locationName ? ` · ${batch.locationName}` : ""}
        </p>
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      <section className="rounded-lg border border-border bg-surface p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Your assignment</dt>
            <dd className="text-body-sm text-foreground">{batch.assignmentRole}</dd>
          </div>
          {batch.assignedAt ? (
            <div>
              <dt className="text-xs text-muted-foreground">Assigned since</dt>
              <dd className="text-body-sm text-foreground">{batch.assignedAt}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {anyUnavailable ? <CoachPortalState code="DATABASE_UNAVAILABLE" /> : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-foreground">Student Roster Preview</h2>
          <Link href={`/coach/batches/${batch.id}/students`} className="text-body-sm text-primary-text hover:underline">
            View all
          </Link>
        </div>
        {roster.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No students are currently linked to this batch.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {roster.slice(0, PREVIEW_LIMIT).map((student) => (
              <li key={student.student_id} className="rounded-md border border-border p-3 text-body-sm">
                <p className="text-foreground">{student.full_name}</p>
                <p className="text-muted-foreground">
                  {student.student_code}
                  {student.current_level ? ` · ${student.current_level}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-foreground">Recurring Schedule Preview</h2>
          <Link href={`/coach/batches/${batch.id}/schedule`} className="text-body-sm text-primary-text hover:underline">
            View all
          </Link>
        </div>
        {schedule.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No recurring class schedule is available yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {schedule.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-body-sm">
                <p className="text-foreground">
                  {WEEKDAY_LABELS[item.dayOfWeek]} · {formatTimeOfDay(item.startTime)}–{formatTimeOfDay(item.endTime)}
                </p>
                <p className="text-muted-foreground">
                  {item.trainingMode}
                  {item.locationName ? ` · ${item.locationName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
