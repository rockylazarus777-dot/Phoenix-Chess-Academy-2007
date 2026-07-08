"use server";

import { trialFormSchema } from "@/lib/validation/trial";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFormSubmissionRateLimiter, isHoneypotTriggered } from "@/lib/rate-limit";
import { getSafeMessage, logSubmissionError, resolveErrorCode } from "@/lib/actions/errors";
import { emptyToNull, parseOptionalInt, type SubmissionResult } from "@/lib/actions/shared";

export interface TrialSubmissionInput {
  studentFullName: string;
  dateOfBirth: string;
  chessLevel: string;
  fideId?: string;
  fideRating?: string;
  country: string;
  state: string;
  city: string;
  preferredProgram: string;
  trainingMode: string;
  preferredSchedule?: string;
  goals?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentRelationship?: string;
  privacyConsent: boolean;
  marketingConsent?: boolean;
  /** Honeypot field — must always be empty for a real submission. */
  website?: string;
}

/**
 * Server Action for the Book a Trial form. Guardian-for-minors is
 * enforced by re-running `trialFormSchema` (the same `.superRefine`
 * age logic as the client) server-side — never trusted from the
 * client's own validation pass.
 */
export async function submitTrialBooking(input: TrialSubmissionInput): Promise<SubmissionResult> {
  if (isHoneypotTriggered(input.website)) {
    return { success: true, message: "Your trial request has been received." };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeMessage("NOT_CONFIGURED") };
  }

  // TrialForm has no direct student contact field — parentEmail is the
  // best available rate-limit key; falls back to a name+DOB composite
  // when no guardian email was given (adult students, optional field).
  const rateLimitKey = input.parentEmail
    ? `trial:${input.parentEmail.toLowerCase().trim()}`
    : `trial:${input.studentFullName.toLowerCase().trim()}:${input.dateOfBirth}`;
  const rateLimiter = getFormSubmissionRateLimiter();
  const rateLimitResult = await rateLimiter.check(rateLimitKey);
  if (!rateLimitResult.allowed) {
    return { success: false, message: getSafeMessage("RATE_LIMITED") };
  }

  const parsed = trialFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeMessage("VALIDATION_FAILED") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    // See the `as never` note in src/lib/actions/contact.ts — same
    // supabase-js inference gap for hand-written Database types, worked
    // around at the call site only.
    const { data, error } = await supabase.rpc("submit_trial_booking", {
      p_student_full_name: parsed.data.studentFullName,
      p_date_of_birth: parsed.data.dateOfBirth,
      p_chess_level: parsed.data.chessLevel,
      p_fide_id: emptyToNull(parsed.data.fideId),
      p_fide_rating: parseOptionalInt(parsed.data.fideRating),
      p_country: parsed.data.country,
      p_state: parsed.data.state,
      p_city: parsed.data.city,
      p_preferred_program: parsed.data.preferredProgram,
      p_training_mode: parsed.data.trainingMode,
      p_preferred_schedule: emptyToNull(parsed.data.preferredSchedule),
      p_goals: emptyToNull(parsed.data.goals),
      p_parent_name: emptyToNull(parsed.data.parentName),
      p_parent_email: emptyToNull(parsed.data.parentEmail),
      p_parent_phone: emptyToNull(parsed.data.parentPhone),
      p_parent_relationship: emptyToNull(parsed.data.parentRelationship),
      p_privacy_acknowledged: parsed.data.privacyConsent,
      p_marketing_consent: Boolean(parsed.data.marketingConsent),
      p_source: "website",
    } as never);

    if (error) {
      const code = resolveErrorCode(error.message);
      logSubmissionError({ submissionType: "trial_booking", code, postgresErrorCode: error.code });
      return { success: false, message: getSafeMessage(code) };
    }

    return { success: true, message: "Your trial request has been received.", id: data ?? undefined };
  } catch {
    logSubmissionError({ submissionType: "trial_booking", code: "UNKNOWN" });
    return { success: false, message: getSafeMessage("UNKNOWN") };
  }
}
