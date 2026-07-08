/**
 * Safe action-result architecture for the Student Portal's one mutation in
 * Phase 16 — `submit_assignment()`. Same two rules as
 * `src/lib/coach/assignmentActionResult.ts`: never return a raw
 * Supabase/Postgres error string to the browser, never log sensitive
 * payloads. Kept independent of the coach-side type since the codes here
 * are genuinely different (a student never sees ASSIGNMENT_NOT_EDITABLE/
 * NO_RECIPIENTS/SUBMISSION_NOT_FOUND/REVISION_FEEDBACK_REQUIRED — those are
 * coach-mutation concepts).
 *
 * `SUBMISSION_NOT_ALLOWED` is the safe, student-facing rename of the RPC's
 * `ASSIGNMENT_NOT_PUBLISHED` exception (see
 * `submit_assignment()` in supabase/migrations/0024_assignments_rls.sql) —
 * from the student's perspective, the actionable fact is "you can't submit
 * to this assignment right now," not the internal status value. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Action Result Architecture".
 */
export type StudentAssignmentActionCode =
  | "VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "ASSIGNMENT_NOT_FOUND"
  | "SUBMISSION_NOT_ALLOWED"
  | "SUBMISSION_NOT_EDITABLE"
  | "DEADLINE_PASSED"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<StudentAssignmentActionCode, string> = {
  VALIDATION_ERROR: "Add submission text or a link, and check the URL format, then try again.",
  DATABASE_UNAVAILABLE: "The academy's systems aren't available right now. Please try again shortly.",
  NOT_AUTHORIZED: "You don't have access to submit this assignment.",
  ASSIGNMENT_NOT_FOUND: "That assignment could not be found.",
  SUBMISSION_NOT_ALLOWED: "This assignment is not currently accepting submissions.",
  SUBMISSION_NOT_EDITABLE: "This submission can no longer be changed.",
  DEADLINE_PASSED: "The deadline for this assignment has passed and late submissions aren't allowed.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export interface StudentAssignmentActionResult<T = undefined> {
  success: boolean;
  code?: StudentAssignmentActionCode;
  message?: string;
  data?: T;
}

export function studentAssignmentActionOk<T = undefined>(data?: T): StudentAssignmentActionResult<T> {
  return { success: true, data };
}

export function studentAssignmentActionError<T = undefined>(code: StudentAssignmentActionCode): StudentAssignmentActionResult<T> {
  return { success: false, code, message: SAFE_MESSAGES[code] };
}
