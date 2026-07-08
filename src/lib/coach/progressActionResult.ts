/**
 * Safe action-result architecture for Coach Portal progress-evaluation
 * mutations (create/update/publish/archive) — same two rules as
 * `src/lib/coach/actionResult.ts` (Phase 14): never return a raw
 * Supabase/Postgres error string to the browser, and never log sensitive
 * payloads. Kept as its OWN narrow type rather than folding into
 * `CoachActionResult` — the progress domain introduces codes
 * (`EVALUATION_NOT_FOUND`, `EVALUATION_NOT_EDITABLE`, `EMPTY_EVALUATION`)
 * that don't apply to session/attendance mutations, and overloading one
 * shared union with unrelated codes would make every caller's switch
 * statement handle cases that can never occur for it. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Progress Action Result
 * Architecture".
 */
export type CoachProgressActionCode =
  | "VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "EVALUATION_NOT_FOUND"
  | "EVALUATION_NOT_EDITABLE"
  | "INVALID_TRANSITION"
  | "EMPTY_EVALUATION"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<CoachProgressActionCode, string> = {
  VALIDATION_ERROR: "Please check the form and try again.",
  DATABASE_UNAVAILABLE: "The academy's systems aren't available right now. Please try again shortly.",
  NOT_AUTHORIZED: "You don't have access to that student, batch, or evaluation.",
  EVALUATION_NOT_FOUND: "That evaluation could not be found.",
  EVALUATION_NOT_EDITABLE: "This evaluation can no longer be edited.",
  INVALID_TRANSITION: "That status change isn't allowed.",
  EMPTY_EVALUATION: "Add an overall summary and at least one development area rating before publishing.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export interface CoachProgressActionResult<T = undefined> {
  success: boolean;
  code?: CoachProgressActionCode;
  message?: string;
  data?: T;
}

export function progressActionOk<T = undefined>(data?: T): CoachProgressActionResult<T> {
  return { success: true, data };
}

export function progressActionError<T = undefined>(code: CoachProgressActionCode): CoachProgressActionResult<T> {
  return { success: false, code, message: SAFE_MESSAGES[code] };
}
