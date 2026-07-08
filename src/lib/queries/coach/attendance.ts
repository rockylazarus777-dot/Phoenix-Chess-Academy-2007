import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { CoachSessionAttendanceRow } from "@/lib/supabase/types";

/**
 * Calls `get_coach_session_attendance(target_session_id)` — a SECURITY
 * DEFINER RPC that re-verifies `coach_has_batch(session.batch_id)`
 * internally and returns only the session-date-eligible roster merged
 * with any existing attendance row (null attendance_status/notes/
 * marked_at means Not Marked — never fabricated). Deliberately NOT a
 * `.from("students")` or `.from("attendance_records")` call — see
 * supabase/migrations/0020_attendance_rls.sql, "Students Table Privacy
 * Decision" (Phase 13) extended here to attendance context. Passing an
 * unauthorized `sessionId` simply returns an empty array.
 */
export async function getCoachSessionAttendance(sessionId: string): Promise<CoachQueryResult<CoachSessionAttendanceRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_session_attendance" as never, {
      target_session_id: sessionId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachSessionAttendanceRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}
