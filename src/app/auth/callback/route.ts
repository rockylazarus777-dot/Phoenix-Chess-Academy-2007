import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/getCurrentProfile";
import { getRoleHome } from "@/lib/auth/roles";
import { resolveSafeInternalPath } from "@/lib/auth/safeRedirect";
import { logAuthEvent } from "@/lib/auth/errors";

/**
 * Supabase Auth callback — exchanges a one-time `code` for a session.
 * Used by both the password-recovery email link (`?next=/reset-password`)
 * and, in the future, any other Supabase-issued auth link.
 *
 * Security notes:
 *  - `code` is single-use and expires; a failed exchange redirects to a
 *    safe `/login?error=SESSION_ERROR` — never a raw Supabase error, and
 *    the code itself is never put in a redirect URL.
 *  - `next` is validated by `resolveSafeInternalPath` before use — only
 *    an internal relative path is ever honored, closing the open-redirect
 *    path an attacker-crafted callback link could otherwise attempt.
 *  - When `next` is absent (the normal, non-recovery sign-in case), the
 *    profile is resolved and the user is sent to their role home; a
 *    missing/inactive profile never grants access, matching
 *    requireRole()'s behavior.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = resolveSafeInternalPath(url.searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=AUTH_UNAVAILABLE", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=SESSION_ERROR", request.url));
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logAuthEvent({ event: "auth_callback", code: "SESSION_ERROR" });
    return NextResponse.redirect(new URL("/login?error=SESSION_ERROR", request.url));
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
