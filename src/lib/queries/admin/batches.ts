import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { BatchRow, BatchStatus, TrainingMode } from "@/lib/supabase/types";

export interface BatchListRow {
  id: string;
  batch_code: string;
  name: string;
  training_mode: TrainingMode;
  status: BatchStatus;
  capacity: number | null;
  program_name: string;
  location_name: string | null;
}

export interface ListBatchesParams {
  page: number;
  pageSize: number;
  query: string | null;
  status: BatchStatus | null;
}

export async function listBatches(
  params: ListBatchesParams,
): Promise<AdminQueryResult<{ rows: BatchListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase
      .from("batches")
      .select("id, batch_code, name, training_mode, status, capacity, programs(name), academy_locations(name)", {
        count: "exact",
      });

    if (params.status) builder = builder.eq("status", params.status as never);
    if (params.query) {
      const like = `%${params.query}%`;
      builder = builder.or(`batch_code.ilike.${like},name.ilike.${like}`);
    }

    const { data, error, count } = await builder.order("created_at", { ascending: false }).range(from, to);
    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      batch_code: string;
      name: string;
      training_mode: TrainingMode;
      status: BatchStatus;
      capacity: number | null;
      programs: { name: string } | null;
      academy_locations: { name: string } | null;
    }>).map((row) => ({
      id: row.id,
      batch_code: row.batch_code,
      name: row.name,
      training_mode: row.training_mode,
      status: row.status,
      capacity: row.capacity,
      program_name: row.programs?.name ?? "—",
      location_name: row.academy_locations?.name ?? null,
    }));

    return queryOk({ rows, totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function getBatchById(id: string): Promise<AdminQueryResult<BatchRow | null>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.from("batches").select("*").eq("id", id as never).maybeSingle();
    if (error) return queryUnknownError();

    return queryOk((data as unknown as BatchRow) ?? null);
  } catch {
    return queryUnavailable();
  }
}

export interface BatchCoachAssignmentRow {
  batch_coach_id: string;
  coach_id: string;
  coach_code: string;
  full_name: string;
  role: import("@/lib/supabase/types").BatchCoachRole;
}

/** Coaches currently assigned to a given batch — the reverse of getAssignedBatches() in queries/admin/coaches.ts. */
export async function getBatchCoaches(batchId: string): Promise<AdminQueryResult<BatchCoachAssignmentRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("batch_coaches")
      .select("id, coach_id, role, coaches(coach_code, full_name)")
      .eq("batch_id", batchId as never)
      .is("ended_at", null);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      coach_id: string;
      role: import("@/lib/supabase/types").BatchCoachRole;
      coaches: { coach_code: string; full_name: string } | null;
    }>).map((row) => ({
      batch_coach_id: row.id,
      coach_id: row.coach_id,
      coach_code: row.coaches?.coach_code ?? "—",
      full_name: row.coaches?.full_name ?? "—",
      role: row.role,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export interface BatchStudentRow {
  student_id: string;
  student_code: string;
  full_name: string;
  status: string;
}

/** Students currently assigned to a batch (batch_enrollments), for read-only display on the batch detail page — full CRUD lives on /admin/enrollments. */
export async function getBatchStudents(batchId: string): Promise<AdminQueryResult<BatchStudentRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("batch_enrollments")
      .select("student_id, status, students(student_code, full_name)")
      .eq("batch_id", batchId as never)
      .eq("status", "ACTIVE" as never);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      student_id: string;
      status: string;
      students: { student_code: string; full_name: string } | null;
    }>).map((row) => ({
      student_id: row.student_id,
      student_code: row.students?.student_code ?? "—",
      full_name: row.students?.full_name ?? "—",
      status: row.status,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export interface BatchOption {
  id: string;
  batch_code: string;
  name: string;
}

export async function listActiveBatchesForSelect(): Promise<AdminQueryResult<BatchOption[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("batches")
      .select("id, batch_code, name")
      .in("status", ["DRAFT", "ACTIVE", "PAUSED"] as never)
      .order("name", { ascending: true })
      .limit(200);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as BatchOption[]);
  } catch {
    return queryUnavailable();
  }
}

export async function countActiveBatches(): Promise<AdminQueryResult<number>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { count, error } = await supabase
      .from("batches")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE" as never);
    if (error) return queryUnknownError();
    return queryOk(count ?? 0);
  } catch {
    return queryUnavailable();
  }
}
