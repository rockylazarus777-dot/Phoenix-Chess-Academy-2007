"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewAssignmentSubmission } from "@/lib/actions/coach/assignments";

const textareaClasses =
  "min-h-24 rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Coach review form — two explicit actions, "Mark Reviewed" and "Request
 * Revision," never a generic status dropdown (see
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Submission Review
 * Architecture"). A coach may never set SUBMITTED (enforced server-side by
 * `review_assignment_submission()`, which rejects any other status
 * value). Requesting revision requires non-empty feedback client-side (and
 * again server-side) — `review_assignment_submission()` raises
 * REVISION_FEEDBACK_REQUIRED otherwise. Only rendered by the parent page
 * when `coach_can_review` is true (author + current batch assignment) — a
 * continuity-only coach never sees this form.
 */
export function SubmissionReviewForm({ assignmentId, submissionId, initialFeedback }: { assignmentId: string; submissionId: string; initialFeedback: string }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(status: "REVIEWED" | "REVISION_REQUESTED") {
    setError(null);
    if (status === "REVISION_REQUESTED" && feedback.trim().length === 0) {
      setError("Add feedback explaining what needs revision.");
      return;
    }
    startTransition(async () => {
      const result = await reviewAssignmentSubmission(assignmentId, { submissionId, status, feedback });
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coachFeedback" className="text-body-sm font-medium text-foreground">
          Feedback
        </label>
        <textarea id="coachFeedback" className={textareaClasses} maxLength={3000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("REVIEWED")}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Mark Reviewed
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("REVISION_REQUESTED")}
          className="inline-flex h-10 items-center justify-center rounded-md border border-warning/50 px-4 text-body-sm font-medium text-warning focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Request Revision
        </button>
      </div>
    </div>
  );
}
