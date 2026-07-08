import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentSchedule } from "@/lib/queries/parent/schedule";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Student Class Schedule",
  description: "Recurring class schedule for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * Recurring weekly schedule definitions only — no calendar library, no
 * dated sessions, no "Join Class" button. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Recurring Schedules vs. Future
 * Class Sessions".
 */
export default async function ParentStudentSchedulePage({ params }: { params: Promise<{ studentId: string }> }) {
  const identity = await getCurrentParent();

  if (identity.status !== "OK") {
    return (
      <ParentPortalState
        code={identity.status === "NOT_LINKED" ? "PARENT_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <ParentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { studentId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await getParentStudentSchedule(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;
  const distinctTimezones = [...new Set(rows.map((r) => r.timezone))];
  const singleTimezone = distinctTimezones.length === 1 ? distinctTimezones[0] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Class Schedule</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Recurring weekly class times — not a dated attendance record.</p>
        {singleTimezone ? <p className="mt-1 text-xs text-muted-foreground">Times shown in {singleTimezone}.</p> : null}
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_SCHEDULE" />
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
