import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { ProgramRow, AcademyLocationRow, TournamentOption } from "@/lib/supabase/types";

/**
 * Small reference-data lookups (active programs, active locations) used
 * to populate admin form selects. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Program Database Sync Strategy" and "Academy Location Reuse" —
 * `academy_locations` (Phase 7) and `programs` (Phase 7, seeded in
 * Phase 10's 0015 migration) are reused as-is, no competing tables.
 */
export async function listActivePrograms(): Promise<AdminQueryResult<ProgramRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("programs")
      .select("id, slug, name, active")
      .eq("active", true as never)
      .order("name", { ascending: true });

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as ProgramRow[]);
  } catch {
    return queryUnavailable();
  }
}

export async function listActiveLocations(): Promise<AdminQueryResult<AcademyLocationRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("academy_locations")
      .select("id, name, slug, active")
      .eq("active", true as never)
      .order("name", { ascending: true });

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as AcademyLocationRow[]);
  } catch {
    return queryUnavailable();
  }
}

/**
 * Narrow tournament reference list for the Phase 17 certificate/
 * achievement "new record" forms' optional tournament context field. Not
 * a public-facing query — read via the same service-role client as every
 * other Phase 10 reference lookup, gated by the calling page's own
 * `requirePermission()` check. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Tournament Context
 * Validation".
 */
export async function listTournamentsForSelect(): Promise<AdminQueryResult<TournamentOption[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, status")
      .order("start_date", { ascending: false });

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as TournamentOption[]);
  } catch {
    return queryUnavailable();
  }
}
