"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  createParentSchema,
  updateParentSchema,
  changeParentStatusSchema,
  linkParentSchema,
  unlinkParentSchema,
  type CreateParentValues,
  type UpdateParentValues,
  type LinkParentValues,
} from "@/lib/validation/admin/parent";
import type { UserRole } from "@/lib/supabase/types";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function createParent(input: CreateParentValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_PARENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = createParentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("parents")
      .insert({
        full_name: parsed.data.fullName,
        email: emptyToNull(parsed.data.email),
        phone: parsed.data.phone.trim(),
        whatsapp: emptyToNull(parsed.data.whatsapp),
        country: emptyToNull(parsed.data.country),
        state: emptyToNull(parsed.data.state),
        city: emptyToNull(parsed.data.city),
        notes: emptyToNull(parsed.data.notes),
      } as never)
      .select("id")
      .single();

    if (error) {
      logAdminEvent({ area: "parents", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    const id = (data as unknown as { id: string }).id;
    await recordAdminAudit({ actor: profile, action: "PARENT_CREATED", entityType: "parent", entityId: id, summary: "Parent created." });

    revalidatePath("/admin/parents");
    return { success: true, data: { id } };
  } catch {
    logAdminEvent({ area: "parents", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateParent(id: string, input: UpdateParentValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_PARENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = updateParentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("parents")
      .update({
        full_name: parsed.data.fullName,
        email: emptyToNull(parsed.data.email),
        phone: parsed.data.phone.trim(),
        whatsapp: emptyToNull(parsed.data.whatsapp),
        country: emptyToNull(parsed.data.country),
        state: emptyToNull(parsed.data.state),
        city: emptyToNull(parsed.data.city),
        notes: emptyToNull(parsed.data.notes),
      } as never)
      .eq("id", id as never);

    if (error) {
      logAdminEvent({ area: "parents", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    await recordAdminAudit({ actor: profile, action: "PARENT_UPDATED", entityType: "parent", entityId: id, summary: "Parent record updated." });

    revalidatePath("/admin/parents");
    revalidatePath(`/admin/parents/${id}`);
    return { success: true };
  } catch {
    logAdminEvent({ area: "parents", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function changeParentStatus(id: string, status: string): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_PARENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = changeParentStatusSchema.safeParse({ status });
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("parents").update({ status: parsed.data.status } as never).eq("id", id as never);
    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "PARENT_UPDATED",
      entityType: "parent",
      entityId: id,
      summary: `Parent status changed to ${parsed.data.status}.`,
      metadata: { status_to: parsed.data.status },
    });

    revalidatePath("/admin/parents");
    revalidatePath(`/admin/parents/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function linkParentToStudent(input: LinkParentValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = linkParentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.rpc("link_parent_to_student_with_audit", {
      p_student_id: parsed.data.studentId,
      p_parent_id: parsed.data.parentId,
      p_relationship: parsed.data.relationship,
      p_is_primary: parsed.data.isPrimary,
      p_can_receive_updates: parsed.data.canReceiveUpdates,
      p_can_manage_student: parsed.data.canManageStudent,
      p_actor_profile_id: profile.id,
      p_actor_role: profile.role as UserRole,
    } as never);

    if (error) {
      logAdminEvent({ area: "parents", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/students/${parsed.data.studentId}`);
    revalidatePath(`/admin/parents/${parsed.data.parentId}`);
    return { success: true };
  } catch {
    logAdminEvent({ area: "parents", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function unlinkParentFromStudent(input: { studentId: string; parentId: string }): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_STUDENTS");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = unlinkParentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("student_parents")
      .delete()
      .eq("student_id", parsed.data.studentId as never)
      .eq("parent_id", parsed.data.parentId as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "PARENT_UNLINKED",
      entityType: "student",
      entityId: parsed.data.studentId,
      summary: "Parent unlinked from student.",
      metadata: { parent_id: parsed.data.parentId },
    });

    revalidatePath(`/admin/students/${parsed.data.studentId}`);
    revalidatePath(`/admin/parents/${parsed.data.parentId}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
