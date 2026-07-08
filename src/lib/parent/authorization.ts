import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/uuid";
import type { ParentRelationship, StudentStatus } from "@/lib/supabase/types";

/**
 * Narrow, parent-facing view of a linked student — deliberately NOT
 * `StudentPortalIdentity` (which includes the student's own email/phone
 * — a different privacy boundary) and never a full `students` row. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Linked Student Privacy Boundary".
 */
export interface ParentLinkedStudent {
  id: string;
  studentCode: string;
  fullName: string;
  currentLevel: string | null;
  status: StudentStatus;
  joinedOn: string | null;
  fideId: string | null;
  fideRating: number | null;
  relationship: ParentRelationship;
  isPrimary: boolean;
}

export type LinkedStudentResult =
  | { ok: true; student: ParentLinkedStudent }
  | { ok: false; reason: "NOT_FOUND" | "DATABASE_UNAVAILABLE" };

/**
 * THE authoritative parent-to-student authorization check for every
 * `/parent/students/[studentId]*` route. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent-to-Student Authorization"
 * and "Student Enumeration Protection".
 *
 * IMPORTANT: this does not query `students` first and then decide
 * whether to show it — the query IS the `student_parents` relationship
 * join. There is no code path where a student row is fetched before
 * authorization is confirmed. `parentId` must come only from
 * `getCurrentParent()`, never from browser input; `studentId` is a route
 * parameter and is treated purely as a resource identifier, validated as
 * a UUID and then checked against the relationship — never trusted as
 * authorization by itself.
 *
 * Invalid UUID, a UUID with no matching student, and a UUID for a real
 * but unlinked student all return the same `NOT_FOUND` reason — every
 * caller renders `notFound()` for all three, so a parent who guesses
 * another family's student UUID cannot distinguish "doesn't exist" from
 * "exists but isn't yours" from the response.
 */
export async function getLinkedStudent(parentId: string, studentId: string): Promise<LinkedStudentResult> {
  if (!isUuid(studentId)) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("student_parents")
      .select(
        "relationship, is_primary, students!inner(id, student_code, full_name, current_level, status, joined_on, fide_id, fide_rating)",
      )
      .eq("parent_id", parentId as never)
      .eq("student_id", studentId as never)
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "DATABASE_UNAVAILABLE" };
    }
    if (!data) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    const row = data as unknown as {
      relationship: ParentRelationship;
      is_primary: boolean;
      students: {
        id: string;
        student_code: string;
        full_name: string;
        current_level: string | null;
        status: StudentStatus;
        joined_on: string | null;
        fide_id: string | null;
        fide_rating: number | null;
      } | null;
    };

    if (!row.students) {
      return { ok: false, reason: "NOT_FOUND" };
    }

    return {
      ok: true,
      student: {
        id: row.students.id,
        studentCode: row.students.student_code,
        fullName: row.students.full_name,
        currentLevel: row.students.current_level,
        status: row.students.status,
        joinedOn: row.students.joined_on,
        fideId: row.students.fide_id,
        fideRating: row.students.fide_rating,
        relationship: row.relationship,
        isPrimary: row.is_primary,
      },
    };
  } catch {
    return { ok: false, reason: "DATABASE_UNAVAILABLE" };
  }
}
