import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentPrograms } from "@/lib/queries/parent/programs";
import { listParentStudentBatches } from "@/lib/queries/parent/batches";
import { getParentStudentSchedule } from "@/lib/queries/parent/schedule";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { ParentStatusBadge, linkedStudentStatusTone } from "@/components/portal/parent/ParentStatusBadge";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { WEEKDAY_LABELS, formatTimeOfDay } from "@/lib/portal/weekday";

export const metadata = buildMetadata({
  title: "Student Overview",
  description: "Overview of a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

const PREVIEW_LIMIT = 3;

/**
 * `/parent/students/[studentId]` — every request independently
 * re-verifies the parent/student relationship via `getLinkedStudent()`.
 * `studentId` is treated purely as a resource identifier: an invalid
 * UUID, a nonexistent student, or a real-but-unlinked student all render
 * `notFound()` identically — see
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Student Enumeration Protection".
 */
export default async function ParentStudentOverviewPage({ params }: { params: Promise<{ studentId: string }> }) {
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

  const [programsResult, batchesResult, scheduleResult] = await Promise.all([
    listParentStudentPrograms(student.id),
    listParentStudentBatches(student.id),
    getParentStudentSchedule(student.id),
  ]);

  const programs = programsResult.ok ? programsResult.data : [];
  const currentBatches = batchesResult.ok ? batchesResult.data.current : [];
  const schedule = scheduleResult.ok ? scheduleResult.data : [];
  const anyUnavailable = !programsResult.ok || !batchesResult.ok || !scheduleResult.ok;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{student.fullName}</h1>
          <ParentStatusBadge label={student.status} tone={linkedStudentStatusTone(student.status)} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {student.studentCode} · {student.relationship}
          {student.isPrimary ? " · Primary guardian" : ""}
        </p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      <section className="rounded-lg border border-border bg-surface p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {student.currentLevel ? (
            <div>
              <dt className="text-xs text-muted-foreground">Current level</dt>
              <dd className="text-body-sm text-foreground">{student.currentLevel}</dd>
            </div>
          ) : null}
          {student.joinedOn ? (
            <div>
              <dt className="text-xs text-muted-foreground">Joined</dt>
              <dd className="text-body-sm text-foreground">{student.joinedOn}</dd>
            </div>
          ) : null}
          {student.fideId ? (
            <div>
              <dt className="text-xs text-muted-foreground">FIDE ID</dt>
              <dd className="text-body-sm text-foreground">{student.fideId}</dd>
            </div>
          ) : null}
          {student.fideRating != null ? (
            <div>
              <dt className="text-xs text-muted-foreground">FIDE rating</dt>
              <dd className="text-body-sm text-foreground">{student.fideRating}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {anyUnavailable ? <ParentPortalState code="DATABASE_UNAVAILABLE" /> : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-foreground">Current Programs</h2>
          <Link href={`/parent/students/${student.id}/programs`} className="text-body-sm text-primary-text hover:underline">
            View all
          </Link>
        </div>
        {programs.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No program enrollment is currently linked to this student record.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {programs.slice(0, PREVIEW_LIMIT).map((program) => (
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
          <Link href={`/parent/students/${student.id}/batches`} className="text-body-sm text-primary-text hover:underline">
            View all
          </Link>
        </div>
        {currentBatches.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No batch assignment is currently linked to this student record.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {currentBatches.slice(0, PREVIEW_LIMIT).map((batch) => (
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
          <h2 className="text-body font-medium text-foreground">Recurring Schedule</h2>
          <Link href={`/parent/students/${student.id}/schedule`} className="text-body-sm text-primary-text hover:underline">
            View all
          </Link>
        </div>
        {schedule.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No recurring class schedule is available yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {schedule.slice(0, PREVIEW_LIMIT).map((item) => (
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
    </div>
  );
}
