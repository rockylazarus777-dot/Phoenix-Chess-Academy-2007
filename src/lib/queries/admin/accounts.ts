import "server-only";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { queryOk, queryUnavailable, queryUnknownError, type AdminQueryResult } from "@/lib/admin/queryResult";
import type { UserRole } from "@/lib/supabase/types";

export interface StaffProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
}

/** STAFF/ADMIN/SUPER_ADMIN profiles — for the "Staff & Admin Accounts" section of /admin/accounts. */
export async function listStaffProfiles(): Promise<AdminQueryResult<StaffProfileRow[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .in("role", ["STAFF", "ADMIN", "SUPER_ADMIN"] as never)
      .order("role", { ascending: true });

    if (error) return queryUnknownError();
    return queryOk((data ?? []) as unknown as StaffProfileRow[]);
  } catch {
    return queryUnavailable();
  }
}

export interface AccountLinkCandidate {
  id: string;
  code: string;
  full_name: string;
  email: string | null;
  profile_id: string | null;
  profile_active: boolean | null;
}

async function findRecordWithProfile(
  table: "students" | "parents" | "coaches",
  codeColumn: string,
  query: string,
): Promise<AdminQueryResult<AccountLinkCandidate[]>> {
  if (!isAdminSupabaseConfigured()) return queryUnavailable();
  if (query.trim().length === 0) return queryOk([]);

  try {
    const supabase = getAdminSupabaseClient();
    const like = `%${query.trim().slice(0, 100)}%`;
    const codeFilter = table === "parents" ? `full_name.ilike.${like}` : `${codeColumn}.ilike.${like},full_name.ilike.${like}`;

    const { data, error } = await supabase
      .from(table)
      .select(`id, ${codeColumn === "" ? "full_name" : codeColumn}, full_name, email, profile_id, profiles(active)`)
      .or(codeFilter)
      .limit(10);

    if (error) return queryUnknownError();

    const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      code: (row[codeColumn] as string | undefined) ?? "—",
      full_name: row.full_name as string,
      email: (row.email as string | null) ?? null,
      profile_id: (row.profile_id as string | null) ?? null,
      profile_active: ((row.profiles as { active: boolean } | null)?.active ?? null) as boolean | null,
    }));

    return queryOk(rows);
  } catch {
    return queryUnavailable();
  }
}

export function findStudentAccountCandidates(query: string) {
  return findRecordWithProfile("students", "student_code", query);
}

export function findParentAccountCandidates(query: string) {
  return findRecordWithProfile("parents", "", query);
}

export function findCoachAccountCandidates(query: string) {
  return findRecordWithProfile("coaches", "coach_code", query);
}
