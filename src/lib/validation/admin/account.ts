import { z } from "zod";

export const provisionAccountSchema = z.object({
  recordId: z.string().uuid(),
});

/**
 * Only STAFF/ADMIN are ever assignable through this schema —
 * SUPER_ADMIN is deliberately not one of the allowed values anywhere in
 * Phase 10's UI. See docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Privileged
 * Role Management".
 */
export const changeStaffRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(["STAFF", "ADMIN"]),
});

export type ChangeStaffRoleValues = z.infer<typeof changeStaffRoleSchema>;
