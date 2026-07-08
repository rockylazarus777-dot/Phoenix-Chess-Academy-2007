import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentAssignments } from "@/lib/queries/parent/assignments";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { AssignmentSubmissionStatusBadge, type SubmissionDisplayStatus } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { formatAssignmentDueDate } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Student Assignments",
  description: "Assignments for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/assignments` — every request re-verifies
 * the parent/student relationship via `getLinkedStudent()` first, then
 * queries assignments through `getParentStudentAssignments()`, a second,
 * independent authorization layer. Read-only: no submit/edit/review action
 * exists on this page. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Parent
 * Assignment Privacy".
 */
export default async function ParentStudentAssignmentsPage({ params }: { params: Promise<{ studentId: string }> }) {
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
  const result = await listParentStudentAssignments(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Assignments</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Assignments from this student&apos;s batch or assigned directly to them.</p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_ASSIGNMENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const displayStatus: SubmissionDisplayStatus = row.submission_status ?? "NOT_SUBMITTED";
            return (
              <li key={row.assignment_id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/parent/students/${student.id}/assignments/${row.assignment_id}`}
                    className="text-body font-medium text-primary-text hover:underline"
                  >
                    {row.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignmentStatusBadge status={row.status} />
                    <AssignmentSubmissionStatusBadge status={displayStatus} />
                  </div>
                </div>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  {row.batch_name} · {row.program_name ?? "—"}
                </p>
                <p className="mt-1 text-body-sm text-muted-foreground">Due: {formatAssignmentDueDate(row.due_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
