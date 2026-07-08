/**
 * Safe action-result architecture for Coach Portal assignment mutations
 * (create/update/publish/archive/review) — same two rules as
 * `src/lib/coach/progressActionResult.ts`: never return a raw
 * Supabase/Postgres error string to the browser, and never log sensitive
 * payloads. Kept as its OWN narrow type rather than folding into
 * `CoachProgressActionResult` — the assignment domain introduces codes
 * (`ASSIGNMENT_NOT_FOUND`, `NO_RECIPIENTS`, `SUBMISSION_NOT_FOUND`,
 * `REVISION_FEEDBACK_REQUIRED`) that don't apply to progress-evaluation
 * mutations. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Progress Action
 * Result Architecture" (renamed here "Action Result Architecture").
 */
export type CoachAssignmentActionCode =
  | "VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "ASSIGNMENT_NOT_FOUND"
  | "ASSIGNMENT_NOT_EDITABLE"
  | "INVALID_TRANSITION"
  | "NO_RECIPIENTS"
  | "SUBMISSION_NOT_FOUND"
  | "REVISION_FEEDBACK_REQUIRED"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<CoachAssignmentActionCode, string> = {
  VALIDATION_ERROR: "Please check the form and try again.",
  DATABASE_UNAVAILABLE: "The academy's systems aren't available right now. Please try again shortly.",
  NOT_AUTHORIZED: "You don't have access to that batch, student, or assignment.",
  ASSIGNMENT_NOT_FOUND: "That assignment could not be found.",
  ASSIGNMENT_NOT_EDITABLE: "This assignment can no longer be edited.",
  INVALID_TRANSITION: "That status change isn't allowed.",
  NO_RECIPIENTS: "This assignment has no eligible students to publish to.",
  SUBMISSION_NOT_FOUND: "That submission could not be found.",
  REVISION_FEEDBACK_REQUIRED: "Add feedback explaining what needs revision.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export interface CoachAssignmentActionResult<T = undefined> {
  success: boolean;
  code?: CoachAssignmentActionCode;
  message?: string;
  data?: T;
}

export function assignmentActionOk<T = undefined>(data?: T): CoachAssignmentActionResult<T> {
  return { success: true, data };
}

export function assignmentActionError<T = undefined>(code: CoachAssignmentActionCode): CoachAssignmentActionResult<T> {
  return { success: false, code, message: SAFE_MESSAGES[code] };
}
