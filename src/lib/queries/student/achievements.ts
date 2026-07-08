import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";
import type { StudentAchievementDetailRow, StudentAchievementListRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_achievements()` — a zero-argument SECURITY DEFINER
 * RPC always scoped to `current_student_id()` internally, returning only
 * PUBLISHED/ARCHIVED achievements. DRAFT never appears. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Achievement
 * Routes".
 */
export async function getStudentAchievements(): Promise<StudentQueryResult<StudentAchievementListRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_achievements" as never, {} as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentAchievementListRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}

/**
 * Single achievement detail for `/portal/achievements/[achievementId]`.
 * The RPC requires achievement.student_id = current_student_id() AND
 * status IN ('PUBLISHED','ARCHIVED'); an unauthorized, DRAFT, or
 * nonexistent achievement all yield `null`.
 */
export async function getStudentAchievement(achievementId: string): Promise<StudentQueryResult<StudentAchievementDetailRow | null>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_achievement" as never, {
      target_achievement_id: achievementId,
    } as never);

    if (error) return studentQueryUnknownError();
    const rows = (data ?? []) as unknown as StudentAchievementDetailRow[];
    return studentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return studentQueryUnavailable();
  }
}
