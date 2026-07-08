import "server-only";

/**
 * Safe admin error architecture — same two rules as
 * src/lib/actions/errors.ts (public forms) and src/lib/auth/errors.ts
 * (auth): never return raw Postgres/Supabase/Auth-Admin error text to
 * the browser, and never log sensitive payloads. See
 * docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Admin Error Architecture".
 */
export type AdminErrorCode =
  | "AUTHORIZATION_DENIED"
  | "DATABASE_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ACCOUNT_PROVISIONING_FAILED"
  | "IMPORT_VALIDATION_FAILED"
  // Phase 17 — certificates + achievement records. Kept as their own
  // codes (not folded into NOT_FOUND/CONFLICT) since the RPC layer
  // raises these exact exception strings and the UI benefits from a
  // precise, certificate/achievement-specific message. See
  // docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Action Result
  // Architecture".
  | "CERTIFICATE_NOT_FOUND"
  | "CERTIFICATE_NOT_EDITABLE"
  | "INVALID_CERTIFICATE_CONTEXT"
  | "INVALID_TRANSITION"
  | "CERTIFICATE_NUMBER_GENERATION_FAILED"
  | "REVOCATION_REASON_REQUIRED"
  | "ACHIEVEMENT_NOT_FOUND"
  | "ACHIEVEMENT_NOT_EDITABLE"
  | "INVALID_ACHIEVEMENT_CONTEXT"
  // Phase 18 — certificate PDF generation + private R2 storage + secure
  // download. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Action
  // Result Architecture". Never exposes R2/AWS/S3/Supabase/Postgres/
  // SQLSTATE/bucket names/storage keys/raw exception messages.
  | "CERTIFICATE_NOT_ISSUED"
  | "GENERATION_IN_PROGRESS"
  | "CERTIFICATE_CONTEXT_INVALID"
  | "PDF_GENERATION_FAILED"
  | "PDF_TOO_LARGE"
  | "STORAGE_UNAVAILABLE"
  | "DOCUMENT_FINALIZATION_FAILED"
  | "DOCUMENT_NOT_AVAILABLE"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<AdminErrorCode, string> = {
  AUTHORIZATION_DENIED: "You don't have permission to perform this action.",
  DATABASE_UNAVAILABLE: "The admin database isn't available right now. Please try again shortly.",
  VALIDATION_ERROR: "Please check the form and try again.",
  NOT_FOUND: "That record could not be found.",
  CONFLICT: "This action conflicts with an existing record. Please review and try again.",
  ACCOUNT_PROVISIONING_FAILED: "The account action could not be completed. No account was created or changed.",
  IMPORT_VALIDATION_FAILED: "The import file could not be validated. Please review the errors and try again.",
  CERTIFICATE_NOT_FOUND: "That certificate record could not be found.",
  CERTIFICATE_NOT_EDITABLE: "This certificate can no longer be edited.",
  INVALID_CERTIFICATE_CONTEXT: "Please check the certificate type, program, tournament, and achievement selections and try again.",
  INVALID_TRANSITION: "That status change isn't allowed.",
  CERTIFICATE_NUMBER_GENERATION_FAILED: "A certificate number could not be generated. Please try again.",
  REVOCATION_REASON_REQUIRED: "Enter a reason for revoking this certificate.",
  ACHIEVEMENT_NOT_FOUND: "That achievement record could not be found.",
  ACHIEVEMENT_NOT_EDITABLE: "This achievement can no longer be edited.",
  INVALID_ACHIEVEMENT_CONTEXT: "Please check the achievement type, tournament, and placement selections and try again.",
  CERTIFICATE_NOT_ISSUED: "Only an issued certificate can generate a document.",
  GENERATION_IN_PROGRESS: "A certificate document is already being generated. Please wait for it to finish.",
  CERTIFICATE_CONTEXT_INVALID: "This certificate is missing required information and cannot generate a document.",
  PDF_GENERATION_FAILED: "The certificate document could not be generated. Please try again.",
  PDF_TOO_LARGE: "The certificate document could not be generated because it exceeded the size limit.",
  STORAGE_UNAVAILABLE: "Certificate storage is currently unavailable. Please try again shortly.",
  DOCUMENT_FINALIZATION_FAILED: "The certificate document could not be finalized. Please try again.",
  DOCUMENT_NOT_AVAILABLE: "This certificate document is not available.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function getSafeAdminMessage(code: AdminErrorCode): string {
  return SAFE_MESSAGES[code];
}

/**
 * Logs an admin event WITHOUT PII — no full student/parent/coach
 * payloads, no names/DOB/phone/email/address/notes, no passwords or
 * tokens. Safe to send to any log aggregator.
 */
export function logAdminEvent(params: {
  area:
    | "students"
    | "parents"
    | "coaches"
    | "batches"
    | "schedules"
    | "enrollments"
    | "accounts"
    | "import"
    | "audit_log"
    | "overview"
    | "certificates"
    | "achievements";
  code: AdminErrorCode;
  correlationId?: string;
}) {
  console.error("[admin-event]", {
    area: params.area,
    code: params.code,
    correlationId: params.correlationId,
    timestamp: new Date().toISOString(),
  });
}

export interface AdminActionResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}
