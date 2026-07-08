import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentRelationship, StudentStatus } from "@/lib/supabase/types";

/**
 * "My Students" — every `student_parents` relationship for the
 * authenticated parent, via the authenticated (RLS-scoped) server
 * client. A linked student is never hidden based on `is_primary` or
 * `can_manage_student` — the existence of the relationship is the read
 * authorization boundary for Phase 12 (see
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Relationship Flag
 * Decision"). `relationship` is the stored enum value, never inferred
 * from gender.
 */
export interface ParentStudentListRow {
  id: string;
  studentCode: string;
  fullName: string;
  currentLevel: string | null;
  status: StudentStatus;
  relationship: ParentRelationship;
  isPrimary: boolean;
}

export async function listParentLinkedStudents(parentId: string): Promise<ParentQueryResult<ParentStudentListRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("student_parents")
      .select("relationship, is_primary, students(id, student_code, full_name, current_level, status)")
      .eq("parent_id", parentId as never);

    if (error) return parentQueryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      relationship: ParentRelationship;
      is_primary: boolean;
      students: {
        id: string;
        student_code: string;
        full_name: string;
        current_level: string | null;
        status: StudentStatus;
      } | null;
    }>)
      .filter((row) => row.students !== null)
      .map((row) => ({
        id: row.students!.id,
        studentCode: row.students!.student_code,
        fullName: row.students!.full_name,
        currentLevel: row.students!.current_level,
        status: row.students!.status,
        relationship: row.relationship,
        isPrimary: row.is_primary,
      }));

    return parentQueryOk(rows);
  } catch {
    return parentQueryUnavailable();
  }
}
