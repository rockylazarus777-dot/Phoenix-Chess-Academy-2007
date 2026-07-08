import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { CoachRosterStudentRow } from "@/lib/supabase/types";

/**
 * Calls `get_coach_batch_roster(target_batch_id)` — a SECURITY DEFINER
 * RPC that re-verifies the coach/batch assignment internally (via
 * `coach_has_batch()`) and returns only
 * `student_id/student_code/full_name/current_level/status/fide_id/
 * fide_rating/assignment_status` — never DOB/address/email/phone/
 * whatsapp/notes/chess_association_id/parent data. This is
 * deliberately NOT a `.from("students").select()` call — `students` has
 * no coach-facing RLS policy at all (see
 * supabase/migrations/0018_coach_portal_rls.sql, "Students Table
 * Privacy Decision"). Passing an unauthorized `batchId` simply returns
 * an empty array.
 */
export async function getCoachBatchRoster(batchId: string): Promise<CoachQueryResult<CoachRosterStudentRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_batch_roster" as never, {
      target_batch_id: batchId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachRosterStudentRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}
