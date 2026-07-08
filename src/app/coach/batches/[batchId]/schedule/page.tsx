import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getCoachBatchSchedule } from "@/lib/queries/coach/schedule";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Batch Class Schedule",
  description: "Recurring class schedule for a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * Recurring weekly schedule definitions only — no calendar library, no
 * dated sessions, no "Start Class"/"Join Class" button, no next-class
 * calculation. See docs/COACH_PORTAL_ARCHITECTURE.md, "Schedule
 * Architecture".
 */
export default async function CoachBatchSchedulePage({ params }: { params: Promise<{ batchId: string }> }) {
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
  const result = await getCoachBatchSchedule(batch.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  const rows = result.data;
  const distinctTimezones = [...new Set(rows.map((r) => r.timezone))];
  const singleTimezone = distinctTimezones.length === 1 ? distinctTimezones[0] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{batch.name} — Class Schedule</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Recurring weekly class times — not a dated attendance record.</p>
        {singleTimezone ? <p className="mt-1 text-xs text-muted-foreground">Times shown in {singleTimezone}.</p> : null}
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      {rows.length === 0 ? (
        <CoachPortalState code="NO_SCHEDULE" />
      ) : (
        <div className="flex flex-col gap-6">
          {WEEKDAY_ORDER.map((day) => {
            const dayRows = rows.filter((r) => r.dayOfWeek === day);
            if (dayRows.length === 0) return null;

            return (
              <section key={day}>
                <h2 className="mb-2 text-body font-medium text-foreground">{WEEKDAY_LABELS[day]}</h2>
                <ul className="flex flex-col gap-2">
                  {dayRows.map((row) => (
                    <li key={row.id} className="rounded-md border border-border p-3 text-body-sm">
                      <p className="text-foreground">
                        {formatTimeOfDay(row.startTime)} – {formatTimeOfDay(row.endTime)}
                        {!singleTimezone ? ` (${row.timezone})` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {row.trainingMode}
                        {row.locationName ? ` · ${row.locationName}` : ""}
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
