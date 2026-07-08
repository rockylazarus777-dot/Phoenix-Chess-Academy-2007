/**
 * Safe action-result architecture for Coach Portal mutations (session
 * creation, session status transitions, attendance marking) — same two
 * rules as `src/lib/admin/errors.ts`: never return a raw
 * Supabase/Postgres error string to the browser, and never log sensitive
 * payloads. Kept independent of `AdminActionResult` since the coach
 * portal is deliberately decoupled from the admin area. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Query/Action Result
 * Architecture".
 */
export type CoachActionCode =
  | "VALIDATION_ERROR"
  | "DATABASE_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "SESSION_NOT_FOUND"
  | "SESSION_CANCELLED"
  | "INVALID_TRANSITION"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<CoachActionCode, string> = {
  VALIDATION_ERROR: "Please check the form and try again.",
  DATABASE_UNAVAILABLE: "The academy's systems aren't available right now. Please try again shortly.",
  NOT_AUTHORIZED: "You don't have access to that batch or session.",
  SESSION_NOT_FOUND: "That session could not be found.",
  SESSION_CANCELLED: "This session has been cancelled and can no longer be updated.",
  INVALID_TRANSITION: "That status change isn't allowed.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export interface CoachActionResult<T = undefined> {
  success: boolean;
  code?: CoachActionCode;
  message?: string;
  data?: T;
}

export function coachActionOk<T = undefined>(data?: T): CoachActionResult<T> {
  return { success: true, data };
}

export function coachActionError<T = undefined>(code: CoachActionCode): CoachActionResult<T> {
  return { success: false, code, message: SAFE_MESSAGES[code] };
}
