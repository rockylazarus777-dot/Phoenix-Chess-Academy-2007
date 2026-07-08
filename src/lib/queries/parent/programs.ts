import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getProgramBySlug } from "@/content/programs";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { EnrollmentStatus } from "@/lib/supabase/types";

/**
 * "Linked Student Programs" — a single linked student's own
 * `student_program_enrollments`, using the authenticated (RLS-scoped)
 * server client. `studentId` must already have passed
 * `getLinkedStudent()` authorization at the page level before this is
 * called — ownership is enforced twice: the explicit
 * `.eq("student_id", studentId)` filter here, and the
 * `student_program_enrollments_select_for_linked_parent` RLS policy
 * (supabase/migrations/0017_parent_portal_rls.sql) as a backstop.
 */
export interface ParentStudentProgramRow {
  id: string;
  programSlug: string;
  programName: string;
  /** Only set when the DB slug matches a real, active public program — same defensive linking behavior as the student portal. Never a broken link. */
  publicProgramHref: string | null;
  batchName: string | null;
  status: EnrollmentStatus;
  enrolledOn: string;
  completedOn: string | null;
}

export async function listParentStudentPrograms(studentId: string): Promise<ParentQueryResult<ParentStudentProgramRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("student_program_enrollments")
      .select("id, status, enrolled_on, completed_on, programs(slug, name), batches(name)")
      .eq("student_id", studentId as never)
      .order("enrolled_on", { ascending: false });

    if (error) return parentQueryUnknownError();

    const rows = ((data ?? []) as unknown as Array<{
      id: string;
      status: EnrollmentStatus;
      enrolled_on: string;
      completed_on: string | null;
      programs: { slug: string; name: string } | null;
      batches: { name: string } | null;
    }>).map((row) => {
      const slug = row.programs?.slug ?? "";
      const publicProgram = slug ? getProgramBySlug(slug) : undefined;

      return {
        id: row.id,
        programSlug: slug,
        programName: row.programs?.name ?? "—",
        publicProgramHref: publicProgram ? `/programs/${publicProgram.slug}` : null,
        batchName: row.batches?.name ?? null,
        status: row.status,
        enrolledOn: row.enrolled_on,
        completedOn: row.completed_on,
      };
    });

    return parentQueryOk(rows);
  } catch {
    return parentQueryUnavailable();
  }
}
