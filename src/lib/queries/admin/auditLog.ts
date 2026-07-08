import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminAuditAction } from "@/lib/supabase/types";

export interface AuditLogListRow {
  id: string;
  actor_role: string;
  action: AdminAuditAction;
  entity_type: string;
  summary: string;
  created_at: string;
}

export interface ListAuditLogParams {
  page: number;
  pageSize: number;
  action: AdminAuditAction | null;
  entityType: string | null;
  fromDate: string | null;
  toDate: string | null;
}

/**
 * Deliberately selects `summary` only — never `metadata` on the list
 * view (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Audit Log UI": "Do
 * not show raw metadata JSON by default").
 */
export async function listAuditLog(
  params: ListAuditLogParams,
): Promise<AdminQueryResult<{ rows: AuditLogListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase
      .from("admin_audit_log")
      .select("id, actor_role, action, entity_type, summary, created_at", { count: "exact" });

    if (params.action) builder = builder.eq("action", params.action as never);
    if (params.entityType) builder = builder.eq("entity_type", params.entityType as never);
    if (params.fromDate) builder = builder.gte("created_at", params.fromDate as never);
    if (params.toDate) builder = builder.lte("created_at", params.toDate as never);

    const { data, error, count } = await builder.order("created_at", { ascending: false }).range(from, to);
    if (error) return queryUnknownError();

    return queryOk({ rows: (data ?? []) as unknown as AuditLogListRow[], totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}
