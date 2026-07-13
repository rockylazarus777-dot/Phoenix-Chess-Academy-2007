import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getRoleHome } from "@/lib/auth/roles";
import { resolveSafeInternalPath } from "@/lib/auth/safeRedirect";
import { logAuthEvent } from "@/lib/auth/errors";

/**
 * Supabase Auth callback — exchanges a one-time `code` for a session.
 * Used by the password-recovery email link (`?next=/reset-password`), the
 * account-invite email link (`?next=/accept-invite`, set by
 * `inviteUserByEmail`'s `redirectTo` in
 * src/lib/actions/admin/accounts.ts), and, in the future, any other
 * Supabase-issued auth link.
 *
 * Security notes:
 *  - `code` is single-use and expires; a failed exchange redirects to a
 *    safe `/login?error=SESSION_ERROR` — never a raw Supabase error, and
 *    the code itself is never put in a redirect URL. The one exception is
 *    the accept-invite path (`next=/accept-invite`): a failed/expired/
 *    already-consumed invite code redirects to `/accept-invite` itself
 *    instead of `/login`, since that page already renders a dedicated,
 *    friendlier "invitation expired, ask your administrator" message for
 *    exactly this no-session case (see `/accept-invite`'s own doc
 *    comment). This is the same failure this route sees when GoTrue's own
 *    `/verify` step rejects the token before ever issuing a `code` at all
 *    (e.g. an already-expired invite, or an email client/security scanner
 *    that pre-fetched and consumed the single-use link before the real
 *    click) — GoTrue redirects straight here with no `code` query param,
 *    which is handled identically to an exchange failure below.
 *  - `next` is validated by `resolveSafeInternalPath` before use — only
 *    an internal relative path is ever honored, closing the open-redirect
 *    path an attacker-crafted callback link could otherwise attempt.
 *  - When `next` is absent (the normal, non-recovery sign-in case), the
 *    profile is resolved and the user is sent to their role home; a
 *    missing/inactive profile never grants access, matching
 *    requireRole()'s behavior.
 */
const ACCEPT_INVITE_PATH = "/accept-invite";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = resolveSafeInternalPath(url.searchParams.get("next"));
  const failureRedirect =
    safeNext === ACCEPT_INVITE_PATH ? ACCEPT_INVITE_PATH : "/login?error=SESSION_ERROR";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=AUTH_UNAVAILABLE", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(failureRedirect, request.url));
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logAuthEvent({ event: "auth_callback", code: "SESSION_ERROR" });
    return NextResponse.redirect(new URL(failureRedirect, request.url));
  }

  // Password-recovery flow (and any other explicitly-requested internal
  // destination) — land there directly; the destination page itself
  // (e.g. /reset-password) is responsible for what happens next.
  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  // Normal sign-in callback — resolve the profile the same way
  // requireRole() does: no profile or inactive profile never grants
  // portal access.
  const profile = await getCurrentProfile();

  if (!profile) {
    logAuthEvent({ event: "auth_callback", code: "PROFILE_MISSING" });
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=PROFILE_MISSING", request.url));
  }

  if (!profile.active) {
    logAuthEvent({ event: "auth_callback", code: "ACCOUNT_UNAVAILABLE" });
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=ACCOUNT_UNAVAILABLE", request.url));
  }

  return NextResponse.redirect(new URL(getRoleHome(profile.role), request.url));
}
