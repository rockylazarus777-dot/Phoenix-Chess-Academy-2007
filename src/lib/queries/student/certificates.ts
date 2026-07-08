import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { studentQueryOk, studentQueryUnavailable, studentQueryUnknownError, type StudentQueryResult } from "@/lib/portal/queryResult";
import type { StudentCertificateDetailRow, StudentCertificateListRow } from "@/lib/supabase/types";

/**
 * Calls `get_student_certificates()` — a zero-argument SECURITY DEFINER
 * RPC always scoped to `current_student_id()` internally, returning only
 * ISSUED/REVOKED certificates. DRAFT never appears. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Certificate
 * Routes".
 */
export async function getStudentCertificates(): Promise<StudentQueryResult<StudentCertificateListRow[]>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_certificates" as never, {} as never);

    if (error) return studentQueryUnknownError();
    return studentQueryOk((data ?? []) as unknown as StudentCertificateListRow[]);
  } catch {
    return studentQueryUnavailable();
  }
}

/**
 * Single certificate detail for `/portal/certificates/[certificateId]`.
 * "Knowing certificateId is not enough" — the RPC requires
 * certificate.student_id = current_student_id() AND status IN
 * ('ISSUED','REVOKED'); an unauthorized, DRAFT, or nonexistent
 * certificate all yield `null`.
 */
export async function getStudentCertificate(certificateId: string): Promise<StudentQueryResult<StudentCertificateDetailRow | null>> {
  if (!isSupabaseConfigured()) return studentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_student_certificate" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) return studentQueryUnknownError();
    const rows = (data ?? []) as unknown as StudentCertificateDetailRow[];
    return studentQueryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return studentQueryUnavailable();
  }
}
