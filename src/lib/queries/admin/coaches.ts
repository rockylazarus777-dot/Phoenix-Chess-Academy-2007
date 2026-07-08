import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { CoachRow, CoachStatus, BatchCoachRole } from "@/lib/supabase/types";

export interface CoachListRow {
  id: string;
  coach_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: CoachStatus;
}

export interface ListCoachesParams {
  page: number;
  pageSize: number;
  query: string | null;
  status: CoachStatus | null;
}

export async function listCoaches(
  params: ListCoachesParams,
): Promise<AdminQueryResult<{ rows: CoachListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase.from("coaches").select("id, coach_code, full_name, email, phone, status", { count: "exact" });

    if (params.status) builder = builder.eq("status", params.status as never);
    if (params.query) {
      const like = `%${params.query}%`;
      builder = builder.or(`coach_code.ilike.${like},full_name.ilike.${like},email.ilike.${like}`);
    }

    const { data, error, count } = await builder.order("created_at", { ascending: false }).range(from, to);
    if (error) return queryUnknownError();

    return queryOk({ rows: (data ?? []) as unknown as CoachListRow[], totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function getCoachById(id: string): Promise<AdminQueryResult<CoachRow | null>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.from("coaches").select("*").eq("id", id as never).maybeSingle();
    if (error) return queryUnknownError();

    return queryOk((data as unknown as CoachRow) ?? null);
  } catch {
    return queryUnavailable();
  }
}

export interface AssignedBatchRow {
  batch_coach_id: string;
  batch_id: string;
  batch_code: string;
  batch_name: string;
  role: BatchCoachRole;
}

export async function getAssignedBatches(coachId: string): Promise<AdminQueryResult<AssignedBatchRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("batch_coaches")
      .select("id, batch_id, role, batches(batch_code, name)")
      .eq("coach_id", coachId as never)
      .is("ended_at", null);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      batch_id: string;
      role: BatchCoachRole;
      batches: { batch_code: string; name: string } | null;
    }>).map((row) => ({
      batch_coach_id: row.id,
      batch_id: row.batch_id,
      batch_code: row.batches?.batch_code ?? "—",
      batch_name: row.batches?.name ?? "—",
      role: row.role,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export interface CoachOption {
  id: string;
  coach_code: string;
  full_name: string;
}

export async function listActiveCoachesForSelect(): Promise<AdminQueryResult<CoachOption[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("coaches")
      .select("id, coach_code, full_name")
      .eq("status", "ACTIVE" as never)
      .order("full_name", { ascending: true })
      .limit(200);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as CoachOption[]);
  } catch {
    return queryUnavailable();
  }
}

export async function countCoaches(): Promise<AdminQueryResult<number>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { count, error } = await supabase.from("coaches").select("id", { count: "exact", head: true });
    if (error) return queryUnknownError();
    return queryOk(count ?? 0);
  } catch {
    return queryUnavailable();
  }
}
