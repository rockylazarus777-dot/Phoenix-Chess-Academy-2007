import { z } from "zod";

/**
 * Student business-record schemas. Client-side validation here is UX
 * only — src/lib/actions/admin/students.ts re-validates with these same
 * schemas server-side, since the client's own pass can always be
 * bypassed. Controlled fields (student_code, status-on-create,
 * profile_id, created_at/updated_at) are deliberately NOT part of this
 * schema — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Admin Forms".
 */
export const studentStatusValues = ["ACTIVE", "INACTIVE", "ON_HOLD", "ALUMNI", "ARCHIVED"] as const;

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(200),
  dateOfBirth: z.string().trim().min(1, "Date of birth is required."),
  gender: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  country: z.string().trim().min(1, "Country is required.").max(100),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  fideId: z.string().trim().max(50).optional().or(z.literal("")),
  fideRating: z.string().trim().max(6).optional().or(z.literal("")),
  chessAssociationId: z.string().trim().max(50).optional().or(z.literal("")),
  currentLevel: z.string().trim().max(100).optional().or(z.literal("")),
  joinedOn: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateStudentValues = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema;
export type UpdateStudentValues = z.infer<typeof updateStudentSchema>;

export const changeStudentStatusSchema = z.object({
  status: z.enum(studentStatusValues),
});
export type ChangeStudentStatusValues = z.infer<typeof changeStudentStatusSchema>;

export const studentSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  status: z.enum(studentStatusValues).optional(),
});
