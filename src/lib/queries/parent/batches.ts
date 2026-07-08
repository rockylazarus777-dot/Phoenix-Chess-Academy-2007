import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listParentLinkedStudentBatchCoaches } from "@/lib/queries/parent/coaches";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { BatchStatus, TrainingMode } from "@/lib/supabase/types";

export interface ParentStudentBatchRow {
  batchId: string;
  batchCode: string;
  batchName: string;
  programName: string;
  trainingMode: TrainingMode;
  level: string | null;
  locationName: string | null;
  batchStatus: BatchStatus;
  assignmentStatus: "ACTIVE" | "ENDED" | "TRANSFERRED";
  assignedAt: string;
  endedAt: string | null;
  /** Coach names for this batch (PRIMARY/ASSISTANT/GUEST), display-only — see get_parent_linked_student_batch_coaches(). */
  coaches: Array<{ fullName: string; role: string }>;
}

export interface ParentStudentBatchesResult {
  current: ParentStudentBatchRow[];
  historical: ParentStudentBatchRow[];
}

/**
 * "Linked Student Batches" — a single linked student's own
 * `batch_enrollments` rows only (explicit filter + RLS backstop, same
 * pattern as every other parent query module). Batch capacity/other-
 * student data/coach contact details are deliberately never selected
 * here. Supports multiple simultaneous current batch assignments — no
 * invented one-batch-only rule.
 */
export async function listParentStudentBatches(studentId: string): Promise<ParentQueryResult<ParentStudentBatchesResult>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("batch_enrollments")
      .select(
        "batch_id, status, assigned_at, ended_at, batches(batch_code, name, training_mode, level, status, programs(name), academy_locations(name))",
      )
      .eq("student_id", studentId as never)
      .order("assigned_at", { ascending: false });

    if (error) return parentQueryUnknownError();

    const coachesResult = await listParentLinkedStudentBatchCoaches(studentId);
    const coachesByBatch = new Map<string, Array<{ fullName: string; role: string }>>();
    if (coachesResult.ok) {
      for (const coach of coachesResult.data) {
        const list = coachesByBatch.get(coach.batch_id) ?? [];
        list.push({ fullName: coach.full_name, role: coach.role });
        coachesByBatch.set(coach.batch_id, list);
      }
    }

    const rows = ((data ?? []) as unknown as Array<{
      batch_id: string;
      status: "ACTIVE" | "ENDED" | "TRANSFERRED";
      assigned_at: string;
      ended_at: string | null;
      batches: {
        batch_code: string;
        name: string;
        training_mode: TrainingMode;
        level: string | null;
        status: BatchStatus;
        programs: { name: string } | null;
        academy_locations: { name: string } | null;
      } | null;
    }>).map((row) => ({
      batchId: row.batch_id,
      batchCode: row.batches?.batch_code ?? "—",
      batchName: row.batches?.name ?? "—",
      programName: row.batches?.programs?.name ?? "—",
      trainingMode: (row.batches?.training_mode ?? "OFFLINE") as TrainingMode,
      level: row.batches?.level ?? null,
      locationName: row.batches?.academy_locations?.name ?? null,
      batchStatus: (row.batches?.status ?? "ACTIVE") as BatchStatus,
      assignmentStatus: row.status,
      assignedAt: row.assigned_at,
      endedAt: row.ended_at,
      coaches: coachesByBatch.get(row.batch_id) ?? [],
    }));

    return parentQueryOk({
      current: rows.filter((r) => r.assignmentStatus === "ACTIVE"),
      historical: rows.filter((r) => r.assignmentStatus !== "ACTIVE"),
    });
  } catch {
    return parentQueryUnavailable();
  }
}
