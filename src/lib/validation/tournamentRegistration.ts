import { z } from "zod";
import { calculateAge } from "@/lib/validation/trial";
import type { TournamentCategory } from "@/content/tournaments";

/**
 * Tournament registration schema. Frontend-only for now — Supabase isn't
 * connected, so this schema validates shape/completeness only. It's
 * written to be reused server-side once backend submission exists (see
 * the "Registration Submission Behaviour" note in TournamentRegisterForm).
 *
 * Reuses `calculateAge` from the trial-form validation module rather
 * than duplicating date-of-birth/minor logic — the same age threshold
 * (18) determines whether guardian fields are required, exactly as in
 * TrialForm. Category eligibility is never assumed from a category's
 * name (e.g. "Junior") — only from date of birth via `calculateAge`.
 */

export const genderOptions = ["Prefer not to say", "Male", "Female", "Other"] as const;
export const chessLevels = ["New to Chess", "Beginner", "Intermediate", "Advanced", "Professional"] as const;

export const tournamentRegistrationSchema = z
  .object({
    playerFullName: z.string().trim().min(2, "Enter the player's full name."),
    dateOfBirth: z.string().min(1, "Date of birth is required."),
    gender: z.enum(genderOptions).optional().or(z.literal("")),
    fideId: z.string().trim().optional().or(z.literal("")),
    fideRating: z.string().trim().optional().or(z.literal("")),
    chessAssociationId: z.string().trim().optional().or(z.literal("")),
    country: z.string().trim().min(2, "Enter a country."),
    state: z.string().trim().min(1, "Enter a state or province."),
    city: z.string().trim().min(1, "Enter a city."),

    categoryId: z.string().trim().min(1, "Select a tournament category."),

    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().min(6, "Enter a valid phone number."),
    whatsapp: z.string().trim().optional().or(z.literal("")),

    parentName: z.string().trim().optional().or(z.literal("")),
    parentRelationship: z.string().trim().optional().or(z.literal("")),
    parentEmail: z.string().trim().optional().or(z.literal("")),
    parentPhone: z.string().trim().optional().or(z.literal("")),

    currentChessLevel: z.enum(chessLevels).optional().or(z.literal("")),
    schoolOrAcademy: z.string().trim().optional().or(z.literal("")),
    club: z.string().trim().optional().or(z.literal("")),

    rulesConsent: z.literal(true, { message: "You must acknowledge the tournament rules to continue." }),
    privacyConsent: z.literal(true, { message: "You must acknowledge the privacy notice to continue." }),
    mediaConsent: z.boolean().optional(),
    marketingConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const age = calculateAge(data.dateOfBirth);
    const isMinor = age === null || age < 18;

    if (isMinor) {
      if (!data.parentName) {
        ctx.addIssue({ code: "custom", path: ["parentName"], message: "Parent/guardian name is required for players under 18." });
      }
      if (!data.parentEmail || !z.string().email().safeParse(data.parentEmail).success) {
        ctx.addIssue({ code: "custom", path: ["parentEmail"], message: "A valid parent/guardian email is required for players under 18." });
      }
      if (!data.parentPhone) {
        ctx.addIssue({ code: "custom", path: ["parentPhone"], message: "Parent/guardian phone is required for players under 18." });
      }
      if (!data.parentRelationship) {
        ctx.addIssue({ code: "custom", path: ["parentRelationship"], message: "Specify the parent/guardian's relationship to the player." });
      }
    }
  });

export type TournamentRegistrationValues = z.infer<typeof tournamentRegistrationSchema>;

/**
 * Resolves a candidate category id to a real, configured category for
 * this tournament — never trusts an arbitrary client-supplied value (or
 * query parameter) directly. An unrecognized id resolves to `undefined`
 * rather than being inserted into the form.
 */
export function resolveCategoryId(
  candidateId: string | undefined,
  categories: TournamentCategory[],
): TournamentCategory | undefined {
  if (!candidateId) return undefined;
  return categories.find((category) => category.id === candidateId);
}
