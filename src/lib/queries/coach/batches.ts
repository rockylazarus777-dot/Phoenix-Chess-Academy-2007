import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { BatchCoachRole, BatchStatus, TrainingMode } from "@/lib/supabase/types";

export interface CoachBatchListRow {
  id: string;
  batchCode: string;
  name: string;
  status: BatchStatus;
  trainingMode: TrainingMode;
  level: string | null;
  programName: string;
  locationName: string | null;
  assignmentRole: BatchCoachRole;
  assignedAt: string;
}

/**
 * "My Batches" — every CURRENT (`ended_at is null`) `batch_coaches` row
 * for the authenticated coach, via the authenticated (RLS-scoped)
 * server client. Ownership is enforced twice: the explicit
 * `.eq("coach_id", coachId)` filter here, and the
 * `batch_coaches_select_own`/`batches_select_for_assigned_coach` RLS
 * policies (supabase/migrations/0018_coach_portal_rls.sql) as a
 * backstop. An ended assignment is excluded — it is no longer "my
 * batch."
 */
export async function listCoachBatches(coachId: string): Promise<CoachQueryResult<CoachBatchListRow[]>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("batch_coaches")
      .select(
        "role, assigned_at, batches!inner(id, batch_code, name, status, training_mode, level, programs(name), academy_locations(name))",
      )
      .eq("coach_id", coachId as never)
      .is("ended_at", null as never)
      .order("assigned_at", { ascending: false });

    if (error) return coachQueryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      role: BatchCoachRole;
      assigned_at: string;
      batches: {
        id: string;
        batch_code: string;
        name: string;
        status: BatchStatus;
        training_mode: TrainingMode;
        level: string | null;
        programs: { name: string } | null;
        academy_locations: { name: string } | null;
      } | null;
    }>)
      .filter((row) => row.batches !== null)
      .map((row) => ({
        id: row.batches!.id,
        batchCode: row.batches!.batch_code,
        name: row.batches!.name,
        status: row.batches!.status,
        trainingMode: row.batches!.training_mode,
        level: row.batches!.level,
        programName: row.batches!.programs?.name ?? "—",
        locationName: row.batches!.academy_locations?.name ?? null,
        assignmentRole: row.role,
        assignedAt: row.assigned_at,
      }));

    return coachQueryOk(rows);
  } catch {
    return coachQueryUnavailable();
  }
}
