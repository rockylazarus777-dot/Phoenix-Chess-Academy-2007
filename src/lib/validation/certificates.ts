import { z } from "zod";

/**
 * Mirrors `public.certificate_type` exactly (Phase 17). A closed,
 * curated set — never an unlimited arbitrary certificate type string.
 * See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate Type
 * Architecture".
 */
export const certificateTypeValues = [
  "PROGRAM_COMPLETION",
  "PARTICIPATION",
  "TOURNAMENT_PARTICIPATION",
  "TOURNAMENT_ACHIEVEMENT",
  "SPECIAL_RECOGNITION",
] as const;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shared title/description field rules — matches the database check
 * constraints in 0025_certificates_achievements.sql exactly (client-side
 * validation is a usability convenience; the database constraint remains
 * the authoritative backstop). See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
 * "Certificate Text Limits".
 */
const certificateContentFields = {
  title: z.string().trim().min(1, "Enter a certificate title.").max(200, "Title must be 200 characters or fewer."),
  description: z.string().trim().max(3000, "Description must be 3000 characters or fewer.").optional().or(z.literal("")),
  programId: z.string().uuid().optional().or(z.literal("")),
  tournamentId: z.string().uuid().optional().or(z.literal("")),
  achievementId: z.string().uuid().optional().or(z.literal("")),
};

/**
 * CERTIFICATE CONTEXT VALIDATION — mirrors
 * student_certificates_context_check exactly: PROGRAM_COMPLETION requires
 * programId; TOURNAMENT_PARTICIPATION/TOURNAMENT_ACHIEVEMENT require
 * tournamentId; PARTICIPATION/SPECIAL_RECOGNITION have no required
 * context field. `create_student_certificate()`/`update_student_certificate()`
 * independently re-validate this server-side — this schema is a usability
 * convenience, never the authoritative check.
 */
function withCertificateContextRefinements<T extends z.ZodType<{ certificateType: (typeof certificateTypeValues)[number]; programId?: string; tournamentId?: string }>>(schema: T) {
  return schema
    .refine((values) => values.certificateType !== "PROGRAM_COMPLETION" || Boolean(values.programId), {
      message: "Select a program for a Program Completion certificate.",
      path: ["programId"],
    })
    .refine(
      (values) => !["TOURNAMENT_PARTICIPATION", "TOURNAMENT_ACHIEVEMENT"].includes(values.certificateType) || Boolean(values.tournamentId),
      {
        message: "Select a tournament for this certificate type.",
        path: ["tournamentId"],
      },
    );
}

/**
 * Admin-submitted new-certificate form. `studentId` comes from the
 * narrow admin student search result, never a free-text field. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Create Certificate RPC".
 */
export const createCertificateSchema = withCertificateContextRefinements(
  z.object({
    studentId: z.string().uuid("Select a student."),
    certificateType: z.enum(certificateTypeValues),
    ...certificateContentFields,
  }),
);

export type CreateCertificateValues = z.infer<typeof createCertificateSchema>;

/**
 * Admin-submitted edit form for an existing DRAFT certificate.
 * `certificateId` is a route/resource identifier only — the server
 * independently re-verifies status (DRAFT) before applying any change.
 * `studentId` is deliberately absent — it can never be changed by this
 * form (see "Update Certificate RPC").
 */
export const updateCertificateSchema = withCertificateContextRefinements(
  z.object({
    certificateId: z.string().uuid(),
    certificateType: z.enum(certificateTypeValues),
    ...certificateContentFields,
  }),
);

export type UpdateCertificateValues = z.infer<typeof updateCertificateSchema>;

/**
 * Admin-submitted issue form. `issuedOn` must not be a future date
 * (matches student_certificates_issued_on_not_future_check). Never
 * accepts `certificateNumber` — always server-generated.
 */
export const issueCertificateSchema = z.object({
  certificateId: z.string().uuid(),
  issuedOn: z
    .string()
    .trim()
    .regex(isoDateRegex, "Enter a valid issue date.")
    .refine((value) => value <= new Date().toISOString().slice(0, 10), {
      message: "Issue date cannot be in the future.",
    }),
});

export type IssueCertificateValues = z.infer<typeof issueCertificateSchema>;

/**
 * Admin-submitted revoke form. Revocation reason is required (matches
 * student_certificates_revocation_consistency_check).
 */
export const revokeCertificateSchema = z.object({
  certificateId: z.string().uuid(),
  revocationReason: z.string().trim().min(1, "Enter a reason for revoking this certificate.").max(2000, "Reason must be 2000 characters or fewer."),
});

export type RevokeCertificateValues = z.infer<typeof revokeCertificateSchema>;

/**
 * Admin student search input — shared by both the certificate and
 * achievement "new" forms. Minimum 2 characters (matches
 * search_students_for_admin_record()'s own minimum-length check).
 */
export const adminStudentSearchSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters.").max(100, "Search text must be 100 characters or fewer."),
});

export type AdminStudentSearchValues = z.infer<typeof adminStudentSearchSchema>;
