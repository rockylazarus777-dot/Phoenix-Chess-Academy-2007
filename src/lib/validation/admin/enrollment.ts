import { z } from "zod";

export const enrollmentStatusValues = ["ACTIVE", "PAUSED", "COMPLETED", "WITHDRAWN", "CANCELLED"] as const;

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid("Select a student."),
  programId: z.string().uuid("Select a program."),
  batchId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateEnrollmentValues = z.infer<typeof createEnrollmentSchema>;

export const changeEnrollmentStatusSchema = z.object({
  status: z.enum(enrollmentStatusValues),
});
