import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/**
 * Browser-safe Supabase client.
 *
 * Uses only the public URL + anon key (`NEXT_PUBLIC_*` env vars) — the
 * anon key is designed to be exposed to the browser and is meaningless
 * without Row Level Security policies granting it anything. This client
 * currently has no direct table access on any sensitive table (see
 * docs/DATABASE_ARCHITECTURE.md, "RLS Strategy") — it exists so future
 * authenticated features (student/parent/coach portals, Phase 8+) have a
 * ready-made browser client rather than one instantiated ad hoc per
 * component.
 *
 * Do not import `admin.ts` here or anywhere in a Client Component — the
 * service-role key must never reach the browser bundle.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client requested but NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. " +
        "See .env.example and docs/DATABASE_ARCHITECTURE.md.",
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
