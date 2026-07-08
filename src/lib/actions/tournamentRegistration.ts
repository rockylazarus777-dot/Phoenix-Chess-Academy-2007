"use server";

import { tournamentRegistrationSchema, resolveCategoryId } from "@/lib/validation/tournamentRegistration";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFormSubmissionRateLimiter, isHoneypotTriggered } from "@/lib/rate-limit";
import { getSafeMessage, logSubmissionError, resolveErrorCode } from "@/lib/actions/errors";
import { emptyToNull, parseOptionalInt, type SubmissionResult } from "@/lib/actions/shared";
import type { Tournament } from "@/content/tournaments";

export interface TournamentRegistrationSubmissionInput {
  playerFullName: string;
  dateOfBirth: string;
  gender?: string;
  fideId?: string;
  fideRating?: string;
  chessAssociationId?: string;
  country: string;
  state: string;
  city: string;
  categoryId: string;
  email: string;
  phone: string;
  whatsapp?: string;
  parentName?: string;
  parentRelationship?: string;
  parentEmail?: string;
  parentPhone?: string;
  currentChessLevel?: string;
  schoolOrAcademy?: string;
  club?: string;
  rulesConsent: boolean;
  privacyConsent: boolean;
  mediaConsent?: boolean;
  marketingConsent?: boolean;
  /** Honeypot field — must always be empty for a real submission. */
  website?: string;
}

/**
 * Server Action for Tournament Registration.
 *
 * `categoryId` here is the content-layer TournamentCategory.id string
 * (e.g. "under-14-open"), never a raw database UUID — the RPC resolves
 * it against `tournament_categories.category_key` for the matching
 * tournament row, server-side, so a tampered/unrecognized id is rejected
 * by the database itself, not just by client-side filtering. See
 * docs/DATABASE_ARCHITECTURE.md, "Tournament Registration Validation".
 */
export async function submitTournamentRegistration(
  tournament: Tournament,
  input: TournamentRegistrationSubmissionInput,
): Promise<SubmissionResult> {
  if (isHoneypotTriggered(input.website)) {
    return { success: true, message: "Your tournament registration has been received for review." };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeMessage("NOT_CONFIGURED") };
  }

  // Category is validated against this tournament's real, configured
  // categories before anything is sent to the database — mirrors the
  // client-side check in TournamentRegisterForm, re-run server-side
  // since client validation is UX only.
  const resolvedCategory = resolveCategoryId(input.categoryId, tournament.categories ?? []);
  if (!resolvedCategory) {
    return { success: false, message: getSafeMessage("INVALID_CATEGORY") };
  }

  const rateLimiter = getFormSubmissionRateLimiter();
  const rateLimitResult = await rateLimiter.check(`tournament-registration:${input.email.toLowerCase().trim()}`);
  if (!rateLimitResult.allowed) {
    return { success: false, message: getSafeMessage("RATE_LIMITED") };
  }

  const parsed = tournamentRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeMessage("VALIDATION_FAILED") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    // See the `as never` note in src/lib/actions/contact.ts — same
    // supabase-js inference gap for hand-written Database types, worked
    // around at the call site only.
    const { data, error } = await supabase.rpc("submit_tournament_registration", {
      p_tournament_slug: tournament.slug,
      p_category_key: resolvedCategory.id,
      p_player_full_name: parsed.data.playerFullName,
      p_date_of_birth: parsed.data.dateOfBirth,
      p_gender: emptyToNull(parsed.data.gender),
      p_fide_id: emptyToNull(parsed.data.fideId),
      p_fide_rating: parseOptionalInt(parsed.data.fideRating),
      p_chess_association_id: emptyToNull(parsed.data.chessAssociationId),
      p_country: parsed.data.country,
      p_state: parsed.data.state,
      p_city: parsed.data.city,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
      p_whatsapp: emptyToNull(parsed.data.whatsapp),
      p_parent_name: emptyToNull(parsed.data.parentName),
      p_parent_relationship: emptyToNull(parsed.data.parentRelationship),
      p_parent_email: emptyToNull(parsed.data.parentEmail),
      p_parent_phone: emptyToNull(parsed.data.parentPhone),
      p_current_chess_level: emptyToNull(parsed.data.currentChessLevel),
      p_school_or_academy: emptyToNull(parsed.data.schoolOrAcademy),
      p_club: emptyToNull(parsed.data.club),
      p_rules_acknowledged: parsed.data.rulesConsent,
      p_privacy_acknowledged: parsed.data.privacyConsent,
      p_media_consent: Boolean(parsed.data.mediaConsent),
      p_marketing_consent: Boolean(parsed.data.marketingConsent),
      p_source: "website",
    } as never);

    if (error) {
      const code = resolveErrorCode(error.message);
      logSubmissionError({ submissionType: "tournament_registration", code, postgresErrorCode: error.code });
      return { success: false, message: getSafeMessage(code) };
    }

    return {
      success: true,
      message: "Your tournament registration has been received for review.",
      id: data ?? undefined,
    };
  } catch {
    logSubmissionError({ submissionType: "tournament_registration", code: "UNKNOWN" });
    return { success: false, message: getSafeMessage("UNKNOWN") };
  }
}
