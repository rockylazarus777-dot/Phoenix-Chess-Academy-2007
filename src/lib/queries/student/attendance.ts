import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";
import type { StudentAttendanceRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_attendance()` — a zero-argument SECURITY DEFINER RPC
 * always scoped to `current_student_id()` internally (see
 * supabase/migrations/0020_attendance_rls.sql). No `studentId` parameter
 * exists anywhere in this module — the student's own identity never
 * enters this call from browser input. Returned rows never include
 * `attendance_records.notes` (coach-only operational data) — see
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Student Attendance
 * Privacy Boundary".
 */
export async function getStudentAttendance(): Promise<StudentQueryResult<StudentAttendanceRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_attendance" as never, {} as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentAttendanceRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}
