import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentSchedule } from "@/lib/queries/student/schedule";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Class Schedule",
  description: "Your Phoenix Chess Academy recurring class schedule.",
  path: "/portal/schedule",
  index: false,
});

/**
 * Recurring weekly schedule definitions only — no calendar library, no
 * dated sessions, no "Join Class" button (no meeting links exist in the
 * Phase 10 schema, and none are fabricated here). See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Recurring Schedules vs. Future
 * Class Sessions".
 */
export default async function StudentSchedulePage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getStudentSchedule(identity.student.id);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;
  const distinctTimezones = [...new Set(rows.map((r) => r.timezone))];
  const singleTimezone = distinctTimezones.length === 1 ? distinctTimezones[0] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Class Schedule</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Recurring weekly class times — not a dated attendance record.</p>
        {singleTimezone ? <p className="mt-1 text-xs text-muted-foreground">Times shown in {singleTimezone}.</p> : null}
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_SCHEDULE" />
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
                        {row.batchName} ({row.batchCode})
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
