"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  createStudentSchema,
  updateStudentSchema,
  changeStudentStatusSchema,
  type CreateStudentValues,
  type UpdateStudentValues,
  type ChangeStudentStatusValues,
} from "@/lib/validation/admin/student";
import type { UserRole } from "@/lib/supabase/types";

/**
 * Admin Server Actions for the student business record.
 *
 * Every export here independently calls `requirePermission()` — this is
 * the real authorization boundary (see docs/ADMIN_OPERATIONS_ARCHITECTURE.md,
 * "Permission Security"). The /admin layout's `requireRole()` (Phase 9)
 * only gates page rendering; a STAFF user without MANAGE_STUDENTS who
 * somehow invokes this action directly is still denied here.
 */

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createStudent(input: CreateStudentValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const parsed = createStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.rpc("create_student_with_audit", {
      p_full_name: parsed.data.fullName,
      p_date_of_birth: parsed.data.dateOfBirth,
      p_gender: emptyToNull(parsed.data.gender),
      p_email: emptyToNull(parsed.data.email),
      p_phone: emptyToNull(parsed.data.phone),
      p_whatsapp: emptyToNull(parsed.data.whatsapp),
      p_country: parsed.data.country,
      p_state: emptyToNull(parsed.data.state),
      p_city: emptyToNull(parsed.data.city),
      p_address: emptyToNull(parsed.data.address),
      p_fide_id: emptyToNull(parsed.data.fideId),
      p_fide_rating: parseOptionalInt(parsed.data.fideRating),
      p_chess_association_id: emptyToNull(parsed.data.chessAssociationId),
      p_current_level: emptyToNull(parsed.data.currentLevel),
      p_joined_on: emptyToNull(parsed.data.joinedOn),
      p_notes: emptyToNull(parsed.data.notes),
      p_actor_profile_id: profile.id,
      p_actor_role: profile.role as UserRole,
    } as never);

    if (error) {
      logAdminEvent({ area: "students", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath("/admin/students");
    return { success: true, data: { id: data as unknown as string } };
  } catch {
    logAdminEvent({ area: "students", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateStudent(id: string, input: UpdateStudentValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const parsed = updateStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("students")
      .update({
        full_name: parsed.data.fullName,
        date_of_birth: parsed.data.dateOfBirth,
        gender: emptyToNull(parsed.data.gender),
        email: emptyToNull(parsed.data.email),
        phone: emptyToNull(parsed.data.phone),
        whatsapp: emptyToNull(parsed.data.whatsapp),
        country: parsed.data.country,
        state: emptyToNull(parsed.data.state),
        city: emptyToNull(parsed.data.city),
        address: emptyToNull(parsed.data.address),
        fide_id: emptyToNull(parsed.data.fideId),
        fide_rating: parseOptionalInt(parsed.data.fideRating),
        chess_association_id: emptyToNull(parsed.data.chessAssociationId),
        current_level: emptyToNull(parsed.data.currentLevel),
        joined_on: emptyToNull(parsed.data.joinedOn),
        notes: emptyToNull(parsed.data.notes),
      } as never)
      .eq("id", id as never);

    if (error) {
      logAdminEvent({ area: "students", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    await recordAdminAudit({
      actor: profile,
      action: "STUDENT_UPDATED",
      entityType: "student",
      entityId: id,
      summary: "Student record updated.",
    });

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${id}`);
    return { success: true };
  } catch {
    logAdminEvent({ area: "students", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function changeStudentStatus(id: string, input: ChangeStudentStatusValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  const parsed = changeStudentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("students")
      .update({ status: parsed.data.status } as never)
      .eq("id", id as never);

    if (error) {
      logAdminEvent({ area: "students", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    await recordAdminAudit({
      actor: profile,
      action: "STUDENT_STATUS_CHANGED",
      entityType: "student",
      entityId: id,
      summary: `Student status changed to ${parsed.data.status}.`,
      metadata: { status_to: parsed.data.status },
    });

    revalidatePath("/admin/students");
    revalidatePath(`/admin/students/${id}`);
    return { success: true };
  } catch {
    logAdminEvent({ area: "students", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
