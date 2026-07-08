import { z } from "zod";

/**
 * Book a Trial form schema. Same rationale as contact.ts for using Zod:
 * this form has genuine cross-field logic (parent/guardian details are
 * only required for minor students) that native HTML validation can't
 * express, and the schema is written to be reused server-side once
 * Supabase-backed submission exists.
 */
export const chessLevels = ["New to Chess", "Beginner", "Intermediate", "Advanced", "Professional"] as const;
export const trainingModes = ["Online", "Offline", "No Preference"] as const;
export const preferredPrograms = [
  "Beginner Chess",
  "Intermediate Chess",
  "Advanced Chess",
  "Professional Chess Training",
  "Tournament Preparation",
  "Online Chess Coaching",
  "Not Sure Yet",
] as const;

function calculateAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

export const trialFormSchema = z
  .object({
    studentFullName: z.string().trim().min(2, "Enter the student's full name."),
    dateOfBirth: z.string().min(1, "Date of birth is required."),
    chessLevel: z.enum(chessLevels, { message: "Select a chess level." }),
    fideId: z.string().trim().optional().or(z.literal("")),
    fideRating: z.string().trim().optional().or(z.literal("")),
    country: z.string().trim().min(2, "Enter a country."),
    state: z.string().trim().min(1, "Enter a state or province."),
    city: z.string().trim().min(1, "Enter a city."),

    preferredProgram: z.enum(preferredPrograms, { message: "Select a preferred program." }),
    trainingMode: z.enum(trainingModes, { message: "Select a training mode." }),
    preferredSchedule: z.string().trim().optional().or(z.literal("")),
    goals: z.string().trim().max(1000, "Keep this under 1000 characters.").optional().or(z.literal("")),

    parentName: z.string().trim().optional().or(z.literal("")),
    parentEmail: z.string().trim().optional().or(z.literal("")),
    parentPhone: z.string().trim().optional().or(z.literal("")),
    parentRelationship: z.string().trim().optional().or(z.literal("")),

    privacyConsent: z.literal(true, { message: "You must acknowledge the privacy notice to continue." }),
    marketingConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const age = calculateAge(data.dateOfBirth);
    const isMinor = age === null || age < 18;

    if (isMinor) {
      if (!data.parentName) {
        ctx.addIssue({ code: "custom", path: ["parentName"], message: "Parent/guardian name is required for students under 18." });
      }
      if (!data.parentEmail || !z.string().email().safeParse(data.parentEmail).success) {
        ctx.addIssue({ code: "custom", path: ["parentEmail"], message: "A valid parent/guardian email is required for students under 18." });
      }
      if (!data.parentPhone) {
        ctx.addIssue({ code: "custom", path: ["parentPhone"], message: "Parent/guardian phone is required for students under 18." });
      }
      if (!data.parentRelationship) {
        ctx.addIssue({ code: "custom", path: ["parentRelationship"], message: "Specify the parent/guardian's relationship to the student." });
      }
    }
  });

export type TrialFormValues = z.infer<typeof trialFormSchema>;
export { calculateAge };

/**
 * Resolves a `?program=<slug>` query value to a valid preferredProgram
 * display value — only if the slug matches a real, active program.
 * Never trusts the raw query string directly; an unrecognized slug
 * resolves to undefined and the form simply falls back to its default
 * unselected state.
 */
export function resolveProgramSlugToLabel(
  slug: string | undefined,
  lookup: (slug: string) => { name: string } | undefined,
): (typeof preferredPrograms)[number] | undefined {
  if (!slug) return undefined;
  const program = lookup(slug);
  if (!program) return undefined;
  const match = preferredPrograms.find((label) => label === program.name);
  return match;
}
