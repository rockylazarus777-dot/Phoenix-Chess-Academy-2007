import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-refresh proxy (Next.js 16 renamed `middleware.ts` to
 * `proxy.ts` — see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/proxy.md, "Migration to Proxy"). This file is NOT
 * the authorization boundary for protected routes — it only refreshes
 * the Supabase Auth session cookie on every matched request, per the
 * standard `@supabase/ssr` proxy/middleware pattern, so a nearly-expired
 * access token gets refreshed before a Server Component/Action reads it.
 *
 * Every real access-control decision (role checks, active-profile
 * checks, missing-profile checks) happens in the protected layouts via
 * `requireRole()` (src/lib/auth/requireRole.ts) and, per
 * docs/AUTH_ARCHITECTURE.md, "Security Boundaries", must also happen
 * independently in any future sensitive Server Action/Route Handler.
 * Do not add role/path authorization logic here — this file is
 * deliberately coarse.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured yet (deferred live configuration) — nothing
  // to refresh, pass the request through unchanged rather than throwing.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers a token refresh (and the cookie rewrite above) when the
  // current access token is close to expiring. The return value itself
  // is unused here — this file makes no authorization decision.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every request except static assets and image optimization
     * files, so a stale session cookie never blocks CSS/JS/images from
     * loading. Metadata files (favicon, sitemap, robots) are excluded
     * too since they never need an authenticated session.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
