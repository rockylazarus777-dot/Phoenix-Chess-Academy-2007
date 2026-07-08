import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

/**
 * Requires a signed-in Supabase Auth session. Redirects to `/login`
 * (plain — no error code) when there is no session at all, since an
 * unauthenticated visit to a protected route is the normal, expected
 * case, not an error condition to explain. Use `requireRole()` instead
 * when the caller also needs a valid, active Phoenix profile.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
