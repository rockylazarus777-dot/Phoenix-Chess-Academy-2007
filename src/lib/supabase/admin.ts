import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client. SERVER ONLY.
 *
 * The `import "server-only"` guard above makes any accidental import of
 * this module from a Client Component fail the build, rather than
 * silently bundling the service-role key into client JavaScript.
 *
 * This client bypasses Row Level Security entirely and must be used only
 * for genuinely privileged, server-controlled operations. In Phase 7
 * that means exactly one thing: the internal reporting-outbox sync
 * worker (`/api/internal/reporting/sync`, protected by `CRON_SECRET`)
 * reading/updating `reporting_outbox` rows — a table with zero
 * anon/authenticated RLS policies, so nothing else can reach it.
 *
 * Public form submissions (contact/trial/tournament registration) do
 * NOT use this client — they use the anon-key server client
 * (`server.ts`) to call narrowly-scoped `SECURITY DEFINER` RPC
 * functions. Do not widen this client's usage to routine form
 * submission without a clear reason; see
 * docs/DATABASE_ARCHITECTURE.md, "Public Insert Security".
 */
export function getAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client requested but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * PHASE 10 — lets every admin query module / Server Action check for
 * live configuration and fail safely (a DATABASE_UNAVAILABLE result)
 * instead of throwing, exactly like `isSupabaseConfigured()` does for
 * the anon-key client in server.ts. The admin client additionally needs
 * the service-role key, so this is a distinct check.
 */
export function isAdminSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
