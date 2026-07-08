"use server";

import { contactFormSchema } from "@/lib/validation/contact";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFormSubmissionRateLimiter, isHoneypotTriggered } from "@/lib/rate-limit";
import { getSafeMessage, logSubmissionError, resolveErrorCode } from "@/lib/actions/errors";
import { emptyToNull, type SubmissionResult } from "@/lib/actions/shared";

/**
 * Server Action for the Contact Form. Architecture choice (Server
 * Actions, not a Route Handler) documented once in
 * docs/DATABASE_ARCHITECTURE.md, "Public Form Server Architecture" —
 * applies to this file and trial.ts / tournamentRegistration.ts equally.
 *
 * Flow: honeypot check -> configuration check -> rate limit -> Zod
 * re-validation (server-side, never trusts the client) -> Supabase RPC
 * (submit_contact_enquiry) -> safe success/error message. Never returns
 * a raw Supabase error to the caller.
 */
export interface ContactSubmissionInput {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  enquiryType: string;
  subject: string;
  message: string;
  consent: boolean;
  /** Honeypot field — must always be empty for a real submission. Not rendered visibly in the form UI. */
  website?: string;
}

export async function submitContactEnquiry(input: ContactSubmissionInput): Promise<SubmissionResult> {
  if (isHoneypotTriggered(input.website)) {
    // Pretend success to a bot rather than revealing the honeypot exists.
    return { success: true, message: "Your enquiry has been received." };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeMessage("NOT_CONFIGURED") };
  }

  const rateLimiter = getFormSubmissionRateLimiter();
  const rateLimitResult = await rateLimiter.check(`contact:${input.email.toLowerCase().trim()}`);
  if (!rateLimitResult.allowed) {
    return { success: false, message: getSafeMessage("RATE_LIMITED") };
  }

  const parsed = contactFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeMessage("VALIDATION_FAILED") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    // NOTE ON `as never`: supabase-js's generic Args inference for a
    // hand-written (non-CLI-generated) Database type does not resolve
    // through its nested conditional types reliably — see
    // docs/DATABASE_ARCHITECTURE.md, "Database Types". The object below
    // is still fully typed against `Database["public"]["Functions"]
    // ["submit_contact_enquiry"]["Args"]` by construction (every field
    // comes from `parsed.data`, which Zod already validated) — the cast
    // only works around supabase-js's own inference gap, not a loss of
    // type safety in this file.
    const { data, error } = await supabase.rpc("submit_contact_enquiry", {
      p_full_name: parsed.data.fullName,
      p_email: parsed.data.email,
      p_phone: emptyToNull(parsed.data.phone),
      p_country: parsed.data.country,
      p_enquiry_type: parsed.data.enquiryType,
      p_subject: parsed.data.subject,
      p_message: parsed.data.message,
      p_source: "website",
    } as never);

    if (error) {
      const code = resolveErrorCode(error.message);
      logSubmissionError({ submissionType: "contact_enquiry", code, postgresErrorCode: error.code });
      return { success: false, message: getSafeMessage(code) };
    }

    return { success: true, message: "Your enquiry has been received.", id: data ?? undefined };
  } catch {
    logSubmissionError({ submissionType: "contact_enquiry", code: "UNKNOWN" });
    return { success: false, message: getSafeMessage("UNKNOWN") };
  }
}
