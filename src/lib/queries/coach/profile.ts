import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { coachQueryOk, coachQueryUnavailable, coachQueryUnknownError, type CoachQueryResult } from "@/lib/coach/queryResult";
import type { CoachStatus } from "@/lib/supabase/types";

/**
 * Same fields as `CoachPortalIdentity` (which powers the shell) —
 * the coach profile page in Phase 13 needs nothing wider (no
 * street address/DOB exist on `coaches` to add). Still a deliberately
 * narrow, hand-picked column list — never `select("*")`. Excludes
 * `profile_id`, `created_at`/`updated_at`, `joined_on` (admin-only).
 */
export interface CoachProfileDetail {
  coachCode: string;
  fullName: string;
  status: CoachStatus;
  bio: string | null;
  specializations: string[];
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
}

export async function getCoachProfile(coachId: string): Promise<CoachQueryResult<CoachProfileDetail>> {
  if (!isSupabaseConfigured()) return coachQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("coaches")
      .select("coach_code, full_name, status, bio, specializations, email, phone, whatsapp")
      .eq("id", coachId as never)
      .maybeSingle();

    if (error) return coachQueryUnknownError();
    if (!data) return coachQueryUnknownError();

    const row = data as unknown as {
      coach_code: string;
      full_name: string;
      status: CoachStatus;
      bio: string | null;
      specializations: string[];
      email: string | null;
      phone: string | null;
      whatsapp: string | null;
    };

    return coachQueryOk({
      coachCode: row.coach_code,
      fullName: row.full_name,
      status: row.status,
      bio: row.bio,
      specializations: row.specializations,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
    });
  } catch {
    return coachQueryUnavailable();
  }
}
