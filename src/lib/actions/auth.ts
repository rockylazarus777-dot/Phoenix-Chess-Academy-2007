"use server";

import { redirect } from "next/navigation";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getRoleHome } from "@/lib/auth/roles";
import { getAuthRateLimiter } from "@/lib/rate-limit";
import { logAuthEvent, getSafeAuthMessage } from "@/lib/auth/errors";
import { getSiteUrl } from "@/config/site";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type LoginValues,
  type ResetPasswordValues,
} from "@/lib/validation/auth";

/**
 * Phase 9 auth Server Actions. Every action here re-validates with the
 * same Zod schemas the client uses for UX — the client pass is never
 * trusted on its own. Real authentication/authorization happens via
 * Supabase Auth (`signInWithPassword`, `updateUser`, `signOut`) and the
 * server-side profile checks in `getCurrentProfile()`, never anything
 * hand-rolled here.
 */

export interface AuthActionResult {
  success: boolean;
  message?: string;
}

/**
 * Login. On success this redirects (throws Next's special redirect
 * signal) rather than returning — callers should treat a resolved
 * promise as "did not redirect, so it must be a failure" and render
 * `message`.
 */
export async function login(input: LoginValues): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAuthMessage("AUTH_UNAVAILABLE") };
  }

  const rateLimiter = getAuthRateLimiter();
  const rateLimitResult = await rateLimiter.check(`login:${input.email.toLowerCase().trim()}`);
  if (!rateLimitResult.allowed) {
    return { success: false, message: getSafeAuthMessage("RATE_LIMITED") };
  }

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAuthMessage("VALIDATION_FAILED") };
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logAuthEvent({ event: "login", code: "INVALID_CREDENTIALS" });
    return { success: false, message: getSafeAuthMessage("INVALID_CREDENTIALS") };
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    // Supabase Auth succeeded but there is no matching Phoenix profile —
    // never grant portal access, and don't leave a lingering session
    // that has no portal access anyway.
    logAuthEvent({ event: "login", code: "PROFILE_MISSING" });
    await supabase.auth.signOut();
    return { success: false, message: getSafeAuthMessage("PROFILE_MISSING") };
  }

  if (!profile.active) {
    logAuthEvent({ event: "login", code: "ACCOUNT_UNAVAILABLE" });
    await supabase.auth.signOut();
    return { success: false, message: getSafeAuthMessage("ACCOUNT_UNAVAILABLE") };
  }

  redirect(getRoleHome(profile.role));
}

/**
 * Forgot password. Always returns the same neutral, success-shaped
 * result regardless of whether the email matches a real account, is
 * rate-limited, or Supabase isn't configured — this is deliberate
 * account-enumeration protection, not an oversight. See
 * docs/AUTH_ARCHITECTURE.md, "Account Enumeration Protection".
 */
export async function requestPasswordReset(input: ForgotPasswordValues): Promise<AuthActionResult> {
  const neutralResult: AuthActionResult = { success: true, message: getSafeAuthMessage("RESET_REQUEST_ACCEPTED") };

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    // Validation failure is safe to surface distinctly — it reveals
    // nothing about account existence, only that the typed value isn't
    // a plausible email at all.
    return { success: false, message: getSafeAuthMessage("VALIDATION_FAILED") };
  }

  if (!isSupabaseConfigured()) {
    return neutralResult;
  }

  const rateLimiter = getAuthRateLimiter();
  const rateLimitResult = await rateLimiter.check(`forgot-password:${parsed.data.email.toLowerCase().trim()}`);
  if (!rateLimitResult.allowed) {
    // Do not reveal that rate limiting triggered — return the exact same
    // neutral message as a normal request so timing/response shape never
    // hints at account existence or abuse detection.
    logAuthEvent({ event: "forgot_password", code: "RATE_LIMITED" });
    return neutralResult;
  }

  const supabase = await getServerSupabaseClient();
  const redirectTo = `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  // Deliberately ignore any error detail from Supabase here — whether
  // the email exists, is unconfirmed, or belongs to a disabled account,
  // the response to the browser must be identical.

  return neutralResult;
}

/**
 * Reset password. Requires an active Supabase recovery session (created
 * by /auth/callback exchanging the emailed code) — this action does not
 * accept an email/token itself. After a successful update, the session
 * is deliberately signed out and the caller is sent through the normal
 * login flow rather than granted immediate portal access, so profile/
 * active checks always happen fresh. See docs/AUTH_ARCHITECTURE.md,
 * "Reset Password Architecture" for why this option was chosen over
 * redirecting straight to the role home.
 */
export async function updatePassword(input: ResetPasswordValues): Promise<AuthActionResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAuthMessage("AUTH_UNAVAILABLE") };
  }

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAuthMessage("VALIDATION_FAILED") };
  }

  const supabase = await getServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    // No valid recovery session — the link was already used, expired, or
    // never exchanged successfully.
    logAuthEvent({ event: "reset_password", code: "RESET_FAILED" });
    return { success: false, message: getSafeAuthMessage("RESET_FAILED") };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logAuthEvent({ event: "reset_password", code: "RESET_FAILED" });
    return { success: false, message: getSafeAuthMessage("RESET_FAILED") };
  }

  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

/**
 * Logout. Redirects to the public homepage (chosen consistently over
 * `/login` — see docs/AUTH_ARCHITECTURE.md, "Logout Architecture").
 * Uses Supabase's own `signOut()` to clear the session through the
 * supported cookie architecture — never manually deletes cookies by
 * guessed names.
 */
export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getServerSupabaseClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}
