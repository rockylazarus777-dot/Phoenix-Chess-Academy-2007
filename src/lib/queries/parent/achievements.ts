import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentAchievementListRow, StudentAchievementDetailRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_student_achievements(target_student_id)` — a SECURITY
 * DEFINER RPC that re-verifies `parent_has_student(target_student_id)`
 * internally. Returns only PUBLISHED/ARCHIVED achievements; DRAFT never
 * appears. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent
 * Achievement Routes".
 */
export async function listParentStudentAchievements(studentId: string): Promise<ParentQueryResult<ParentAchievementListRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_achievements" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentAchievementListRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}

/**
 * Single achievement detail for
 * `/parent/students/[studentId]/achievements/[achievementId]`. Read-only —
 * no parent achievement mutation RPC exists anywhere.
 */
export async function getParentStudentAchievement(
  studentId: string,
  achievementId: string,
): Promise<ParentQueryResult<StudentAchievementDetailRow | null>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_achievement" as never, {
      target_student_id: studentId,
      target_achievement_id: achievementId,
    } as never);

    if (error) return parentQueryUnknownError();
    const rows = (data ?? []) as unknown as StudentAchievementDetailRow[];
    return parentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return parentQueryUnavailable();
  }
}
