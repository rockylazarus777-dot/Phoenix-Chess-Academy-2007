"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin/uuid";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachActionError, coachActionOk, type CoachActionResult } from "@/lib/coach/actionResult";
import {
  createClassSessionSchema,
  markAttendanceSchema,
  type CreateClassSessionValues,
  type MarkAttendanceValues,
} from "@/lib/validation/classSession";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Every Server Action in this file re-resolves the current coach and
 * (where relevant) re-authorizes the target batch/session server-side —
 * never trusts a batchId/sessionId the browser submitted, and never
 * accepts coachId/createdBy/markedBy from the client. Uses the
 * authenticated (RLS-scoped) Supabase server client throughout — never
 * the service-role client — per
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Coach Session Query
 * Architecture".
 */
export async function createClassSession(input: CreateClassSessionValues): Promise<CoachActionResult<{ id: string }>> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return coachActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return coachActionError("NOT_AUTHORIZED");

  const parsed = createClassSessionSchema.safeParse(input);
  if (!parsed.success) return coachActionError("VALIDATION_ERROR");

  // SESSION CREATION WRITE SECURITY: re-authorize the submitted batch
  // through batch_coaches AFTER validation, even though the RLS INSERT
  // policy (class_sessions_insert_for_assigned_coach) would reject an
  // unassigned batch anyway — this gives a clean, safe action result
  // instead of a raw insert error.
  const assigned = await getAssignedBatch(identity.coach.id, parsed.data.batchId);
  if (!assigned.ok) {
    return coachActionError(assigned.reason === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "NOT_AUTHORIZED");
  }

  if (!isSupabaseConfigured()) return coachActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .insert({
        batch_id: parsed.data.batchId,
        schedule_id: emptyToNull(parsed.data.scheduleId),
        session_date: parsed.data.sessionDate,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        timezone: parsed.data.timezone,
        training_mode: parsed.data.trainingMode || null,
        location_id: emptyToNull(parsed.data.locationId),
        topic: emptyToNull(parsed.data.topic),
        coach_notes: null,
        // Always the authenticated profile's own id — never accepted
        // from the submitted form.
        created_by: identity.profile.id,
      } as never)
      .select("id")
      .single();

    if (error) return coachActionError("UNKNOWN");

    const id = (data as unknown as { id: string }).id;
    revalidatePath("/coach/sessions");
    revalidatePath(`/coach/batches/${parsed.data.batchId}/sessions`);
    revalidatePath(`/coach/batches/${parsed.data.batchId}`);
    return coachActionOk({ id });
  } catch {
    return coachActionError("DATABASE_UNAVAILABLE");
  }
}

async function transitionSession(sessionId: string, targetStatus: "COMPLETED" | "CANCELLED"): Promise<CoachActionResult> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return coachActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return coachActionError("NOT_AUTHORIZED");
  if (!isUuid(sessionId)) return coachActionError("SESSION_NOT_FOUND");
  if (!isSupabaseConfigured()) return coachActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("transition_class_session_status" as never, {
      target_session_id: sessionId,
      target_status: targetStatus,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("SESSION_NOT_FOUND")) return coachActionError("SESSION_NOT_FOUND");
      if (message.includes("NOT_AUTHORIZED")) return coachActionError("NOT_AUTHORIZED");
      if (message.includes("INVALID_TRANSITION")) return coachActionError("INVALID_TRANSITION");
      return coachActionError("UNKNOWN");
    }

    revalidatePath(`/coach/sessions/${sessionId}`);
    revalidatePath(`/coach/sessions/${sessionId}/attendance`);
    revalidatePath("/coach/sessions");
    return coachActionOk();
  } catch {
    return coachActionError("DATABASE_UNAVAILABLE");
  }
}

/** "Mark Session Completed" — the only path SCHEDULED -> COMPLETED can happen. */
export async function completeClassSession(sessionId: string): Promise<CoachActionResult> {
  return transitionSession(sessionId, "COMPLETED");
}

/** "Cancel Session" — the only path SCHEDULED -> CANCELLED can happen. */
export async function cancelClassSession(sessionId: string): Promise<CoachActionResult> {
  return transitionSession(sessionId, "CANCELLED");
}

/**
 * Bulk attendance submission — delegates every authorization/eligibility/
 * atomicity decision to `mark_session_attendance()` (see
 * supabase/migrations/0020_attendance_rls.sql). This action only does
 * shape validation (Zod) and safe error-code mapping; it does not
 * pre-filter or "helpfully" drop unauthorized students — the RPC rejects
 * the entire payload on any single invalid/unauthorized entry, and so
 * does this action (no partial success is ever reported).
 */
export async function markSessionAttendance(input: MarkAttendanceValues): Promise<CoachActionResult<{ count: number }>> {
  const identity = await getCurrentCoach();
  if (identity.status !== "OK") return coachActionError("NOT_AUTHORIZED");
  if (identity.access === "DENIED") return coachActionError("NOT_AUTHORIZED");

  const parsed = markAttendanceSchema.safeParse(input);
  if (!parsed.success) return coachActionError("VALIDATION_ERROR");

  if (!isSupabaseConfigured()) return coachActionError("DATABASE_UNAVAILABLE");

  try {
    const supabase = await getServerSupabaseClient();
    const payload = parsed.data.entries.map((entry) => ({
      student_id: entry.studentId,
      status: entry.status,
      notes: entry.notes && entry.notes.trim().length > 0 ? entry.notes.trim() : null,
    }));

    const { data, error } = await supabase.rpc("mark_session_attendance" as never, {
      target_session_id: parsed.data.sessionId,
      attendance_payload: payload,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("SESSION_NOT_FOUND")) return coachActionError("SESSION_NOT_FOUND");
      if (message.includes("SESSION_CANCELLED")) return coachActionError("SESSION_CANCELLED");
      if (message.includes("NOT_AUTHORIZED")) return coachActionError("NOT_AUTHORIZED");
      if (message.includes("VALIDATION_ERROR")) return coachActionError("VALIDATION_ERROR");
      return coachActionError("UNKNOWN");
    }

    revalidatePath(`/coach/sessions/${parsed.data.sessionId}`);
    revalidatePath(`/coach/sessions/${parsed.data.sessionId}/attendance`);
    return coachActionOk({ count: (data as unknown as number) ?? 0 });
  } catch {
    return coachActionError("DATABASE_UNAVAILABLE");
  }
}
