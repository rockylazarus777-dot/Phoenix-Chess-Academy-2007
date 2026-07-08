import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentAttendanceRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_student_attendance(target_student_id)` — a SECURITY
 * DEFINER RPC that re-verifies `parent_has_student(target_student_id)`
 * internally (see supabase/migrations/0020_attendance_rls.sql). The page
 * must already have called `getLinkedStudent()` before reaching this
 * query — this RPC is a second, independent authorization layer, not the
 * only one. Returned rows never include `attendance_records.notes`
 * (coach-only operational data). See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Parent Attendance
 * Privacy Boundary".
 */
export async function getParentStudentAttendance(studentId: string): Promise<ParentQueryResult<ParentAttendanceRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_attendance" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentAttendanceRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}
