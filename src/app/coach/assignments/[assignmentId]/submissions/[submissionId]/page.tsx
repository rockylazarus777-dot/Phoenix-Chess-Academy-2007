import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignmentSubmission } from "@/lib/queries/coach/submissions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentSubmissionStatusBadge } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { SubmissionReviewForm } from "@/components/portal/coach/SubmissionReviewForm";
import { formatAssignmentTimestamp } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Submission Detail",
  description: "Details for one student's assignment submission.",
  path: "/coach/assignments",
  index: false,
});

/**
 * `/coach/assignments/[assignmentId]/submissions/[submissionId]` —
 * `getAssignmentSubmission()` requires `submission.assignment_id =
 * assignmentId` AND assignment visibility under the coach historical read
 * rule; a mismatched or unauthorized combination yields `notFound()`. The
 * review form (`coach_can_review`) is only shown for the assignment's
 * author with a current batch assignment — a continuity-only coach sees a
 * read-only view and can never overwrite the author's feedback. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Submission Detail".
 */
export default async function CoachSubmissionDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string; submissionId: string }>;
}) {
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

  const { assignmentId, submissionId } = await params;
  const result = await getAssignmentSubmission(assignmentId, submissionId);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const submission = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">
            {submission.student_full_name} ({submission.student_code})
          </h1>
          <AssignmentSubmissionStatusBadge status={submission.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">{submission.assignment_title}</p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Submitted: {formatAssignmentTimestamp(submission.submitted_at)}
          {submission.reviewed_at ? ` · Reviewed: ${formatAssignmentTimestamp(submission.reviewed_at)}` : ""}
        </p>
        <p className="mt-2">
          <Link href={`/coach/assignments/${assignmentId}/submissions`} className="text-body-sm font-medium text-primary-text hover:underline">
            Back to submissions
          </Link>
        </p>
      </div>

      {submission.submission_text ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Submission Text</h2>
          <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{submission.submission_text}</p>
        </section>
      ) : null}

      {submission.submission_url ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Link</h2>
          <a
            href={submission.submission_url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-body-sm font-medium text-primary-text hover:underline"
          >
            {submission.submission_url}
          </a>
        </section>
      ) : null}

      {submission.coach_feedback ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Coach Feedback</h2>
          <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{submission.coach_feedback}</p>
        </section>
      ) : null}

      {submission.coach_can_review ? (
        <SubmissionReviewForm assignmentId={assignmentId} submissionId={submission.submission_id} initialFeedback={submission.coach_feedback ?? ""} />
      ) : null}
    </div>
  );
}
