import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminCertificateDocumentRow, CertificateGenerationContextRow } from "@/lib/supabase/types";

/**
 * Admin certificate document query module (Phase 18). Follows the same
 * session-client pattern as `src/lib/queries/admin/certificates.ts` —
 * the underlying RPCs (`get_admin_certificate_documents`/
 * `get_certificate_generation_context`) independently verify the caller
 * is an ADMIN/SUPER_ADMIN profile via `auth.uid()`. Callers have already
 * run `requirePermission("VIEW_CERTIFICATES"|"MANAGE_CERTIFICATES")` —
 * this module does not re-authorize, it only queries.
 */
export async function listAdminCertificateDocuments(certificateId: string): Promise<AdminQueryResult<AdminCertificateDocumentRow[]>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_admin_certificate_documents" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as AdminCertificateDocumentRow[]);
  } catch {
    return queryUnavailable();
  }
}

/**
 * Narrow PDF generation input — used only inside the generation Server
 * Action, never rendered directly to a page. See "Certificate
 * Generation Input Boundary".
 */
export async function getCertificateGenerationContext(certificateId: string): Promise<AdminQueryResult<CertificateGenerationContextRow | null>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_certificate_generation_context" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) return queryUnknownError();
    const rows = (data ?? []) as unknown as CertificateGenerationContextRow[];
    return queryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return queryUnavailable();
  }
}
