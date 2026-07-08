import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentAssignmentDetailRow, ParentAssignmentRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_student_assignments(target_student_id)` — a SECURITY
 * DEFINER RPC that re-verifies `parent_has_student(target_student_id)`
 * internally. The page must already have called `getLinkedStudent()`
 * before reaching this query — this RPC is a second, independent
 * authorization layer (defense in depth), not the only one. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Parent Assignment Query Architecture".
 */
export async function listParentStudentAssignments(studentId: string): Promise<ParentQueryResult<ParentAssignmentRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_assignments" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentAssignmentRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}

/**
 * Single assignment detail + the linked student's own submission only, for
 * `/parent/students/[studentId]/assignments/[assignmentId]`. Read-only — no
 * parent submit/edit/review RPC exists anywhere.
 */
export async function getParentStudentAssignment(
  studentId: string,
  assignmentId: string,
): Promise<ParentQueryResult<ParentAssignmentDetailRow | null>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_assignment" as never, {
      target_student_id: studentId,
      target_assignment_id: assignmentId,
    } as never);

    if (error) return parentQueryUnknownError();
    const rows = (data ?? []) as unknown as ParentAssignmentDetailRow[];
    return parentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return parentQueryUnavailable();
  }
}
