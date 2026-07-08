import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentAssignment } from "@/lib/queries/student/assignments";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { AssignmentSubmissionStatusBadge, type SubmissionDisplayStatus } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { AssignmentSubmissionForm } from "@/components/portal/student/AssignmentSubmissionForm";
import { formatAssignmentDueDate, formatAssignmentTimestamp, isAssignmentSubmissionDeadlinePassed } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Assignment Detail",
  description: "Details for one of your Phoenix Chess Academy assignments.",
  path: "/portal/assignments",
  index: false,
});

/**
 * `/portal/assignments/[assignmentId]` — "Knowing assignmentId is not
 * enough": authorization derives entirely from `get_student_assignment()`,
 * which requires an `assignment_recipients` row for the current student.
 * Never shows other recipients, other submissions, other student names,
 * coach contact details, parent data, or internal IDs. The submission form
 * is only rendered when the assignment is currently open for submission
 * (PUBLISHED + no submission yet, or PUBLISHED + REVISION_REQUESTED) — the
 * server-side `submit_assignment()` RPC is still the authoritative check.
 * See docs/ASSIGNMENTS_ARCHITECTURE.md, "Student Assignment Detail" and
 * "Student Deadline Rule".
 */
export default async function StudentAssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return (
      <StudentPortalState
        code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { assignmentId } = await params;
  const result = await getStudentAssignment(assignmentId);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const assignment = result.data;
  const displayStatus: SubmissionDisplayStatus = assignment.submission_status ?? "NOT_SUBMITTED";

  const isPastDue = isAssignmentSubmissionDeadlinePassed(assignment.due_at);
  const deadlinePermits = !isPastDue || assignment.allow_late_submission;

  const canSubmitInitial = assignment.status === "PUBLISHED" && assignment.submission_status === null && deadlinePermits;
  const canResubmit = assignment.status === "PUBLISHED" && assignment.submission_status === "REVISION_REQUESTED" && deadlinePermits;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{assignment.title}</h1>
          <AssignmentStatusBadge status={assignment.status} />
          <AssignmentSubmissionStatusBadge status={displayStatus} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {assignment.batch_name} · {assignment.program_name ?? "—"}
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
          <h2 className="mb-1 text-body font-medium text-foreground">Your Submission</h2>
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

      {canSubmitInitial ? (
        <section>
          <h2 className="mb-2 text-body font-medium text-foreground">Submit Your Work</h2>
          <AssignmentSubmissionForm assignmentId={assignment.assignment_id} initialText="" initialUrl="" isResubmission={false} />
        </section>
      ) : null}

      {canResubmit ? (
        <section>
          <h2 className="mb-2 text-body font-medium text-foreground">Resubmit Your Work</h2>
          <AssignmentSubmissionForm
            assignmentId={assignment.assignment_id}
            initialText={assignment.submission_text ?? ""}
            initialUrl={assignment.submission_url ?? ""}
            isResubmission
          />
        </section>
      ) : null}
    </div>
  );
}
