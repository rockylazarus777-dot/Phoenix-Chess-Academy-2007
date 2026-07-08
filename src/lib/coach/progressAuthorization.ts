import "server-only";
import { isUuid } from "@/lib/admin/uuid";
import { getCoachBatchRoster } from "@/lib/queries/coach/roster";
import type { CoachRosterStudentRow } from "@/lib/supabase/types";

export type AuthorizedBatchStudentResult =
  | { ok: true; student: CoachRosterStudentRow }
  | { ok: false; reason: "NOT_FOUND" | "DATABASE_UNAVAILABLE" };

/**
 * THE authoritative coach-to-student-within-batch authorization check for
 * `/coach/batches/[batchId]/students/[studentId]/progress` and the new-
 * evaluation form's student selection. Deliberately reuses
 * `get_coach_batch_roster()` (Phase 13) rather than introducing a second
 * roster query — "knowing studentId is never enough" (per
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student/Batch Eligibility"): the
 * caller must already have passed `getAssignedBatch()` for `batchId`
 * (this function does not re-check batch assignment itself, since
 * `get_coach_batch_roster()` already returns nothing for an unassigned
 * batch), and this function additionally confirms `studentId` is a member
 * of that specific batch's roster. An invalid UUID, a nonexistent student,
 * and a real student who isn't in this batch's roster all collapse into
 * the same NOT_FOUND reason.
 */
export async function getAuthorizedBatchStudent(batchId: string, studentId: string): Promise<AuthorizedBatchStudentResult> {
  if (!isUuid(studentId)) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  const roster = await getCoachBatchRoster(batchId);
  if (!roster.ok) {
    return { ok: false, reason: roster.code === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND" };
  }

  const student = roster.data.find((row) => row.student_id === studentId);
  if (!student) {
    return { ok: false, reason: "NOT_FOUND" };
  }

  return { ok: true, student };
}
