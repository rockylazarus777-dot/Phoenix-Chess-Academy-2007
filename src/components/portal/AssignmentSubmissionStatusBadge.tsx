import type { AssignmentSubmissionStatus } from "@/lib/supabase/types";

/**
 * `NOT_SUBMITTED` is a UI-only label — it is never persisted as
 * `assignment_submission_status` (a missing `assignment_submissions` row
 * already means "not submitted," exactly like attendance's NOT_MARKED and
 * progress evaluations having no analog). This type exists only so this
 * component and its callers share one vocabulary for the "no row yet"
 * case. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Submission Status
 * Presentation".
 */
export type SubmissionDisplayStatus = AssignmentSubmissionStatus | "NOT_SUBMITTED";

const TONE_CLASSES: Record<"neutral" | "positive" | "attention", string> = {
  neutral: "border-border-strong text-muted-foreground",
  positive: "border-success/50 text-success",
  attention: "border-warning/50 text-warning",
};

const STATUS_TONES: Record<SubmissionDisplayStatus, "neutral" | "positive" | "attention"> = {
  NOT_SUBMITTED: "neutral",
  SUBMITTED: "positive",
  REVIEWED: "positive",
  REVISION_REQUESTED: "attention",
};

// Deliberately NOT "Passed"/"Approved"/"Successful" for REVIEWED — Phase 16
// implements no numeric/pass-fail grading; REVIEWED means only "a coach has
// looked at this," not "this work succeeded."
const STATUS_LABELS: Record<SubmissionDisplayStatus, string> = {
  NOT_SUBMITTED: "Not Submitted",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  REVISION_REQUESTED: "Revision Requested",
};

/**
 * An `assignment_submissions.status` badge (plus the UI-only NOT_SUBMITTED
 * state) — deliberately its own component, never reused for
 * `AssignmentStatusBadge`/`ProgressEvaluationStatusBadge`. Status is always
 * rendered as text plus a tone color, never color alone.
 */
export function AssignmentSubmissionStatusBadge({ status }: { status: SubmissionDisplayStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[STATUS_TONES[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
