import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/uuid";
import type { BatchCoachRole, BatchStatus, TrainingMode } from "@/lib/supabase/types";

/**
 * Narrow, coach-facing view of an assigned batch — deliberately not a
 * full `batches` row (no internal notes, no capacity unless useful,
 * no other coaches' contact data). See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Assigned Batch Privacy Boundary".
 */
export interface CoachAssignedBatch {
  id: string;
  batchCode: string;
  name: string;
  status: BatchStatus;
  trainingMode: TrainingMode;
  level: string | null;
  programId: string | null;
  programName: string;
  programSlug: string | null;
  locationId: string | null;
  locationName: string | null;
  assignmentRole: BatchCoachRole;
  assignedAt: string;
}

export type AssignedBatchResult =
  | { ok: true; batch: CoachAssignedBatch }
  | { ok: false; reason: "NOT_FOUND" | "DATABASE_UNAVAILABLE" };

/**
 * THE authoritative coach-to-batch authorization check for every
 * `/coach/batches/[batchId]*` route. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "Coach-to-Batch Authorization" and
 * "Batch Enumeration Protection".
 *
 * IMPORTANT: this does not query `batches` first and then decide
 * whether to show it — the query IS the `batch_coaches` relationship
 * join (`.eq("coach_id", coachId).eq("batch_id", batchId)` with
 * `batches!inner(...)`, additionally requiring `ended_at is null` so an
 * ended assignment is treated the same as no assignment at all — an
 * ended coach assignment means the coach no longer has access to that
 * batch's operational data). `coachId` must come only from
 * `getCurrentCoach()`, never from browser input; `batchId` is a route
 * parameter treated purely as a resource identifier.
 *
 * Invalid UUID, a UUID with no matching batch, and a real batch the
 * coach is not (or is no longer) assigned to all return the same
 * `NOT_FOUND` reason — every caller renders `notFound()` for all three,
 * so a coach who guesses another batch's UUID cannot distinguish
 * "doesn't exist" from "isn't mine" from the response.
 */
export async function getAssignedBatch(coachId: string, batchId: string): Promise<AssignedBatchResult> {
  if (!isUuid(batchId)) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("batch_coaches")
      .select(
        "role, assigned_at, batches!inner(id, batch_code, name, status, training_mode, level, programs(id, name, slug), academy_locations(id, name))",
      )
      .eq("coach_id", coachId as never)
      .eq("batch_id", batchId as never)
      .is("ended_at", null as never)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "DATABASE_UNAVAILABLE" };
    }
    if (!data) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    const row = data as unknown as {
      role: BatchCoachRole;
      assigned_at: string;
      batches: {
        id: string;
        batch_code: string;
        name: string;
        status: BatchStatus;
        training_mode: TrainingMode;
        level: string | null;
        programs: { id: string; name: string; slug: string } | null;
        academy_locations: { id: string; name: string } | null;
      } | null;
    };

    if (!row.batches) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    return {
      ok: true,
      batch: {
        id: row.batches.id,
        batchCode: row.batches.batch_code,
        name: row.batches.name,
        status: row.batches.status,
        trainingMode: row.batches.training_mode,
        level: row.batches.level,
        programId: row.batches.programs?.id ?? null,
        programName: row.batches.programs?.name ?? "—",
        programSlug: row.batches.programs?.slug ?? null,
        locationId: row.batches.academy_locations?.id ?? null,
        locationName: row.batches.academy_locations?.name ?? null,
        assignmentRole: row.role,
        assignedAt: row.assigned_at,
      },
    };
  } catch {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }
}
