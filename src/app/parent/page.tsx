import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getParentDashboard } from "@/lib/queries/parent/dashboard";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { ParentStatusBadge, parentStatusTone, linkedStudentStatusTone } from "@/components/portal/parent/ParentStatusBadge";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Parent Portal",
  description: "Phoenix Chess Academy parent portal.",
  path: "/parent",
  index: false,
});

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Parent dashboard — welcome, parent identity summary, a preview of
 * linked students (each with active program names and current batches),
 * and a combined recurring "Weekly Schedule" preview across all linked
 * students. Every name/number here is real; there is no fabricated
 * "next class" or attendance claim anywhere. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Dashboard Architecture".
 */
export default async function ParentPage() {
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

  const dashboardResult = await getParentDashboard(identity.parent.id);
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-h4 text-foreground">Welcome back, {firstName(identity.parent.fullName)}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-body font-medium text-foreground">{identity.parent.fullName}</p>
          <ParentStatusBadge label={identity.parent.status} tone={parentStatusTone(identity.parent.status)} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {identity.parent.phone ? (
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="text-body-sm text-foreground">{identity.parent.phone}</dd>
            </div>
          ) : null}
          {identity.parent.email ? (
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="text-body-sm text-foreground">{identity.parent.email}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!dashboard ? (
        <ParentPortalState code="DATABASE_UNAVAILABLE" />
      ) : dashboard.students.length === 0 ? (
        <ParentPortalState code="NO_STUDENTS" />
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-body font-medium text-foreground">Linked Students</h2>
              <Link href="/parent/students" className="text-body-sm text-primary-text hover:underline">
                View all
              </Link>
            </div>
            <ul className="mt-3 flex flex-col gap-3">
              {dashboard.students.map((student) => (
                <li key={student.studentId} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/parent/students/${student.studentId}`} className="text-body font-medium text-primary-text hover:underline">
                      {student.fullName}
                    </Link>
                    <ParentStatusBadge label={student.status} tone={linkedStudentStatusTone(student.status)} />
                  </div>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {student.studentCode}
                    {student.currentLevel ? ` · ${student.currentLevel}` : ""} · {student.relationship}
                    {student.isPrimary ? " · Primary guardian" : ""}
                  </p>
                  {student.programNames.length > 0 ? (
                    <p className="mt-2 text-body-sm text-foreground">Programs: {student.programNames.join(", ")}</p>
                  ) : null}
                  {student.batches.length > 0 ? (
                    <p className="mt-1 text-body-sm text-muted-foreground">
                      Batches: {student.batches.map((b) => `${b.batchName} (${b.trainingMode})`).join(", ")}
                    </p>
                  ) : null}
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
                    <p className="text-muted-foreground">
                      {item.studentFirstName} · {item.batchName}
                    </p>
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
