import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";
import type { StudentProgressRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_progress_evaluations()` — a zero-argument SECURITY
 * DEFINER RPC always scoped to `current_student_id()` internally (see
 * supabase/migrations/0022_student_progress_rls.sql). No `studentId`
 * parameter exists anywhere in this module. Only PUBLISHED evaluations are
 * ever returned — DRAFT/ARCHIVED never reach this result set. Returned
 * rows never include coach contact details or internal
 * created_by/published_by identifiers. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student Progress Privacy".
 */
export async function getStudentProgressEvaluations(): Promise<StudentQueryResult<StudentProgressRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_progress_evaluations" as never, {} as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentProgressRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}
