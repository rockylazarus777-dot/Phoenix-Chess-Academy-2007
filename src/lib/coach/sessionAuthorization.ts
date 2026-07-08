import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/uuid";
import type { SessionStatus, TrainingMode } from "@/lib/supabase/types";

/**
 * Narrow, coach-facing view of one class session — deliberately not a
 * full `class_sessions` row (no `coach_notes`, no `created_by`,
 * no `cancelled_by`). See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md,
 * "Assigned Session Privacy Boundary".
 */
export interface CoachAssignedSession {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  programName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: SessionStatus;
  trainingMode: TrainingMode;
  locationName: string | null;
  topic: string | null;
}

export type AssignedSessionResult =
  | { ok: true; session: CoachAssignedSession }
  | { ok: false; reason: "NOT_FOUND" | "DATABASE_UNAVAILABLE" };

/**
 * THE authoritative coach-to-session authorization check for every
 * `/coach/sessions/[sessionId]*` route. The real security boundary is
 * the `class_sessions_select_for_assigned_coach` RLS policy
 * (supabase/migrations/0020_attendance_rls.sql, backed by
 * `coach_has_batch()`) — this function issues an ordinary authenticated
 * SELECT and lets RLS decide what comes back; it does not separately
 * re-implement the authorization logic in application code. `sessionId`
 * is a route parameter treated purely as a resource identifier. Invalid
 * UUID, a nonexistent session, and a real session belonging to a batch
 * the coach is not (or is no longer) assigned to all collapse into the
 * same NOT_FOUND reason — see
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session Enumeration
 * Protection".
 */
export async function getAssignedSession(sessionId: string): Promise<AssignedSessionResult> {
  if (!isUuid(sessionId)) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("class_sessions")
      .select(
        "id, batch_id, session_date, start_time, end_time, timezone, status, training_mode, topic, " +
          "batches!inner(batch_code, name, training_mode, programs(name), academy_locations(name)), " +
          "academy_locations!class_sessions_location_id_fkey(name)",
      )
      .eq("id", sessionId as never)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "DATABASE_UNAVAILABLE" };
    }
    if (!data) {
      // RLS already collapsed "doesn't exist" and "not my batch" into
      // one empty result — nothing further to distinguish here.
      return { ok: false, reason: "NOT_FOUND" };
    }

    const row = data as unknown as {
      id: string;
      batch_id: string;
      session_date: string;
      start_time: string;
      end_time: string;
      timezone: string;
      status: SessionStatus;
      training_mode: TrainingMode | null;
      topic: string | null;
      batches: {
        batch_code: string;
        name: string;
        training_mode: TrainingMode;
        programs: { name: string } | null;
        academy_locations: { name: string } | null;
      } | null;
      academy_locations: { name: string } | null;
    };

    if (!row.batches) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    return {
      ok: true,
      session: {
        id: row.id,
        batchId: row.batch_id,
        batchCode: row.batches.batch_code,
        batchName: row.batches.name,
        programName: row.batches.programs?.name ?? "—",
        sessionDate: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        timezone: row.timezone,
        status: row.status,
        // Session-level training_mode is an optional per-session
        // override; falls back to the batch's own default when null.
        trainingMode: row.training_mode ?? row.batches.training_mode,
        locationName: row.academy_locations?.name ?? row.batches.academy_locations?.name ?? null,
        topic: row.topic,
      },
    };
  } catch {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }
}
