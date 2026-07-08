import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentProgressRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_student_progress_evaluations(target_student_id)` — a
 * SECURITY DEFINER RPC that re-verifies `parent_has_student(target_student_id)`
 * internally (see supabase/migrations/0022_student_progress_rls.sql). The
 * page must already have called `getLinkedStudent()` before reaching this
 * query — this RPC is a second, independent authorization layer (defense
 * in depth), not the only one. Only PUBLISHED evaluations are ever
 * returned — DRAFT/ARCHIVED never reach this result set. Returned rows
 * never include coach contact details or internal
 * created_by/published_by identifiers. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Parent Progress Privacy".
 */
export async function getParentStudentProgressEvaluations(studentId: string): Promise<ParentQueryResult<ParentProgressRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_progress_evaluations" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentProgressRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}
