import "server-only";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { parentQueryOk, parentQueryUnavailable, parentQueryUnknownError, type ParentQueryResult } from "@/lib/parent/queryResult";
import type { ParentStatus } from "@/lib/supabase/types";

/**
 * Wider than `ParentPortalIdentity` (which powers the shell), but still
 * a deliberately narrow, hand-picked column list — never `select("*")`.
 * Excludes `notes`, `profile_id`, `created_at`/`updated_at`. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent Profile Privacy".
 */
export interface ParentProfileDetail {
  fullName: string;
  status: ParentStatus;
  email: string | null;
  phone: string;
  whatsapp: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
}

export async function getParentProfile(parentId: string): Promise<ParentQueryResult<ParentProfileDetail>> {
  if (!isSupabaseConfigured()) return parentQueryUnavailable();

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase
      .from("parents")
      .select("full_name, status, email, phone, whatsapp, country, state, city")
      .eq("id", parentId as never)
      .maybeSingle();

    if (error) return parentQueryUnknownError();
    if (!data) return parentQueryUnknownError();

    const row = data as unknown as {
      full_name: string;
      status: ParentStatus;
      email: string | null;
      phone: string;
      whatsapp: string | null;
      country: string | null;
      state: string | null;
      city: string | null;
    };

    return parentQueryOk({
      fullName: row.full_name,
      status: row.status,
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      country: row.country,
      state: row.state,
      city: row.city,
    });
  } catch {
    return parentQueryUnavailable();
  }
}
