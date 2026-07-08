import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getCoachDashboard } from "@/lib/queries/coach/dashboard";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { CoachStatusBadge, coachStatusTone } from "@/components/portal/coach/CoachStatusBadge";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Coach Portal",
  description: "Phoenix Chess Academy coach portal.",
  path: "/coach",
  index: false,
});

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Coach dashboard — welcome, coach identity summary, an assigned
 * batches preview (deduplicated roster count per batch, never other
 * students), and a combined recurring "Weekly Schedule" preview across
 * assigned batches. Every name/number here is real; there is no
 * fabricated "next class" or attendance claim anywhere. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach Dashboard Architecture".
 */
export default async function CoachPage() {
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

  const dashboardResult = await getCoachDashboard(identity.coach.id);
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-h4 text-foreground">Welcome back, {firstName(identity.coach.fullName)}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body font-medium text-foreground">{identity.coach.fullName}</p>
          <CoachStatusBadge label={identity.coach.status} tone={coachStatusTone(identity.coach.status)} />
          {identity.coach.coachCode ? (
            <span className="rounded-full border border-border-strong px-2 py-0.5 text-xs text-muted-foreground">
              {identity.coach.coachCode}
            </span>
          ) : null}
        </div>
        {identity.coach.specializations.length > 0 ? (
          <p className="mt-3 text-body-sm text-muted-foreground">Specializations: {identity.coach.specializations.join(", ")}</p>
        ) : null}
      </section>

      {!dashboard ? (
        <CoachPortalState code="DATABASE_UNAVAILABLE" />
      ) : dashboard.batches.length === 0 ? (
        <CoachPortalState code="NO_BATCHES" />
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-body font-medium text-foreground">Assigned Batches</h2>
              <Link href="/coach/batches" className="text-body-sm text-primary-text hover:underline">
                View all
              </Link>
            </div>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {dashboard.uniqueStudentCount} unique student{dashboard.uniqueStudentCount === 1 ? "" : "s"} across assigned batches
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {dashboard.batches.map((batch) => (
                <li key={batch.id} className="rounded-lg border border-border p-4">
                  <Link href={`/coach/batches/${batch.id}`} className="text-body font-medium text-primary-text hover:underline">
                    {batch.name}
                  </Link>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {batch.programName} · {batch.trainingMode}
                    {batch.locationName ? ` · ${batch.locationName}` : ""} · {batch.assignmentRole}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {batch.rosterCount} assigned batch roster entr{batch.rosterCount === 1 ? "y" : "ies"}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-body font-medium text-foreground">Weekly Schedule</h2>
            {dashboard.schedulePreview.length === 0 ? (
              <p className="mt-2 text-body-sm text-muted-foreground">No recurring class schedule is available yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dashboard.schedulePreview.map((item) => (
                  <li key={item.id} className="rounded-md border border-border p-3 text-body-sm">
                    <p className="text-foreground">
                      {WEEKDAY_LABELS[item.dayOfWeek]} · {formatTimeOfDay(item.startTime)}–{formatTimeOfDay(item.endTime)}
                    </p>
                    <p className="text-muted-foreground">{item.batchName}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
