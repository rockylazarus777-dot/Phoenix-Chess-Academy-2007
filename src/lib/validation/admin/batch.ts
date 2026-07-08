import { z } from "zod";

export const batchStatusValues = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
export const trainingModeValues = ["ONLINE", "OFFLINE", "HYBRID"] as const;

export const createBatchSchema = z
  .object({
    batchCode: z.string().trim().min(1, "Batch code is required.").max(50),
    name: z.string().trim().min(1, "Batch name is required.").max(200),
    programId: z.string().uuid("Select a program."),
    locationId: z.string().uuid().optional().or(z.literal("")),
    trainingMode: z.enum(trainingModeValues),
    level: z.string().trim().max(100).optional().or(z.literal("")),
    primaryCoachId: z.string().uuid().optional().or(z.literal("")),
    capacity: z.string().trim().max(6).optional().or(z.literal("")),
    startDate: z.string().trim().optional().or(z.literal("")),
    endDate: z.string().trim().optional().or(z.literal("")),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export type CreateBatchValues = z.infer<typeof createBatchSchema>;
export const updateBatchSchema = createBatchSchema;
export type UpdateBatchValues = z.infer<typeof updateBatchSchema>;

export const changeBatchStatusSchema = z.object({ status: z.enum(batchStatusValues) });
