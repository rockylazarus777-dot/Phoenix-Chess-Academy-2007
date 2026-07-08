import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { ParentRow, ParentStatus, StudentParentRow, ParentRelationship } from "@/lib/supabase/types";

export interface ParentListRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: ParentStatus;
}

export interface ListParentsParams {
  page: number;
  pageSize: number;
  query: string | null;
  status: ParentStatus | null;
}

export async function listParents(
  params: ListParentsParams,
): Promise<AdminQueryResult<{ rows: ParentListRow[]; totalCount: number }>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase.from("parents").select("id, full_name, phone, email, status", { count: "exact" });

    if (params.status) builder = builder.eq("status", params.status as never);
    if (params.query) {
      const like = `%${params.query}%`;
      builder = builder.or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
    }

    const { data, error, count } = await builder.order("created_at", { ascending: false }).range(from, to);
    if (error) return queryUnknownError();

    return queryOk({ rows: (data ?? []) as unknown as ParentListRow[], totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function getParentById(id: string): Promise<AdminQueryResult<ParentRow | null>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.from("parents").select("*").eq("id", id as never).maybeSingle();
    if (error) return queryUnknownError();

    return queryOk((data as unknown as ParentRow) ?? null);
  } catch {
    return queryUnavailable();
  }
}

export interface LinkedStudentRow {
  student_id: string;
  student_code: string;
  full_name: string;
  relationship: ParentRelationship;
  is_primary: boolean;
  can_receive_updates: boolean;
  can_manage_student: boolean;
}

/** Students linked to a given parent, joined for display on the parent detail page. */
export async function getLinkedStudents(parentId: string): Promise<AdminQueryResult<LinkedStudentRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("student_parents")
      .select("student_id, relationship, is_primary, can_receive_updates, can_manage_student, students(student_code, full_name)")
      .eq("parent_id", parentId as never);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<
      StudentParentRow & { students: { student_code: string; full_name: string } | null }
    >).map((row) => ({
      student_id: row.student_id,
      student_code: row.students?.student_code ?? "—",
      full_name: row.students?.full_name ?? "—",
      relationship: row.relationship,
      is_primary: row.is_primary,
      can_receive_updates: row.can_receive_updates,
      can_manage_student: row.can_manage_student,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export interface LinkedParentRow {
  parent_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  relationship: ParentRelationship;
  is_primary: boolean;
  can_receive_updates: boolean;
  can_manage_student: boolean;
}

/** Parents linked to a given student — the reverse of getLinkedStudents(), used on the student detail page. */
export async function getLinkedParents(studentId: string): Promise<AdminQueryResult<LinkedParentRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("student_parents")
      .select("parent_id, relationship, is_primary, can_receive_updates, can_manage_student, parents(full_name, phone, email)")
      .eq("student_id", studentId as never);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<
      StudentParentRow & { parents: { full_name: string; phone: string; email: string | null } | null }
    >).map((row) => ({
      parent_id: row.parent_id,
      full_name: row.parents?.full_name ?? "—",
      phone: row.parents?.phone ?? "—",
      email: row.parents?.email ?? null,
      relationship: row.relationship,
      is_primary: row.is_primary,
      can_receive_updates: row.can_receive_updates,
      can_manage_student: row.can_manage_student,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export interface ParentOption {
  id: string;
  full_name: string;
  phone: string;
}

export async function searchParentsForSelect(query: string): Promise<AdminQueryResult<ParentOption[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();
  if (query.trim().length === 0) return queryOk([]);

  try {
    const supabase = getAdminSupabaseClient();
    const like = `%${query.trim().slice(0, 100)}%`;
    const { data, error } = await supabase
      .from("parents")
      .select("id, full_name, phone")
      .or(`full_name.ilike.${like},phone.ilike.${like}`)
      .limit(10);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as ParentOption[]);
  } catch {
    return queryUnavailable();
  }
}

export async function countParents(): Promise<AdminQueryResult<number>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { count, error } = await supabase.from("parents").select("id", { count: "exact", head: true });
    if (error) return queryUnknownError();
    return queryOk(count ?? 0);
  } catch {
    return queryUnavailable();
  }
}
