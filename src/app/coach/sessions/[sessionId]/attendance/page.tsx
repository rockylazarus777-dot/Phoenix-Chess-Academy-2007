import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedSession } from "@/lib/coach/sessionAuthorization";
import { getCoachSessionAttendance } from "@/lib/queries/coach/attendance";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AttendanceMarkingForm } from "@/components/portal/coach/AttendanceMarkingForm";
import { formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Mark Attendance",
  description: "Mark attendance for a class session on one of your assigned batches.",
  path: "/coach/sessions",
  index: false,
});

/**
 * `/coach/sessions/[sessionId]/attendance` — authorizes the session
 * first via `getAssignedSession()`, then blocks marking entirely for a
 * CANCELLED session (no new or updated attendance records are ever
 * possible for a cancelled session — see docs/
 * CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Cancelled Session
 * Behaviour"). The roster shown is exactly the session-date-eligible
 * roster from `get_coach_session_attendance()` — never an academy-wide
 * student list.
 */
export default async function CoachSessionAttendancePage({ params }: { params: Promise<{ sessionId: string }> }) {
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

  if (session.status === "CANCELLED") {
    return <CoachPortalState code="SESSION_CANCELLED" />;
  }

  const result = await getCoachSessionAttendance(session.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{session.batchName} — Mark Attendance</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {session.sessionDate} · {formatTimeOfDay(session.startTime)}–{formatTimeOfDay(session.endTime)}
        </p>
      </div>

      {result.data.length === 0 ? <CoachPortalState code="NO_STUDENTS" /> : <AttendanceMarkingForm sessionId={session.id} roster={result.data} />}
    </div>
  );
}
