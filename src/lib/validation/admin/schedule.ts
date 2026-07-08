import { z } from "zod";

export const weekdayValues = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

export const createScheduleSchema = z
  .object({
    batchId: z.string().uuid("Select a batch."),
    dayOfWeek: z.enum(weekdayValues),
    startTime: z.string().trim().min(1, "Start time is required."),
    endTime: z.string().trim().min(1, "End time is required."),
    timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
    effectiveFrom: z.string().trim().optional().or(z.literal("")),
    effectiveUntil: z.string().trim().optional().or(z.literal("")),
    active: z.boolean().default(true),
  })
  .refine((values) => values.endTime > values.startTime, {
    message: "End time must be after the start time.",
    path: ["endTime"],
  })
  .refine(
    (values) => !values.effectiveFrom || !values.effectiveUntil || values.effectiveUntil >= values.effectiveFrom,
    { message: "Effective-until date must be on or after effective-from.", path: ["effectiveUntil"] },
  );

export type CreateScheduleValues = z.infer<typeof createScheduleSchema>;
export const updateScheduleSchema = createScheduleSchema;
