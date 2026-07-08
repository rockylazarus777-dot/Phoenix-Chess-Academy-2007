"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/uuid";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getAuthorizedBatchStudent } from "@/lib/coach/progressAuthorization";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  assignmentActionError,
  assignmentActionOk,
  type CoachAssignmentActionResult,
} from "@/lib/coach/assignmentActionResult";
import {
  createAssignmentSchema,
  reviewSubmissionSchema,
  updateAssignmentSchema,
  type CreateAssignmentValues,
  type ReviewSubmissionValues,
  type UpdateAssignmentValues,
} from "@/lib/validation/assignments";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function dueAtToTimestamp(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Every Server Action in this file re-resolves the current coach and
 * re-authorizes the target batch/student/assignment/submission
 * server-side — never trusts a batchId/studentId/assignmentId/
 * submissionId the browser submitted, and never accepts
 * coachId/createdBy/publishedBy/reviewedBy from the client. All writes
 * call the six narrow RPCs (create_/update_/publish_/archive_assignment,
 * submit_assignment, review_assignment_submission) — this file never
 * issues a direct `.from("assignments")`/`.from("assignment_submissions")`
 * insert/update. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Create/Update/
 * Publish/Archive Assignment RPC" and "Coach Review RPC".
 */
export async function createAssignment(input: CreateAssignmentValues): Promise<CoachAssignmentActionResult<{ id: string }>> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return assignmentActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return assignmentActionError("NOT_AUTHORIZED");

  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) return assignmentActionError("VALIDATION_ERROR");

  // Defense in depth: re-authorize the submitted batch (and, for STUDENT
  // audience, the submitted student's membership in that batch) AFTER
  // validation, even though the RPC re-verifies both internally — this
  // gives a clean, safe action result instead of a raw RPC error for the
  // common "stale form" case.
  const assignedBatch = await getAssignedBatch(identity.coach.id, parsed.data.batchId);
  if (!assignedBatch.ok) {
    return assignmentActionError(assignedBatch.reason === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_AUTHORIZED");
  }

  if (parsed.data.audienceType === "STUDENT") {
    const authorizedStudent = await getAuthorizedBatchStudent(parsed.data.batchId, parsed.data.studentId as string);
    if (!authorizedStudent.ok) {
      return assignmentActionError(authorizedStudent.reason === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_AUTHORIZED");
    }
  }

  if (!isSupabaseConfigured()) return assignmentActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_assignment" as never, {
      target_title: parsed.data.title,
      target_description: parsed.data.description,
      target_instructions: emptyToNull(parsed.data.instructions),
      target_audience_type: parsed.data.audienceType,
      target_batch_id: parsed.data.batchId,
      target_student_id: parsed.data.audienceType === "STUDENT" ? parsed.data.studentId : null,
      target_program_id: emptyToNull(parsed.data.programId),
      target_session_id: emptyToNull(parsed.data.sessionId),
      target_due_at: dueAtToTimestamp(parsed.data.dueAt),
      target_allow_late_submission: parsed.data.allowLateSubmission,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("NOT_AUTHORIZED")) return assignmentActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return assignmentActionError("VALIDATION_ERROR");
      return assignmentActionError("UNKNOWN");
    }

    const id = data as unknown as string;
    revalidatePath("/coach/assignments");
    revalidatePath(`/coach/batches/${parsed.data.batchId}/assignments`);
    return assignmentActionOk({ id });
  } catch {
    return assignmentActionError("DATABASE_UNAVAILABLE");
  }
}

export async function updateAssignment(input: UpdateAssignmentValues): Promise<CoachAssignmentActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return assignmentActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return assignmentActionError("NOT_AUTHORIZED");

  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) return assignmentActionError("VALIDATION_ERROR");

  if (!isSupabaseConfigured()) return assignmentActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("update_assignment" as never, {
      target_assignment_id: parsed.data.assignmentId,
      target_title: parsed.data.title,
      target_description: parsed.data.description,
      target_instructions: emptyToNull(parsed.data.instructions),
      target_program_id: emptyToNull(parsed.data.programId),
      target_session_id: emptyToNull(parsed.data.sessionId),
      target_due_at: dueAtToTimestamp(parsed.data.dueAt),
      target_allow_late_submission: parsed.data.allowLateSubmission,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("ASSIGNMENT_NOT_FOUND")) return assignmentActionError("ASSIGNMENT_NOT_FOUND");
      if (message.includes("ASSIGNMENT_NOT_EDITABLE")) return assignmentActionError("ASSIGNMENT_NOT_EDITABLE");
      if (message.includes("NOT_AUTHORIZED")) return assignmentActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return assignmentActionError("VALIDATION_ERROR");
      return assignmentActionError("UNKNOWN");
    }

    revalidatePath(`/coach/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/coach/assignments");
    return assignmentActionOk();
  } catch {
    return assignmentActionError("DATABASE_UNAVAILABLE");
  }
}

async function transitionAssignment(
  assignmentId: string,
  rpcName: "publish_assignment" | "archive_assignment",
): Promise<CoachAssignmentActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return assignmentActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return assignmentActionError("NOT_AUTHORIZED");
  if (!isUuid(assignmentId)) return assignmentActionError("ASSIGNMENT_NOT_FOUND");
  if (!isSupabaseConfigured()) return assignmentActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc(rpcName as never, {
      target_assignment_id: assignmentId,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("ASSIGNMENT_NOT_FOUND")) return assignmentActionError("ASSIGNMENT_NOT_FOUND");
      if (message.includes("NO_RECIPIENTS")) return assignmentActionError("NO_RECIPIENTS");
      if (message.includes("VALIDATION_ERROR")) return assignmentActionError("VALIDATION_ERROR");
      if (message.includes("INVALID_TRANSITION")) return assignmentActionError("INVALID_TRANSITION");
      if (message.includes("NOT_AUTHORIZED")) return assignmentActionError("NOT_AUTHORIZED");
      return assignmentActionError("UNKNOWN");
    }

    revalidatePath(`/coach/assignments/${assignmentId}`);
    revalidatePath("/coach/assignments");
    return assignmentActionOk();
  } catch {
    return assignmentActionError("DATABASE_UNAVAILABLE");
  }
}

/** "Publish Assignment" — the only path DRAFT -> PUBLISHED (atomically snapshots assignment_recipients). */
export async function publishAssignment(assignmentId: string): Promise<CoachAssignmentActionResult> {
  return transitionAssignment(assignmentId, "publish_assignment");
}

/** "Archive Assignment" — the only Coach Portal path DRAFT|PUBLISHED -> ARCHIVED. Preserves recipients/submissions; blocks only new submissions going forward. */
export async function archiveAssignment(assignmentId: string): Promise<CoachAssignmentActionResult> {
  return transitionAssignment(assignmentId, "archive_assignment");
}

/**
 * "Mark Reviewed" / "Request Revision" — the only path a coach reviews a
 * submission. Author-only mutation: a continuity-only coach (assigned to
 * the batch but not the assignment's author) cannot overwrite the
 * author's feedback — the RPC itself enforces this, this action never
 * attempts to bypass it.
 */
export async function reviewAssignmentSubmission(
  assignmentId: string,
  input: ReviewSubmissionValues,
): Promise<CoachAssignmentActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return assignmentActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return assignmentActionError("NOT_AUTHORIZED");

  const parsed = reviewSubmissionSchema.safeParse(input);
  if (!parsed.success) return assignmentActionError("VALIDATION_ERROR");

  if (!isSupabaseConfigured()) return assignmentActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("review_assignment_submission" as never, {
      target_submission_id: parsed.data.submissionId,
      target_status: parsed.data.status,
      target_feedback: emptyToNull(parsed.data.feedback),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("SUBMISSION_NOT_FOUND")) return assignmentActionError("SUBMISSION_NOT_FOUND");
      if (message.includes("REVISION_FEEDBACK_REQUIRED")) return assignmentActionError("REVISION_FEEDBACK_REQUIRED");
      if (message.includes("NOT_AUTHORIZED")) return assignmentActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return assignmentActionError("VALIDATION_ERROR");
      return assignmentActionError("UNKNOWN");
    }

    revalidatePath(`/coach/assignments/${assignmentId}/submissions/${parsed.data.submissionId}`);
    revalidatePath(`/coach/assignments/${assignmentId}/submissions`);
    return assignmentActionOk();
  } catch {
    return assignmentActionError("DATABASE_UNAVAILABLE");
  }
}
