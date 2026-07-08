import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentAttendance } from "@/lib/queries/parent/attendance";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { AttendanceStatusBadge } from "@/components/portal/AttendanceStatusBadge";
import { formatTimeOfDay } from "@/lib/portal/weekday";
import type { ParentAttendanceRow } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Student Attendance",
  description: "Attendance history for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

const SECTIONS: { status: ParentAttendanceRow["session_status"]; heading: string }[] = [
  { status: "SCHEDULED", heading: "Scheduled Sessions" },
  { status: "COMPLETED", heading: "Recent Sessions" },
  { status: "CANCELLED", heading: "Cancelled Sessions" },
];

/**
 * `/parent/students/[studentId]/attendance` — every request re-verifies
 * the parent/student relationship via `getLinkedStudent()` first (same
 * enumeration-protection contract as every other linked-student route),
 * then queries attendance through `getParentStudentAttendance()`, a
 * second, independent authorization layer. Attendance notes and coach
 * notes are never shown here. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Parent Attendance
 * Route".
 */
export default async function ParentStudentAttendancePage({ params }: { params: Promise<{ studentId: string }> }) {
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
  const result = await getParentStudentAttendance(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Attendance</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Class session and attendance history.</p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_ATTENDANCE" />
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
