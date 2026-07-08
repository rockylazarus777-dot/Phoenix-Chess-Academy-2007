import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentPrograms } from "@/lib/queries/parent/programs";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { ParentStatusBadge, parentEnrollmentStatusTone } from "@/components/portal/parent/ParentStatusBadge";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";

export const metadata = buildMetadata({
  title: "Student Programs",
  description: "Program enrollments for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * "Linked Student Programs" — only this student's own
 * `student_program_enrollments`, never public marketing program cards
 * presented as though the student is enrolled. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Linked Student Program Empty
 * State".
 */
export default async function ParentStudentProgramsPage({ params }: { params: Promise<{ studentId: string }> }) {
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
  const result = await listParentStudentPrograms(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Programs</h1>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {result.data.length === 0 ? (
        <div className="flex flex-col gap-4">
          <ParentPortalState code="NO_PROGRAMS" />
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
                <ParentStatusBadge label={program.status} tone={parentEnrollmentStatusTone(program.status)} />
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
