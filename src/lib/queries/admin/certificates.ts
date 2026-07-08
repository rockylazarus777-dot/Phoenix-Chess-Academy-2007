import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminCertificateListRow, AdminCertificateDetailRow } from "@/lib/supabase/types";

/**
 * Admin certificate query module. Unlike every other Phase 10 admin
 * query module, these functions call `getServerSupabaseClient()` (the
 * normal per-request session client) rather than the service-role
 * client — the underlying RPCs (`get_admin_certificates()`/
 * `get_admin_certificate()`) independently verify the caller is an
 * ADMIN/SUPER_ADMIN profile via `auth.uid()`. Every caller (a page
 * component) has already run `requirePermission("VIEW_CERTIFICATES")` —
 * this module does not re-authorize, it only queries. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only Mutation
 * Decision".
 */
export async function listAdminCertificates(): Promise<AdminQueryResult<AdminCertificateListRow[]>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_admin_certificates" as never, {} as never);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as AdminCertificateListRow[]);
  } catch {
    return queryUnavailable();
  }
}

/**
 * Single certificate detail for `/admin/certificates/[certificateId]`.
 * Returns `null` data when the RPC yields no row — an invalid UUID and a
 * nonexistent certificate both collapse into this same empty result; the
 * page renders `notFound()` for both.
 */
export async function getAdminCertificate(certificateId: string): Promise<AdminQueryResult<AdminCertificateDetailRow | null>> {
  if (!isSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_admin_certificate" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) return queryUnknownError();
    const rows = (data ?? []) as unknown as AdminCertificateDetailRow[];
    return queryOk(rows.length > 0 ? rows[0] : null);
  } catch {
    return queryUnavailable();
  }
}
