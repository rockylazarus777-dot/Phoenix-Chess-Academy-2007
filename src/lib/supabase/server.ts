import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Server-side Supabase client — cookie-aware, using the public anon key.
 *
 * SERVER ONLY (Server Components, Server Actions, Route Handlers). Cookie
 * handling follows the `@supabase/ssr` pattern so a future Supabase Auth
 * session (Phase 8+ student/parent/coach login) can read/refresh the
 * session from cookies without changing this client's shape. No
 * authentication is implemented in Phase 7 — this client is used today
 * only to call the public, narrowly-scoped SECURITY DEFINER RPC functions
 * (`submit_contact_enquiry`, `submit_trial_booking`,
 * `submit_tournament_registration`) from Server Actions. It intentionally
 * uses the anon key, not the service-role key — see admin.ts for the
 * service-role client and why it's kept separate.
 *
 * `cookies()` can only be called from a Server Component/Action/Route
 * Handler request scope — calling `getServerSupabaseClient()` outside
 * that scope will throw, which is the correct, expected failure mode.
 */
export async function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase server client requested but NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. " +
        "See .env.example and docs/DATABASE_ARCHITECTURE.md.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not a Server Action /
          // Route Handler) — cookies can't be mutated there. Safe to
          // ignore as long as session refresh also happens in
          // middleware/an Action, per the standard @supabase/ssr pattern.
          // No session refresh exists yet in Phase 7, so this branch is
          // currently unreached, but is kept for forward compatibility.
        }
      },
    },
  });
}

/**
 * Returns true when Supabase env vars are present, so calling code can
 * fail safely (a configuration-unavailable response) instead of throwing
 * when Supabase simply hasn't been configured in this environment yet —
 * see "Mode A — Frontend Only" in docs/DATABASE_ARCHITECTURE.md.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
