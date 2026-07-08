import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { CoachAssignmentDetailRow, CoachAssignmentListRow, CoachBatchAssignmentRow } from "@/lib/supabase/types";

/**
 * "Assignments" — every assignment visible under the coach historical read
 * rule (assignment.coach_id = current coach OR coach currently manages
 * assignment.batch_id). See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach
 * Assignment Query Architecture".
 */
export async function listCoachAssignments(): Promise<CoachQueryResult<CoachAssignmentListRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_assignments" as never, {} as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachAssignmentListRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Single assignment detail for `/coach/assignments/[assignmentId]`. Returns
 * `null` data when the RPC's historical-read-rule join yields no row — an
 * invalid UUID, a nonexistent assignment, and a real assignment outside the
 * coach's read rule all collapse into this same empty result; the page
 * renders `notFound()` for all three.
 */
export async function getCoachAssignment(assignmentId: string): Promise<CoachQueryResult<CoachAssignmentDetailRow | null>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_assignment" as never, {
      target_assignment_id: assignmentId,
    } as never);

    if (error) return coachQueryUnknownError();
    const rows = (data ?? []) as unknown as CoachAssignmentDetailRow[];
    return coachQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Batch-scoped list for `/coach/batches/[batchId]/assignments`. `batchId`
 * must already have passed `getAssignedBatch()` authorization at the page
 * level; the RPC's own `coach_has_batch(target_batch_id)` check is the
 * backstop, not the only check.
 */
export async function listCoachBatchAssignments(batchId: string): Promise<CoachQueryResult<CoachBatchAssignmentRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_batch_assignments" as never, {
      target_batch_id: batchId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachBatchAssignmentRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}
