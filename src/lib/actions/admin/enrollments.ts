"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import { createEnrollmentSchema, changeEnrollmentStatusSchema, type CreateEnrollmentValues } from "@/lib/validation/admin/enrollment";
import type { UserRole } from "@/lib/supabase/types";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Enrollment creation is a Server Action, never an automatic
 * side-effect of anything else — see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Enrollment Management UI": account provisioning never happens
 * automatically when an enrollment is created, and vice versa.
 */
export async function createEnrollment(input: CreateEnrollmentValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_ENROLLMENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = createEnrollmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.rpc("create_enrollment_with_audit", {
      p_student_id: parsed.data.studentId,
      p_program_id: parsed.data.programId,
      p_batch_id: emptyToNull(parsed.data.batchId),
      p_notes: emptyToNull(parsed.data.notes),
      p_actor_profile_id: profile.id,
      p_actor_role: profile.role as UserRole,
    } as never);

    if (error) {
      logAdminEvent({ area: "enrollments", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${parsed.data.studentId}`);
    return { success: true, data: { id: data as unknown as string } };
  } catch {
    logAdminEvent({ area: "enrollments", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function changeEnrollmentStatus(id: string, status: string, studentId: string): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_ENROLLMENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = changeEnrollmentStatusSchema.safeParse({ status });
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("student_program_enrollments")
      .update({ status: parsed.data.status } as never)
      .eq("id", id as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "ENROLLMENT_UPDATED",
      entityType: "enrollment",
      entityId: id,
      summary: `Enrollment status changed to ${parsed.data.status}.`,
      metadata: { status_to: parsed.data.status },
    });

    revalidatePath("/admin/enrollments");
    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
