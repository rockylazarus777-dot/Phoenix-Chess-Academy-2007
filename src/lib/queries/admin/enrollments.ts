import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { EnrollmentStatus } from "@/lib/supabase/types";

export interface EnrollmentListRow {
  id: string;
  student_id: string;
  student_code: string;
  student_name: string;
  program_name: string;
  batch_name: string | null;
  status: EnrollmentStatus;
  enrolled_on: string;
}

export interface ListEnrollmentsParams {
  page: number;
  pageSize: number;
  studentId: string | null;
  programId: string | null;
  batchId: string | null;
  status: EnrollmentStatus | null;
}

export async function listEnrollments(
  params: ListEnrollmentsParams,
): Promise<AdminQueryResult<{ rows: EnrollmentListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase
      .from("student_program_enrollments")
      .select("id, student_id, status, enrolled_on, students(student_code, full_name), programs(name), batches(name)", {
        count: "exact",
      });

    if (params.studentId) builder = builder.eq("student_id", params.studentId as never);
    if (params.programId) builder = builder.eq("program_id", params.programId as never);
    if (params.batchId) builder = builder.eq("batch_id", params.batchId as never);
    if (params.status) builder = builder.eq("status", params.status as never);

    const { data, error, count } = await builder.order("enrolled_on", { ascending: false }).range(from, to);
    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      student_id: string;
      status: EnrollmentStatus;
      enrolled_on: string;
      students: { student_code: string; full_name: string } | null;
      programs: { name: string } | null;
      batches: { name: string } | null;
    }>).map((row) => ({
      id: row.id,
      student_id: row.student_id,
      student_code: row.students?.student_code ?? "—",
      student_name: row.students?.full_name ?? "—",
      program_name: row.programs?.name ?? "—",
      batch_name: row.batches?.name ?? null,
      status: row.status,
      enrolled_on: row.enrolled_on,
    }));

    return queryOk({ rows, totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function countActiveEnrollments(): Promise<AdminQueryResult<number>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { count, error } = await supabase
      .from("student_program_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE" as never);
    if (error) return queryUnknownError();
    return queryOk(count ?? 0);
  } catch {
    return queryUnavailable();
  }
}
