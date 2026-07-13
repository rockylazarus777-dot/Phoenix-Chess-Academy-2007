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
 * `acceptInvite()`'s result additionally distinguishes "the password
 * itself was created but the follow-up activation step failed" from
 * every other failure — see `finishAcceptInvite()` below.
 */
export interface AcceptInviteResult extends AuthActionResult {
  /**
   * True only when `supabase.auth.updateUser({ password })` already
   * succeeded but `activate_own_profile()` did not. The password is
   * already set at that point — `AcceptInviteForm` shows a distinct
   * "Retry Activation" view (no password fields) rather than asking for
   * the password again.
   */
  activationFailed?: boolean;
}

/**
 * Shared tail end of invite acceptance, used by both `acceptInvite()`
 * (right after the password is set) and `retryProfileActivation()` (the
 * "Retry Activation" button, when only this step needs re-running).
 * Calls `activate_own_profile()` — a SECURITY DEFINER RPC
 * (supabase/migrations/0029_profile_activation.sql) that is the only
 * path allowed to flip `profiles.active` true for an invited account,
 * and only once, ever, per profile (see the migration's own comment) —
 * this Server Action never writes `profiles.active` directly, and the
 * client can never reach this table at all (`Insert`/`Update` are typed
 * `never` — see docs/AUTH_ARCHITECTURE.md, "Profile Requirement
 * Enforcement"). If activation fails, onboarding is deliberately left
 * incomplete (not silently treated as done) so the caller can retry
 * rather than land in a portal with a still-inactive profile.
 */
async function finishAcceptInvite(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
): Promise<AcceptInviteResult> {
  const { error: activateError } = await supabase.rpc("activate_own_profile" as never);

  if (activateError) {
    logAuthEvent({ event: "accept_invite", code: "ACTIVATION_FAILED" });
    return { success: false, activationFailed: true, message: getSafeAuthMessage("ACTIVATION_FAILED") };
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    logAuthEvent({ event: "accept_invite", code: "PROFILE_MISSING" });
    await supabase.auth.signOut();
    return { success: false, message: getSafeAuthMessage("PROFILE_MISSING") };
  }

  if (!profile.active) {
    // The RPC call itself didn't error, but the profile still isn't
    // active — shouldn't happen given activate_own_profile()'s own
    // logic, but treated as a retryable activation failure rather than
    // silently granting or permanently denying access.
    logAuthEvent({ event: "accept_invite", code: "ACTIVATION_FAILED" });
    return { success: false, activationFailed: true, message: getSafeAuthMessage("ACTIVATION_FAILED") };
  }

  redirect(getRoleHome(profile.role));
}

/**
 * Accept invite. Requires an active Supabase invite session (created by
 * /auth/callback exchanging the emailed invite code, `next=/accept-invite`
 * — see src/lib/actions/admin/accounts.ts's `redirectTo`) — this action
 * does not accept an email or token itself, mirroring `updatePassword()`'s
 * own session check. Deliberately does NOT sign the session back out on
 * success, unlike `updatePassword()`: accepting an invite should land the
 * invited coach/parent/student straight in their portal via
 * `getRoleHome()`, not send them back through `/login`. See
 * docs/AUTH_ARCHITECTURE.md, "Accept Invite Architecture".
 */
export async function acceptInvite(input: ResetPasswordValues): Promise<AcceptInviteResult> {
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
    // No valid invite session — the link was already used, expired, or
    // never exchanged successfully.
    logAuthEvent({ event: "accept_invite", code: "INVITE_EXPIRED" });
    return { success: false, message: getSafeAuthMessage("INVITE_EXPIRED") };
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (passwordError) {
    logAuthEvent({ event: "accept_invite", code: "INVITE_EXPIRED" });
    return { success: false, message: getSafeAuthMessage("INVITE_EXPIRED") };
  }

  return finishAcceptInvite(supabase);
}

/**
 * "Retry Activation" action for `AcceptInviteForm` — used only after
 * `acceptInvite()` already set the password successfully but
 * `activate_own_profile()` failed. Does not accept or re-set a
 * password; just re-verifies the session and re-runs activation.
 */
export async function retryProfileActivation(): Promise<AcceptInviteResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAuthMessage("AUTH_UNAVAILABLE") };
  }

  const supabase = await getServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    logAuthEvent({ event: "accept_invite", code: "INVITE_EXPIRED" });
    return { success: false, message: getSafeAuthMessage("INVITE_EXPIRED") };
  }

  return finishAcceptInvite(supabase);
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
