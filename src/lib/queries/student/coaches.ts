import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  studentQueryOk,
  studentQueryUnavailable,
  studentQueryUnknownError,
  type StudentQueryResult,
} from "@/lib/portal/queryResult";
import type { StudentBatchCoachRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_batch_coaches()` — a SECURITY DEFINER RPC that
 * resolves the caller's own batches internally (via `auth.uid()`) and
 * returns only `id`/`full_name`/`role` per coach, never email/phone/
 * whatsapp/bio. This is deliberately NOT a `.from("coaches").select()`
 * call — `coaches` has no student-facing RLS policy at all (see
 * supabase/migrations/0016_student_portal_rls.sql, "Coach Display
 * Privacy Boundary"). No parameters are passed — the function cannot
 * be asked to return another student's coaches.
 */
export async function listStudentBatchCoaches(): Promise<StudentQueryResult<StudentBatchCoachRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_batch_coaches" as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentBatchCoachRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}
