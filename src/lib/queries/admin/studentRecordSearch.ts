import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { AdminStudentSearchResultRow } from "@/lib/supabase/types";

/**
 * Narrow student search for the Phase 17 certificate/achievement "new
 * record" forms, shared by both areas. Unlike every other Phase 10 admin
 * query module (which reads via the service-role client,
 * `getAdminSupabaseClient()`), this calls `search_students_for_admin_record()`
 * — a SECURITY DEFINER RPC that independently verifies the caller is an
 * ADMIN/SUPER_ADMIN profile via `auth.uid()` — through the normal
 * per-request session client. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin Student Search
 * Architecture" and "Admin-Only Mutation Decision" for why this one
 * narrow area of Phase 17 uses the session client instead of the
 * service-role client.
 *
 * Never returns contact PII (email/phone/WhatsApp/address/DOB/parent
 * data) — only id/full_name/student_code, capped at 20 rows by the RPC
 * itself.
 */
export async function searchStudentsForAdminRecord(query: string): Promise<AdminQueryResult<AdminStudentSearchResultRow[]>> {
  if (!isSupabaseConfigured()) return queryUnavailable();
  if (query.trim().length < 2) return queryOk([]);

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("search_students_for_admin_record" as never, {
      target_query: query.trim(),
    } as never);

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as AdminStudentSearchResultRow[]);
  } catch {
    return queryUnavailable();
  }
}
