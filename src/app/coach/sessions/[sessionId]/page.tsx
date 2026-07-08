import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedSession } from "@/lib/coach/sessionAuthorization";
import { getCoachSessionAttendance } from "@/lib/queries/coach/attendance";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { SessionStatusBadge } from "@/components/portal/SessionStatusBadge";
import { SessionStatusActions } from "@/components/portal/coach/SessionStatusActions";
import { formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Session Detail",
  description: "Details for a class session on one of your assigned batches.",
  path: "/coach/sessions",
  index: false,
});

/**
 * `/coach/sessions/[sessionId]` — every request independently calls
 * `getAssignedSession()`. Invalid UUID, nonexistent session, and a
 * session on an unassigned batch all render `notFound()` identically —
 * see docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session
 * Enumeration Protection". Attendance summary counts come only from the
 * session-date-eligible roster (`get_coach_session_attendance()`) —
 * "Not Marked" is derived as eligible minus marked, never inferred as
 * Absent.
 */
export default async function CoachSessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
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

  const { sessionId } = await params;
  const assigned = await getAssignedSession(sessionId);

  if (!assigned.ok) {
    if (assigned.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const session = assigned.session;
  const attendanceResult = await getCoachSessionAttendance(session.id);
  const attendance = attendanceResult.ok ? attendanceResult.data : [];

  const eligibleCount = attendance.length;
  const markedCount = attendance.filter((row) => row.attendance_status !== null).length;
  const presentCount = attendance.filter((row) => row.attendance_status === "PRESENT").length;
  const absentCount = attendance.filter((row) => row.attendance_status === "ABSENT").length;
  const lateCount = attendance.filter((row) => row.attendance_status === "LATE").length;
  const excusedCount = attendance.filter((row) => row.attendance_status === "EXCUSED").length;
  const notMarkedCount = eligibleCount - markedCount;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">
            {session.batchName} — {session.sessionDate}
          </h1>
          <SessionStatusBadge status={session.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {formatTimeOfDay(session.startTime)}–{formatTimeOfDay(session.endTime)} ({session.timezone}) · {session.programName} ·{" "}
          {session.trainingMode}
          {session.locationName ? ` · ${session.locationName}` : ""}
        </p>
        {session.topic ? <p className="mt-1 text-body-sm text-foreground">Topic: {session.topic}</p> : null}
      </div>

      {session.status === "SCHEDULED" ? (
        <SessionStatusActions sessionId={session.id} />
      ) : session.status === "CANCELLED" ? (
        <CoachPortalState code="SESSION_CANCELLED" />
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-3 text-body font-medium text-foreground">Attendance Summary</h2>
        {!attendanceResult.ok ? (
          <CoachPortalState code="DATABASE_UNAVAILABLE" />
        ) : eligibleCount === 0 ? (
          <p className="text-body-sm text-muted-foreground">No students are currently linked to this batch.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-xs text-muted-foreground">Eligible</dt>
              <dd className="text-body-sm text-foreground">{eligibleCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Marked</dt>
              <dd className="text-body-sm text-foreground">{markedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Present</dt>
              <dd className="text-body-sm text-foreground">{presentCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Absent</dt>
              <dd className="text-body-sm text-foreground">{absentCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Late</dt>
              <dd className="text-body-sm text-foreground">{lateCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Excused</dt>
              <dd className="text-body-sm text-foreground">{excusedCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Not Marked</dt>
              <dd className="text-body-sm text-foreground">{notMarkedCount}</dd>
            </div>
          </dl>
        )}
        {session.status !== "CANCELLED" ? (
          <Link href={`/coach/sessions/${session.id}/attendance`} className="mt-4 inline-block text-body-sm text-primary-text hover:underline">
            {markedCount > 0 ? "View / Update Attendance" : "Mark Attendance"}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
