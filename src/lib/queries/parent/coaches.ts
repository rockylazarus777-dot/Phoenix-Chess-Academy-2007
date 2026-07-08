import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentBatchCoachRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_linked_student_batch_coaches(target_student_id)` — a
 * SECURITY DEFINER RPC that re-verifies the parent/student relationship
 * internally (via `parent_has_student()`) and returns only `batch_id`/
 * `coach_id`/`full_name`/`role` per coach, never email/phone/whatsapp/
 * bio. This is deliberately NOT a `.from("coaches").select()` call —
 * `coaches` has no parent-facing RLS policy at all (see
 * supabase/migrations/0017_parent_portal_rls.sql). Passing an
 * unauthorized `studentId` simply returns an empty array — the RPC
 * cannot be used to confirm or enumerate another family's student.
 */
export async function listParentLinkedStudentBatchCoaches(studentId: string): Promise<ParentQueryResult<ParentBatchCoachRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_linked_student_batch_coaches" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentBatchCoachRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}
