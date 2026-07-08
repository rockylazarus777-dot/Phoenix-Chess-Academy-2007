import "server-only";

/**
 * Safe auth error handling — mirrors the pattern in
 * src/lib/actions/errors.ts (public form submissions) for the same two
 * reasons: never return a raw Supabase Auth error to the browser, and
 * never log anything sensitive (see `logAuthEvent` below).
 */
export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_UNAVAILABLE"
  | "PROFILE_MISSING"
  | "AUTH_UNAVAILABLE"
  | "RATE_LIMITED"
  | "VALIDATION_FAILED"
  | "RESET_REQUEST_ACCEPTED"
  | "RESET_FAILED"
  | "SESSION_ERROR"
  | "UNKNOWN";

const SAFE_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: "That email or password isn't correct. Please try again.",
  ACCOUNT_UNAVAILABLE:
    "Your Phoenix account is currently unavailable. Please contact Phoenix Chess Academy for assistance.",
  PROFILE_MISSING:
    "We couldn't find a Phoenix account linked to this login. Please contact Phoenix Chess Academy for assistance.",
  AUTH_UNAVAILABLE: "Sign-in isn't available right now. Please try again shortly or contact us directly.",
  RATE_LIMITED: "Too many attempts in a short time. Please wait a minute and try again.",
  VALIDATION_FAILED: "Please check the form and try again.",
  RESET_REQUEST_ACCEPTED: "If an eligible Phoenix account exists for this email, password reset instructions will be sent.",
  RESET_FAILED: "This password reset link is invalid or has expired. Please request a new one.",
  SESSION_ERROR: "Your session could not be verified. Please sign in again.",
  UNKNOWN: "Something went wrong. Please try again, or contact us directly.",
};

const KNOWN_CODES = new Set<string>(Object.keys(SAFE_MESSAGES));

export function resolveAuthErrorCode(candidate: string | undefined | null): AuthErrorCode {
  const trimmed = (candidate ?? "").trim();
  return KNOWN_CODES.has(trimmed) ? (trimmed as AuthErrorCode) : "UNKNOWN";
}

export function getSafeAuthMessage(code: AuthErrorCode): string {
  return SAFE_MESSAGES[code];
}

/**
 * Logs an auth event WITHOUT any sensitive data — no passwords, access
 * tokens, refresh tokens, full session objects, auth headers, cookie
 * values, or reset links. Email is intentionally omitted from
 * production auth error logs (see docs/AUTH_ARCHITECTURE.md, "Auth
 * Logging Security") — the event category + safe code is enough to spot
 * abuse patterns without building a log of who attempted to log in.
 */
export function logAuthEvent(params: {
  event: "login" | "logout" | "forgot_password" | "reset_password" | "auth_callback" | "profile_resolution";
  code: AuthErrorCode;
  correlationId?: string;
}) {
  console.error("[auth-event]", {
    event: params.event,
    code: params.code,
    correlationId: params.correlationId,
    timestamp: new Date().toISOString(),
  });
}
