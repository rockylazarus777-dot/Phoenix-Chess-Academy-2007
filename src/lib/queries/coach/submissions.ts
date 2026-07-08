import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { CoachAssignmentSubmissionDetailRow, CoachAssignmentSubmissionRow } from "@/lib/supabase/types";

/**
 * Recipient roster + narrow submission state for
 * `/coach/assignments/[assignmentId]/submissions`. `assignmentId` must
 * already have passed page-level authorization (`getCoachAssignment()`
 * returning non-null); the RPC's own historical-read-rule check is the
 * backstop. Never returns other assignments' data, never student contact
 * PII, never parent data, never payment data.
 */
export async function listAssignmentSubmissions(assignmentId: string): Promise<CoachQueryResult<CoachAssignmentSubmissionRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_assignment_submissions" as never, {
      target_assignment_id: assignmentId,
    } as never);

    if (error) return coachQueryUnknownError();
    return coachQueryOk((data ?? []) as unknown as CoachAssignmentSubmissionRow[]);
  } catch {
    return coachQueryUnavailable();
  }
}

/**
 * Single submission detail for
 * `/coach/assignments/[assignmentId]/submissions/[submissionId]`. Requires
 * `submission.assignment_id = assignmentId` inside the RPC — a mismatched
 * or unauthorized combination yields an empty result, and the page renders
 * `notFound()`.
 */
export async function getAssignmentSubmission(
  assignmentId: string,
  submissionId: string,
): Promise<CoachQueryResult<CoachAssignmentSubmissionDetailRow | null>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_coach_assignment_submission" as never, {
      target_assignment_id: assignmentId,
      target_submission_id: submissionId,
    } as never);

    if (error) return coachQueryUnknownError();
    const rows = (data ?? []) as unknown as CoachAssignmentSubmissionDetailRow[];
    return coachQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return coachQueryUnavailable();
  }
}
