import { z } from "zod";

export const parentStatusValues = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const parentRelationshipValues = ["MOTHER", "FATHER", "GUARDIAN", "OTHER"] as const;

export const createParentSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(200),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().min(1, "Phone is required.").max(30),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateParentValues = z.infer<typeof createParentSchema>;
export const updateParentSchema = createParentSchema;
export type UpdateParentValues = z.infer<typeof updateParentSchema>;

export const changeParentStatusSchema = z.object({ status: z.enum(parentStatusValues) });

export const linkParentSchema = z.object({
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
  relationship: z.enum(parentRelationshipValues),
  isPrimary: z.boolean().default(false),
  canReceiveUpdates: z.boolean().default(true),
  canManageStudent: z.boolean().default(false),
});
export type LinkParentValues = z.infer<typeof linkParentSchema>;

export const unlinkParentSchema = z.object({
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
});
