import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type {
  CoachBatchProgressRow,
  CoachProgressDetailRow,
  CoachProgressListRow,
  CoachStudentProgressRow,
} from "@/lib/supabase/types";

/**
 * "Student Progress" — every evaluation visible under the coach historical
 * read rule (evaluation.coach_id = current coach OR coach currently manages
 * evaluation.batch_id). See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach
 * Progress Query Architecture".
 */
export async function listCoachProgressEvaluations(): Promise<CoachQueryResult<CoachProgressListRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_progress_evaluations" as never, {} as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachProgressListRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Single evaluation detail + aggregated area ratings for
 * `/coach/progress/[evaluationId]`. Returns `null` data when the RPC's
 * historical-read-rule join yields no row — an invalid UUID, a nonexistent
 * evaluation, and a real evaluation outside the coach's read rule all
 * collapse into this same empty result; the page renders `notFound()` for
 * all three (see "Session Enumeration Protection" precedent from Phase 14,
 * applied here as "Evaluation Enumeration Protection").
 */
export async function getCoachProgressEvaluation(evaluationId: string): Promise<CoachQueryResult<CoachProgressDetailRow | null>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_progress_evaluation" as never, {
      target_evaluation_id: evaluationId,
    } as never);

    if (error) return coachQueryUnknownError();
    const rows = (data ?? []) as unknown as CoachProgressDetailRow[];
    return coachQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Batch-scoped list for `/coach/batches/[batchId]/progress`. `batchId` must
 * already have passed `getAssignedBatch()` authorization at the page level;
 * the RPC's own `coach_has_batch(target_batch_id)` check is the backstop,
 * not the only check.
 */
export async function listCoachBatchProgress(batchId: string): Promise<CoachQueryResult<CoachBatchProgressRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_batch_progress" as never, {
      target_batch_id: batchId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachBatchProgressRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * One student's evaluation history within one batch, for
 * `/coach/batches/[batchId]/students/[studentId]/progress`. Both `batchId`
 * and `studentId` must already have passed page-level authorization
 * (`getAssignedBatch()` + roster membership); the RPC independently
 * re-verifies both `coach_has_batch()` and `student_in_batch_roster()`.
 */
export async function getCoachStudentProgressHistory(
  batchId: string,
  studentId: string,
): Promise<CoachQueryResult<CoachStudentProgressRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_student_progress" as never, {
      target_batch_id: batchId,
      target_student_id: studentId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachStudentProgressRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}
