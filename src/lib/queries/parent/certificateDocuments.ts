import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";

/**
 * Calls `get_parent_student_certificate_document_availability(uuid, uuid)`
 * (Phase 18) — a boolean-only RPC that independently re-verifies
 * `parent_has_student()` internally (defense in depth on top of the
 * page's own `getLinkedStudent()` call). Used by
 * `/parent/students/[studentId]/certificates/[certificateId]` to decide
 * between the "Download Certificate" button and the safe "Certificate
 * document is not available yet for this student." message. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Parent Certificate Detail
 * Update".
 */
export async function getParentStudentCertificateDocumentAvailability(
  studentId: string,
  certificateId: string,
): Promise<ParentQueryResult<boolean>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_parent_student_certificate_document_availability" as never, {
      target_student_id: studentId,
      target_certificate_id: certificateId,
    } as never);

    if (error) return parentQueryUnknownError();
    return parentQueryOk(Boolean(data));
  } catch {
    return parentQueryUnavailable();
  }
}
