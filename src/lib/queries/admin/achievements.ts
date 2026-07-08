import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminAchievementListRow, AdminAchievementDetailRow } from "@/lib/supabase/types";

/**
 * Admin achievement query module — same session-client architecture as
 * `src/lib/queries/admin/certificates.ts`. Every caller (a page
 * component) has already run `requirePermission("VIEW_ACHIEVEMENTS")` —
 * this module does not re-authorize, it only queries.
 */
export async function listAdminAchievements(): Promise<AdminQueryResult<AdminAchievementListRow[]>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_admin_achievements" as never, {} as never);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as AdminAchievementListRow[]);
  } catch {
    return queryUnavailable();
  }
}

/**
 * Single achievement detail for `/admin/achievements/[achievementId]`.
 * Returns `null` data when the RPC yields no row — an invalid UUID and a
 * nonexistent achievement both collapse into this same empty result; the
 * page renders `notFound()` for both.
 */
export async function getAdminAchievement(achievementId: string): Promise<AdminQueryResult<AdminAchievementDetailRow | null>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_admin_achievement" as never, {
      target_achievement_id: achievementId,
    } as never);

    if (error) return queryUnknownError();
    const rows = (data ?? []) as unknown as AdminAchievementDetailRow[];
    return queryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return queryUnavailable();
  }
}

/**
 * Narrow, server-side-filtered achievement list for ONE student — used
 * only to populate the certificate form's optional "linked achievement"
 * select once a student is selected. Filters `get_admin_achievements()`'s
 * full result down to `student_id` matches before returning — the client
 * never receives the unfiltered academy-wide list. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate-Achievement
 * Relationship".
 */
export async function listAdminAchievementsForStudent(studentId: string): Promise<AdminQueryResult<AdminAchievementListRow[]>> {
  const result = await listAdminAchievements();
  if (!result.ok) return result;
  return queryOk(result.data.filter((row) => row.student_id === studentId));
}
