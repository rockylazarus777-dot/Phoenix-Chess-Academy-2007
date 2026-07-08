import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { listStudentBatchCoaches } from "@/lib/queries/student/coaches";
import {
  studentQueryOk,
  studentQueryUnavailable,
  studentQueryUnknownError,
  type StudentQueryResult,
} from "@/lib/portal/queryResult";
import type { BatchStatus, TrainingMode } from "@/lib/supabase/types";

export interface StudentBatchRow {
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
  /** Coach names for this batch (PRIMARY/ASSISTANT/GUEST), display-only — see get_student_batch_coaches(). */
  coaches: Array<{ fullName: string; role: string }>;
}

export interface StudentBatchesResult {
  current: StudentBatchRow[];
  historical: StudentBatchRow[];
}

/**
 * "My Batches" — own `batch_enrollments` rows only (explicit filter +
 * RLS backstop, same pattern as every other student query module).
 * Batch capacity/other-student data/coach contact details are
 * deliberately never selected here.
 */
export async function listStudentBatches(studentId: string): Promise<StudentQueryResult<StudentBatchesResult>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("batch_enrollments")
      .select(
        "batch_id, status, assigned_at, ended_at, batches(batch_code, name, training_mode, level, status, programs(name), academy_locations(name))",
      )
      .eq("student_id", studentId as never)
      .order("assigned_at", { ascending: false });

    if (error) return studentQueryUnknownError();

    const coachesResult = await listStudentBatchCoaches();
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

    return studentQueryOk({
      current: rows.filter((r) => r.assignmentStatus === "ACTIVE"),
      historical: rows.filter((r) => r.assignmentStatus !== "ACTIVE"),
    });
  } catch {
    return studentQueryUnavailable();
  }
}
