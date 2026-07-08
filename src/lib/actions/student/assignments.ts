"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  studentAssignmentActionError,
  studentAssignmentActionOk,
  type StudentAssignmentActionResult,
} from "@/lib/student/assignmentActionResult";
import { submitAssignmentSchema, type SubmitAssignmentValues } from "@/lib/validation/assignments";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The Student Portal's one mutation in Phase 16. Never accepts studentId/
 * status/submittedAt/reviewedBy/reviewedAt from the client — the server
 * always derives identity via `getCurrentStudent()` and the RPC derives
 * the rest. `submit_assignment()` independently re-verifies
 * `assignment_recipients` membership, PUBLISHED status, the deadline/
 * late-submission rule, content requirement, text length, and URL
 * protocol — this action never trusts the form as authority. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Submit Assignment RPC".
 */
export async function submitAssignment(input: SubmitAssignmentValues): Promise<StudentAssignmentActionResult<{ id: string }>> {
  const identity = await getCurrentStudent();
  if (identity.status !== "OK") return studentAssignmentActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return studentAssignmentActionError("NOT_AUTHORIZED");

  const parsed = submitAssignmentSchema.safeParse(input);
  if (!parsed.success) return studentAssignmentActionError("VALIDATION_ERROR");

  if (!isSupabaseConfigured()) return studentAssignmentActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("submit_assignment" as never, {
      target_assignment_id: parsed.data.assignmentId,
      target_submission_text: emptyToNull(parsed.data.submissionText),
      target_submission_url: emptyToNull(parsed.data.submissionUrl),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("ASSIGNMENT_NOT_FOUND")) return studentAssignmentActionError("ASSIGNMENT_NOT_FOUND");
      if (message.includes("ASSIGNMENT_NOT_PUBLISHED")) return studentAssignmentActionError("SUBMISSION_NOT_ALLOWED");
      if (message.includes("DEADLINE_PASSED")) return studentAssignmentActionError("DEADLINE_PASSED");
      if (message.includes("SUBMISSION_NOT_EDITABLE")) return studentAssignmentActionError("SUBMISSION_NOT_EDITABLE");
      if (message.includes("NOT_AUTHORIZED")) return studentAssignmentActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return studentAssignmentActionError("VALIDATION_ERROR");
      return studentAssignmentActionError("UNKNOWN");
    }

    const id = data as unknown as string;
    revalidatePath(`/portal/assignments/${parsed.data.assignmentId}`);
    revalidatePath("/portal/assignments");
    return studentAssignmentActionOk({ id });
  } catch {
    return studentAssignmentActionError("DATABASE_UNAVAILABLE");
  }
}
