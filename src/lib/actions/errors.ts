import "server-only";

/**
 * Safe error handling shared by every public-form Server Action.
 *
 * Two rules enforced here, per Phase 7 security requirements:
 *  1. Never return a raw Supabase/Postgres error (message, detail, hint,
 *     code) to the browser — map known RPC exception messages to safe,
 *     specific user-facing text, and everything else to one generic
 *     fallback message.
 *  2. Never log full form payloads (DOB, guardian info, phone, email,
 *     free-text messages) — log only the submission type and a short
 *     error category/code.
 */

export type SubmissionErrorCode =
  | "NOT_CONFIGURED"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "TOURNAMENT_NOT_FOUND"
  | "REGISTRATION_NOT_OPEN"
  | "REGISTRATION_NOT_ENABLED"
  | "REGISTRATION_DEADLINE_PASSED"
  | "INVALID_CATEGORY"
  | "GUARDIAN_INFO_REQUIRED"
  | "DUPLICATE_REGISTRATION"
  | "RULES_NOT_ACKNOWLEDGED"
  | "PRIVACY_NOT_ACKNOWLEDGED"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<SubmissionErrorCode, string> = {
  NOT_CONFIGURED:
    "This form isn't available right now — the academy's booking system isn't fully configured yet. Please contact us directly using the details on this page.",
  VALIDATION_FAILED: "Some details couldn't be validated. Please check the form and try again.",
  RATE_LIMITED: "Too many submissions in a short time. Please wait a minute and try again.",
  TOURNAMENT_NOT_FOUND: "This tournament could not be found. Please refresh the page and try again.",
  REGISTRATION_NOT_OPEN: "Registration is not currently open for this tournament.",
  REGISTRATION_NOT_ENABLED: "Registration is not currently available for this tournament.",
  REGISTRATION_DEADLINE_PASSED: "The registration deadline for this tournament has passed.",
  INVALID_CATEGORY: "Please select a valid tournament category.",
  GUARDIAN_INFO_REQUIRED: "Parent/guardian details are required for players under 18.",
  DUPLICATE_REGISTRATION: "It looks like this player is already registered for this category.",
  RULES_NOT_ACKNOWLEDGED: "Please acknowledge the tournament rules to continue.",
  PRIVACY_NOT_ACKNOWLEDGED: "Please acknowledge the privacy notice to continue.",
  UNKNOWN: "Something went wrong while submitting this form. Please try again, or contact us directly.",
};

/** Postgres RAISE EXCEPTION messages we intentionally use as recognizable codes (see supabase/migrations/0009_submission_functions.sql). */
const KNOWN_RPC_CODES = new Set<SubmissionErrorCode>([
  "TOURNAMENT_NOT_FOUND",
  "REGISTRATION_NOT_OPEN",
  "REGISTRATION_NOT_ENABLED",
  "REGISTRATION_DEADLINE_PASSED",
  "INVALID_CATEGORY",
  "GUARDIAN_INFO_REQUIRED",
  "DUPLICATE_REGISTRATION",
  "RULES_NOT_ACKNOWLEDGED",
  "PRIVACY_NOT_ACKNOWLEDGED",
]);

export function resolveErrorCode(rawMessage: string | undefined | null): SubmissionErrorCode {
  const trimmed = (rawMessage ?? "").trim();
  if (KNOWN_RPC_CODES.has(trimmed as SubmissionErrorCode)) {
    return trimmed as SubmissionErrorCode;
  }
  return "UNKNOWN";
}

export function getSafeMessage(code: SubmissionErrorCode): string {
  return SAFE_MESSAGES[code];
}

/**
 * Logs a submission failure WITHOUT any personal information — no
 * names, DOB, guardian info, phone, email, or free-text message
 * content. Safe to send to any log aggregator.
 */
export function logSubmissionError(params: {
  submissionType: "contact_enquiry" | "trial_booking" | "tournament_registration" | "reporting_sync";
  code: SubmissionErrorCode;
  postgresErrorCode?: string;
  correlationId?: string;
}) {
  console.error("[submission-error]", {
    submissionType: params.submissionType,
    code: params.code,
    postgresErrorCode: params.postgresErrorCode,
    correlationId: params.correlationId,
    timestamp: new Date().toISOString(),
  });
}
