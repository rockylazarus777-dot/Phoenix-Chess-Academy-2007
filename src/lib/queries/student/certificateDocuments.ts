import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";

/**
 * Calls `get_student_certificate_document_availability(uuid)` (Phase 18)
 * — a boolean-only RPC, never storage metadata. Used by
 * `/portal/certificates/[certificateId]` to decide between rendering the
 * "Download Certificate" button (which links only to
 * `/api/certificates/[certificateId]/download`) and the safe "Certificate
 * document is not available yet." message. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Student Certificate List/
 * Detail Updates".
 */
export async function getStudentCertificateDocumentAvailability(certificateId: string): Promise<StudentQueryResult<boolean>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_certificate_document_availability" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk(Boolean(data));
  } catch {
    return studentQueryUnavailable();
  }
}
