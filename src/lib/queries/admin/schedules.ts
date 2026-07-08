import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { ClassScheduleRow, Weekday } from "@/lib/supabase/types";

export interface ScheduleListRow {
  id: string;
  batch_id: string;
  batch_code: string;
  batch_name: string;
  day_of_week: Weekday;
  start_time: string;
  end_time: string;
  active: boolean;
}

export interface ListSchedulesParams {
  page: number;
  pageSize: number;
  batchId: string | null;
  dayOfWeek: Weekday | null;
  activeOnly: boolean;
}

export async function listSchedules(
  params: ListSchedulesParams,
): Promise<AdminQueryResult<{ rows: ScheduleListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase
      .from("class_schedules")
      .select("id, batch_id, day_of_week, start_time, end_time, active, batches(batch_code, name)", { count: "exact" });

    if (params.batchId) builder = builder.eq("batch_id", params.batchId as never);
    if (params.dayOfWeek) builder = builder.eq("day_of_week", params.dayOfWeek as never);
    if (params.activeOnly) builder = builder.eq("active", true as never);

    const { data, error, count } = await builder
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true })
      .range(from, to);
    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      batch_id: string;
      day_of_week: Weekday;
      start_time: string;
      end_time: string;
      active: boolean;
      batches: { batch_code: string; name: string } | null;
    }>).map((row) => ({
      id: row.id,
      batch_id: row.batch_id,
      batch_code: row.batches?.batch_code ?? "—",
      batch_name: row.batches?.name ?? "—",
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      active: row.active,
    }));

    return queryOk({ rows, totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function getScheduleById(id: string): Promise<AdminQueryResult<ClassScheduleRow | null>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.from("class_schedules").select("*").eq("id", id as never).maybeSingle();
    if (error) return queryUnknownError();

    return queryOk((data as unknown as ClassScheduleRow) ?? null);
  } catch {
    return queryUnavailable();
  }
}
