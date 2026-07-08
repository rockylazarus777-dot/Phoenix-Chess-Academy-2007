import "server-only";
import type { User } from "@supabase/supabase-js";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Resolves the current Supabase Auth user from the request's own session
 * cookies (never the service-role client). Returns `null` — never
 * throws — both when there is no session and when Supabase isn't
 * configured at all, so every caller can treat "not signed in" and
 * "auth not available yet" as the same safe, unauthenticated case.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;
  return data.user;
}
