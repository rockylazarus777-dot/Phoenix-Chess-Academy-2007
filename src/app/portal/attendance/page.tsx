import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentAttendance } from "@/lib/queries/student/attendance";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { formatTimeOfDay } from "@/lib/portal/weekday";
import type { StudentAttendanceRow } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Attendance",
  description: "Your Phoenix Chess Academy class session and attendance history.",
  path: "/portal/attendance",
  index: false,
});

const SECTIONS: { status: StudentAttendanceRow["session_status"]; heading: string }[] = [
  { status: "SCHEDULED", heading: "Scheduled Sessions" },
  { status: "COMPLETED", heading: "Recent Sessions" },
  { status: "CANCELLED", heading: "Cancelled Sessions" },
];

/**
 * `/portal/attendance` — every row comes from `get_student_attendance()`,
 * scoped internally to the current student only (never a `studentId`
 * accepted from the browser). Attendance notes are never shown here —
 * coach-only operational data. A cancelled session always shows "Session
 * Cancelled," never a fabricated "Not Marked"/absence inference. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Student Attendance
 * Route".
 */
export default async function StudentAttendancePage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getStudentAttendance();
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Attendance</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Your class session and attendance history.</p>
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_ATTENDANCE" />
      ) : (
        <div className="flex flex-col gap-8">
          {SECTIONS.map(({ status, heading }) => {
            const sessions = rows.filter((row) => row.session_status === status);
            if (sessions.length === 0) return null;

            return (
              <section key={status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{heading}</h2>
                <ul className="flex flex-col gap-3">
                  {sessions.map((row) => (
                    <li key={row.session_id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-body font-medium text-foreground">{row.session_date}</p>
                        {row.session_status === "CANCELLED" ? (
                          <span className="text-body-sm text-muted-foreground">Session Cancelled</span>
                        ) : (
                          <AttendanceStatusBadge status={row.attendance_status ?? "NOT_MARKED"} />
                        )}
                      </div>
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        {row.batch_name} · {formatTimeOfDay(row.start_time)}–{formatTimeOfDay(row.end_time)} ({row.timezone})
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
