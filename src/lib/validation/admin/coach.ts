import { z } from "zod";

export const coachStatusValues = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const batchCoachRoleValues = ["PRIMARY", "ASSISTANT", "GUEST"] as const;

export const createCoachSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(200),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  // Comma-separated in the form UI, split/trimmed server-side into
  // text[] — no invented specialization taxonomy, just free-text labels
  // the academy actually uses.
  specializations: z.string().trim().max(500).optional().or(z.literal("")),
  joinedOn: z.string().trim().optional().or(z.literal("")),
});

export type CreateCoachValues = z.infer<typeof createCoachSchema>;
export const updateCoachSchema = createCoachSchema;
export type UpdateCoachValues = z.infer<typeof updateCoachSchema>;

export const changeCoachStatusSchema = z.object({ status: z.enum(coachStatusValues) });

export const assignBatchCoachSchema = z.object({
  batchId: z.string().uuid(),
  coachId: z.string().uuid(),
  role: z.enum(batchCoachRoleValues).default("ASSISTANT"),
});

export const unassignBatchCoachSchema = z.object({
  batchCoachId: z.string().uuid(),
});
