"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/uuid";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getAuthorizedBatchStudent } from "@/lib/coach/progressAuthorization";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  progressActionError,
  progressActionOk,
  type CoachProgressActionResult,
} from "@/lib/coach/progressActionResult";
import {
  createProgressEvaluationSchema,
  updateProgressEvaluationSchema,
  type AreaRatingValues,
  type CreateProgressEvaluationValues,
  type UpdateProgressEvaluationValues,
} from "@/lib/validation/studentProgress";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toAreaRatingPayload(entries: AreaRatingValues[]) {
  return entries.map((entry) => ({
    area: entry.area,
    rating: entry.rating,
    comment: entry.comment && entry.comment.trim().length > 0 ? entry.comment.trim() : null,
  }));
}

/**
 * Every Server Action in this file re-resolves the current coach and
 * re-authorizes the target batch/student/evaluation server-side — never
 * trusts a batchId/studentId/evaluationId the browser submitted, and never
 * accepts coachId/createdBy/publishedBy from the client. All writes call
 * the four narrow RPCs (create_/update_/publish_/archive_
 * student_progress_evaluation) — this file never issues a direct
 * `.from("student_progress_evaluations")` insert/update. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Create/Update/Publish/Archive
 * Evaluation RPC".
 */
export async function createProgressEvaluation(
  input: CreateProgressEvaluationValues,
): Promise<CoachProgressActionResult<{ id: string }>> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return progressActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return progressActionError("NOT_AUTHORIZED");

  const parsed = createProgressEvaluationSchema.safeParse(input);
  if (!parsed.success) return progressActionError("VALIDATION_ERROR");

  // Defense in depth: re-authorize the submitted batch and the submitted
  // student's membership in that batch AFTER validation, even though the
  // RPC re-verifies both internally — this gives a clean, safe action
  // result instead of a raw RPC error for the common "stale form" case.
  const assignedBatch = await getAssignedBatch(identity.coach.id, parsed.data.batchId);
  if (!assignedBatch.ok) {
    return progressActionError(assignedBatch.reason === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_AUTHORIZED");
  }

  const authorizedStudent = await getAuthorizedBatchStudent(parsed.data.batchId, parsed.data.studentId);
  if (!authorizedStudent.ok) {
    return progressActionError(authorizedStudent.reason === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_AUTHORIZED");
  }

  if (!isSupabaseConfigured()) return progressActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_student_progress_evaluation" as never, {
      target_student_id: parsed.data.studentId,
      target_batch_id: parsed.data.batchId,
      target_program_id: parsed.data.programId,
      period_start: parsed.data.periodStart,
      period_end: parsed.data.periodEnd,
      summary: emptyToNull(parsed.data.summary),
      strengths_text: emptyToNull(parsed.data.strengths),
      development_focus_text: emptyToNull(parsed.data.developmentFocus),
      recommendation_text: emptyToNull(parsed.data.coachRecommendation),
      area_ratings: toAreaRatingPayload(parsed.data.areaRatings),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("NOT_AUTHORIZED")) return progressActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return progressActionError("VALIDATION_ERROR");
      return progressActionError("UNKNOWN");
    }

    const id = data as unknown as string;
    revalidatePath("/coach/progress");
    revalidatePath(`/coach/batches/${parsed.data.batchId}/progress`);
    revalidatePath(`/coach/batches/${parsed.data.batchId}/students/${parsed.data.studentId}/progress`);
    return progressActionOk({ id });
  } catch {
    return progressActionError("DATABASE_UNAVAILABLE");
  }
}

export async function updateProgressEvaluation(input: UpdateProgressEvaluationValues): Promise<CoachProgressActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return progressActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return progressActionError("NOT_AUTHORIZED");

  const parsed = updateProgressEvaluationSchema.safeParse(input);
  if (!parsed.success) return progressActionError("VALIDATION_ERROR");

  if (!isSupabaseConfigured()) return progressActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("update_student_progress_evaluation" as never, {
      target_evaluation_id: parsed.data.evaluationId,
      period_start: parsed.data.periodStart,
      period_end: parsed.data.periodEnd,
      summary: emptyToNull(parsed.data.summary),
      strengths_text: emptyToNull(parsed.data.strengths),
      development_focus_text: emptyToNull(parsed.data.developmentFocus),
      recommendation_text: emptyToNull(parsed.data.coachRecommendation),
      area_ratings: toAreaRatingPayload(parsed.data.areaRatings),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("EVALUATION_NOT_FOUND")) return progressActionError("EVALUATION_NOT_FOUND");
      if (message.includes("EVALUATION_NOT_EDITABLE")) return progressActionError("EVALUATION_NOT_EDITABLE");
      if (message.includes("NOT_AUTHORIZED")) return progressActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return progressActionError("VALIDATION_ERROR");
      return progressActionError("UNKNOWN");
    }

    revalidatePath(`/coach/progress/${parsed.data.evaluationId}`);
    revalidatePath("/coach/progress");
    return progressActionOk();
  } catch {
    return progressActionError("DATABASE_UNAVAILABLE");
  }
}

async function transitionEvaluation(
  evaluationId: string,
  rpcName: "publish_student_progress_evaluation" | "archive_student_progress_evaluation",
): Promise<CoachProgressActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return progressActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return progressActionError("NOT_AUTHORIZED");
  if (!isUuid(evaluationId)) return progressActionError("EVALUATION_NOT_FOUND");
  if (!isSupabaseConfigured()) return progressActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc(rpcName as never, {
      target_evaluation_id: evaluationId,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("EVALUATION_NOT_FOUND")) return progressActionError("EVALUATION_NOT_FOUND");
      if (message.includes("EMPTY_EVALUATION")) return progressActionError("EMPTY_EVALUATION");
      if (message.includes("INVALID_TRANSITION")) return progressActionError("INVALID_TRANSITION");
      if (message.includes("NOT_AUTHORIZED")) return progressActionError("NOT_AUTHORIZED");
      return progressActionError("UNKNOWN");
    }

    revalidatePath(`/coach/progress/${evaluationId}`);
    revalidatePath("/coach/progress");
    return progressActionOk();
  } catch {
    return progressActionError("DATABASE_UNAVAILABLE");
  }
}

/** "Publish Evaluation" — the only path DRAFT -> PUBLISHED. */
export async function publishProgressEvaluation(evaluationId: string): Promise<CoachProgressActionResult> {
  return transitionEvaluation(evaluationId, "publish_student_progress_evaluation");
}

/** "Archive Draft" — the only Coach Portal path DRAFT -> ARCHIVED. Never allows archiving a PUBLISHED evaluation (enforced server-side by the RPC). */
export async function archiveProgressEvaluation(evaluationId: string): Promise<CoachProgressActionResult> {
  return transitionEvaluation(evaluationId, "archive_student_progress_evaluation");
}
