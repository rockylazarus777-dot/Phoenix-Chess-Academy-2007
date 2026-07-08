import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { listCoachSessions, type CoachSessionListRow } from "@/lib/queries/coach/sessions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { SessionStatusBadge } from "@/components/portal/SessionStatusBadge";
import { formatTimeOfDay } from "@/lib/portal/weekday";
import type { SessionStatus } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Class Sessions",
  description: "Class sessions for batches assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/sessions",
  index: false,
});

const SECTIONS: { status: SessionStatus; heading: string }[] = [
  { status: "SCHEDULED", heading: "Scheduled Sessions" },
  { status: "COMPLETED", heading: "Completed Sessions" },
  { status: "CANCELLED", heading: "Cancelled Sessions" },
];

function SessionCard({ session }: { session: CoachSessionListRow }) {
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/coach/sessions/${session.id}`} className="text-body font-medium text-primary-text hover:underline">
          {session.batchName} — {session.sessionDate}
        </Link>
        <SessionStatusBadge status={session.status} />
      </div>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {formatTimeOfDay(session.startTime)}–{formatTimeOfDay(session.endTime)} ({session.timezone}) · {session.programName} · {session.trainingMode}
        {session.locationName ? ` · ${session.locationName}` : ""}
      </p>
    </li>
  );
}

/**
 * "Class Sessions" — every session on a batch the coach is currently
 * assigned to, grouped by real `status` (status-based headings, not
 * date-derived "Upcoming"/"Next" labels — see
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Coach Session List").
 */
export default async function CoachSessionsPage() {
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

  const result = await listCoachSessions();
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h4 text-foreground">Class Sessions</h1>
        <Link
          href="/coach/sessions/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Session
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_SESSIONS" />
      ) : (
        <div className="flex flex-col gap-8">
          {SECTIONS.map(({ status, heading }) => {
            const sessions = result.data.filter((session) => session.status === status);
            if (sessions.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{heading}</h2>
                <ul className="flex flex-col gap-3">
                  {sessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
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
