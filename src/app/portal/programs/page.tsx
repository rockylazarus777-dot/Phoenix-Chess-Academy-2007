import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { listStudentPrograms } from "@/lib/queries/student/programs";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { StudentStatusBadge, enrollmentStatusTone } from "@/components/portal/student/StudentStatusBadge";

export const metadata = buildMetadata({
  title: "My Programs",
  description: "Your Phoenix Chess Academy program enrollments.",
  path: "/portal/programs",
  index: false,
});

/**
 * Only the student's own `student_program_enrollments` — never public
 * marketing program cards presented as though the student is enrolled
 * in them. See docs/STUDENT_PORTAL_ARCHITECTURE.md, "Program Empty
 * State".
 */
export default async function StudentProgramsPage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await listStudentPrograms(identity.student.id);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">My Programs</h1>

      {result.data.length === 0 ? (
        <div className="flex flex-col gap-4">
          <StudentPortalState code="NO_PROGRAMS" />
          <Link href="/programs" className="text-body-sm text-primary-text hover:underline">
            Explore Phoenix Programs
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((program) => (
            <li key={program.id} className="rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {program.publicProgramHref ? (
                  <Link href={program.publicProgramHref} className="text-body font-medium text-primary-text hover:underline">
                    {program.programName}
                  </Link>
                ) : (
                  <p className="text-body font-medium text-foreground">{program.programName}</p>
                )}
                <StudentStatusBadge label={program.status} tone={enrollmentStatusTone(program.status)} />
              </div>
              <p className="mt-2 text-body-sm text-muted-foreground">
                Enrolled {program.enrolledOn}
                {program.completedOn ? ` · Completed ${program.completedOn}` : ""}
                {program.batchName ? ` · Batch: ${program.batchName}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
