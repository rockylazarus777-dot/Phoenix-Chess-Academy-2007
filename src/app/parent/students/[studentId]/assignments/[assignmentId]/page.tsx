import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentAssignment } from "@/lib/queries/parent/assignments";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { AssignmentSubmissionStatusBadge, type SubmissionDisplayStatus } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { formatAssignmentDueDate, formatAssignmentTimestamp } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Assignment Detail",
  description: "Details for one of a linked student's Phoenix Chess Academy assignments.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/assignments/[assignmentId]` — every
 * request re-verifies the parent/student relationship via
 * `getLinkedStudent()` first, then `getParentStudentAssignment()`
 * independently re-verifies `parent_has_student()` inside the RPC
 * (defense in depth). Read-only: no submit/resubmit/edit/review action
 * exists anywhere on this page. Never shows other recipients, other
 * students, coach contact details, or internal IDs. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Parent Assignment Privacy".
 */
export default async function ParentStudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; assignmentId: string }>;
}) {
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

  const { studentId, assignmentId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await getParentStudentAssignment(student.id, assignmentId);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const assignment = result.data;
  const displayStatus: SubmissionDisplayStatus = assignment.submission_status ?? "NOT_SUBMITTED";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{assignment.title}</h1>
          <AssignmentStatusBadge status={assignment.status} />
          <AssignmentSubmissionStatusBadge status={displayStatus} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {student.fullName} · {assignment.batch_name} · {assignment.program_name ?? "—"}
        </p>
        {assignment.session_date ? <p className="mt-1 text-body-sm text-muted-foreground">Linked session: {assignment.session_date}</p> : null}
        <p className="mt-1 text-body-sm text-muted-foreground">
          Due: {formatAssignmentDueDate(assignment.due_at)} · Late submission: {assignment.allow_late_submission ? "Allowed" : "Not allowed"}
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-body font-medium text-foreground">Description</h2>
        <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{assignment.description}</p>
      </section>

      {assignment.instructions ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Instructions</h2>
          <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{assignment.instructions}</p>
        </section>
      ) : null}

      {assignment.submission_id ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Submission</h2>
          <p className="text-body-sm text-muted-foreground">Submitted: {formatAssignmentTimestamp(assignment.submitted_at)}</p>
          {assignment.submission_text ? <p className="mt-2 whitespace-pre-wrap text-body-sm text-foreground">{assignment.submission_text}</p> : null}
          {assignment.submission_url ? (
            <p className="mt-2">
              <a
                href={assignment.submission_url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="text-body-sm font-medium text-primary-text hover:underline"
              >
                {assignment.submission_url}
              </a>
            </p>
          ) : null}
          {assignment.coach_feedback ? (
            <div className="mt-3 rounded-lg border border-border bg-surface p-3">
              <p className="text-body-sm font-medium text-foreground">Coach Feedback</p>
              <p className="mt-1 whitespace-pre-wrap text-body-sm text-muted-foreground">{assignment.coach_feedback}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
