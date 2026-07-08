import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";
import type { StudentAssignmentDetailRow, StudentAssignmentRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_assignments()` — a zero-argument SECURITY DEFINER RPC
 * always scoped to `current_student_id()` internally, read authorization
 * deriving from `assignment_recipients` (never live batch membership). See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Student Assignment Query Architecture".
 */
export async function getStudentAssignments(): Promise<StudentQueryResult<StudentAssignmentRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_assignments" as never, {} as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentAssignmentRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}

/**
 * Single assignment detail + the current student's own submission only, for
 * `/portal/assignments/[assignmentId]`. "Knowing assignmentId is not
 * enough" — the RPC requires an `assignment_recipients` row for the
 * current student; an unauthorized or nonexistent assignment yields `null`.
 */
export async function getStudentAssignment(assignmentId: string): Promise<StudentQueryResult<StudentAssignmentDetailRow | null>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_assignment" as never, {
      target_assignment_id: assignmentId,
    } as never);

    if (error) return studentQueryUnknownError();
    const rows = (data ?? []) as unknown as StudentAssignmentDetailRow[];
    return studentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return studentQueryUnavailable();
  }
}
