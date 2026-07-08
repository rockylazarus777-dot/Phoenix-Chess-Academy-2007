import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentDashboard } from "@/lib/queries/student/dashboard";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { StudentStatusBadge, studentStatusTone } from "@/components/portal/student/StudentStatusBadge";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Student Portal",
  description: "Phoenix Chess Academy student portal.",
  path: "/portal",
  index: false,
});

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Student dashboard — welcome, identity card, and small previews of
 * programs/batches/schedule, each linking to its own full page. Every
 * number/name here is real; there is no fabricated "next class" or
 * progress claim anywhere (Phase 11 has no attendance/progress data at
 * all). See docs/STUDENT_PORTAL_ARCHITECTURE.md, "Student Dashboard
 * Architecture".
 */
export default async function PortalPage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const dashboardResult = await getStudentDashboard(identity.student.id);
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-h4 text-foreground">Welcome back, {firstName(identity.student.fullName)}</p>
        {identity.access === "READ_ONLY" ? (
          <p className="mt-2 text-body-sm text-muted-foreground">
            Your portal is currently in a read-only state. Contact the academy if you have questions about your status.
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body font-medium text-foreground">{identity.student.studentCode}</p>
          <StudentStatusBadge label={identity.student.status} tone={studentStatusTone(identity.student.status)} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {identity.student.currentLevel ? (
            <div>
              <dt className="text-xs text-muted-foreground">Current level</dt>
              <dd className="text-body-sm text-foreground">{identity.student.currentLevel}</dd>
            </div>
          ) : null}
          {identity.student.joinedOn ? (
            <div>
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="text-body-sm text-foreground">{identity.student.joinedOn}</dd>
            </div>
          ) : null}
          {identity.student.fideId ? (
            <div>
              <dt className="text-xs text-muted-foreground">FIDE ID</dt>
              <dd className="text-body-sm text-foreground">{identity.student.fideId}</dd>
            </div>
          ) : null}
          {identity.student.fideRating != null ? (
            <div>
              <dt className="text-xs text-muted-foreground">FIDE rating</dt>
              <dd className="text-body-sm text-foreground">{identity.student.fideRating}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!dashboard ? (
        <StudentPortalState code="DATABASE_UNAVAILABLE" />
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-body font-medium text-foreground">Active Programs</h2>
              <Link href="/portal/programs" className="text-body-sm text-primary-text hover:underline">
                View all
              </Link>
            </div>
            {dashboard.programs.length === 0 ? (
              <p className="mt-2 text-body-sm text-muted-foreground">No program enrollment is currently linked to your student record.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dashboard.programs.map((program) => (
                  <li key={program.id} className="rounded-md border border-border p-3 text-body-sm">
                    <p className="text-foreground">{program.programName}</p>
                    <p className="text-muted-foreground">{program.status} · enrolled {program.enrolledOn}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-body font-medium text-foreground">Current Batches</h2>
              <Link href="/portal/batches" className="text-body-sm text-primary-text hover:underline">
                View all
              </Link>
            </div>
            {dashboard.batches.length === 0 ? (
              <p className="mt-2 text-body-sm text-muted-foreground">No batch assignment is currently linked to your student record.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dashboard.batches.map((batch) => (
                  <li key={batch.batchId} className="rounded-md border border-border p-3 text-body-sm">
                    <p className="text-foreground">{batch.batchName}</p>
                    <p className="text-muted-foreground">
                      {batch.programName} · {batch.trainingMode}
                      {batch.locationName ? ` · ${batch.locationName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-body font-medium text-foreground">Your Weekly Schedule</h2>
              <Link href="/portal/schedule" className="text-body-sm text-primary-text hover:underline">
                View all
              </Link>
            </div>
            {dashboard.schedule.length === 0 ? (
              <p className="mt-2 text-body-sm text-muted-foreground">No recurring class schedule is available yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dashboard.schedule.map((item) => (
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

      <section className="rounded-lg border border-border p-5">
        <p className="text-body-sm text-muted-foreground">
          Phoenix Chess Academy&apos;s training approach emphasizes individual development, tactical growth, and disciplined,
          focused practice at every level.
        </p>
      </section>
    </div>
  );
}
