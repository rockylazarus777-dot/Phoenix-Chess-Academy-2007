import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { toRange } from "@/lib/admin/pagination";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { StudentRow, StudentStatus } from "@/lib/supabase/types";

/**
 * Server-only student query module — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Admin Query Architecture". Every function here is called only after
 * the caller (a page component or Server Action) has already run
 * `requirePermission("VIEW_STUDENTS")` — this module does not
 * re-authorize, it only queries.
 *
 * List queries select a narrow column set on purpose — full
 * address/DOB/notes are fetched only by `getStudentById` (the detail
 * page), never on the 25/50-row list view.
 */

export interface StudentListRow {
  id: string;
  student_code: string;
  full_name: string;
  current_level: string | null;
  status: StudentStatus;
  joined_on: string | null;
}

export const STUDENT_SORT_COLUMNS = ["created_at", "full_name", "student_code"] as const;
export type StudentSortColumn = (typeof STUDENT_SORT_COLUMNS)[number];

export interface ListStudentsParams {
  page: number;
  pageSize: number;
  query: string | null;
  status: StudentStatus | null;
  sort: StudentSortColumn;
  ascending: boolean;
}

export interface ListStudentsResult {
  rows: StudentListRow[];
  totalCount: number;
}

export async function listStudents(params: ListStudentsParams): Promise<AdminQueryResult<ListStudentsResult>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const [from, to] = toRange(params.page, params.pageSize);

    let builder = supabase
      .from("students")
      .select("id, student_code, full_name, current_level, status, joined_on", { count: "exact" });

    if (params.status) {
      builder = builder.eq("status", params.status as never);
    }

    if (params.query) {
      const like = `%${params.query}%`;
      // Supabase's `.or()` builds a parameterized PostgREST filter string
      // — the search term is never interpolated into raw SQL.
      builder = builder.or(
        `student_code.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},fide_id.ilike.${like}`,
      );
    }

    const { data, error, count } = await builder.order(params.sort, { ascending: params.ascending }).range(from, to);

    if (error) return queryUnknownError();

    return queryOk({ rows: (data ?? []) as unknown as StudentListRow[], totalCount: count ?? 0 });
  } catch {
    return queryUnavailable();
  }
}

export async function getStudentById(id: string): Promise<AdminQueryResult<StudentRow | null>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.from("students").select("*").eq("id", id as never).maybeSingle();

    if (error) return queryUnknownError();

    return queryOk((data as unknown as StudentRow) ?? null);
  } catch {
    return queryUnavailable();
  }
}

export interface StudentOption {
  id: string;
  student_code: string;
  full_name: string;
}

/** Small, capped result set for form selects (e.g. "search for a student to enroll"). Never returns more than 10 rows. */
export async function searchStudentsForSelect(query: string): Promise<AdminQueryResult<StudentOption[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();
  if (query.trim().length === 0) return queryOk([]);

  try {
    const supabase = getAdminSupabaseClient();
    const like = `%${query.trim().slice(0, 100)}%`;
    const { data, error } = await supabase
      .from("students")
      .select("id, student_code, full_name")
      .or(`student_code.ilike.${like},full_name.ilike.${like}`)
      .limit(10);

    if (error) return queryUnknownError();

    return queryOk((data ?? []) as unknown as StudentOption[]);
  } catch {
    return queryUnavailable();
  }
}

export async function countStudents(): Promise<AdminQueryResult<number>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { count, error } = await supabase.from("students").select("id", { count: "exact", head: true });

    if (error) return queryUnknownError();

    return queryOk(count ?? 0);
  } catch {
    return queryUnavailable();
  }
}
