import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentCertificateListRow, StudentCertificateDetailRow } from "@/lib/supabase/types";

/**
 * Calls `get_parent_student_certificates(target_student_id)` — a SECURITY
 * DEFINER RPC that re-verifies `parent_has_student(target_student_id)`
 * internally. The page must already have called `getLinkedStudent()`
 * before reaching this query — this RPC is a second, independent
 * authorization layer (defense in depth), not the only one. Returns only
 * ISSUED/REVOKED certificates; DRAFT never appears. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Certificate
 * Routes".
 */
export async function listParentStudentCertificates(studentId: string): Promise<ParentQueryResult<ParentCertificateListRow[]>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_certificates" as never, {
      target_student_id: studentId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk((data ?? []) as unknown as ParentCertificateListRow[]);
  } catch {
    return parentQueryUnavailable();
  }
}

/**
 * Single certificate detail for
 * `/parent/students/[studentId]/certificates/[certificateId]`. Read-only —
 * no parent certificate mutation RPC exists anywhere.
 */
export async function getParentStudentCertificate(
  studentId: string,
  certificateId: string,
): Promise<ParentQueryResult<StudentCertificateDetailRow | null>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_certificate" as never, {
      target_student_id: studentId,
      target_certificate_id: certificateId,
    } as never);

    if (error) return parentQueryUnknownError();
    const rows = (data ?? []) as unknown as StudentCertificateDetailRow[];
    return parentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return parentQueryUnavailable();
  }
}
