import { z } from "zod";

/**
 * Contact form schema.
 *
 * Why Zod instead of only native HTML validation: this schema is written
 * so it can be reused, unchanged, as server-side input validation once a
 * Server Action / API route is wired up in a later phase (Supabase isn't
 * configured yet — see the project's security requirements around
 * validating all server-side input). Native `required`/`type=email`
 * attributes give a first line of defense in the browser, but they can be
 * bypassed entirely (devtools, direct API calls) and don't express rules
 * like enum-constrained enquiry types or cross-field logic. Keeping one
 * typed schema — rather than duplicating rules in JSX now and again in a
 * server action later — avoids the two definitions drifting apart.
 */
export const enquiryTypes = [
  "General Enquiry",
  "Training Enquiry",
  "Tournament Enquiry",
  "Partnership Enquiry",
  "Other",
] as const;

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().min(2, "Enter your country."),
  enquiryType: z.enum(enquiryTypes, { message: "Select an enquiry type." }),
  subject: z.string().trim().min(3, "Enter a subject."),
  message: z.string().trim().min(10, "Message must be at least 10 characters."),
  consent: z.literal(true, {
    message: "You must acknowledge the privacy notice to continue.",
  }),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
