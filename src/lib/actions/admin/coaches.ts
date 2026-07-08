"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  createCoachSchema,
  updateCoachSchema,
  changeCoachStatusSchema,
  assignBatchCoachSchema,
  unassignBatchCoachSchema,
  type CreateCoachValues,
  type UpdateCoachValues,
} from "@/lib/validation/admin/coach";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseSpecializations(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function createCoach(input: CreateCoachValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_COACHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = createCoachSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("coaches")
      .insert({
        full_name: parsed.data.fullName,
        email: emptyToNull(parsed.data.email),
        phone: emptyToNull(parsed.data.phone),
        whatsapp: emptyToNull(parsed.data.whatsapp),
        bio: emptyToNull(parsed.data.bio),
        specializations: parseSpecializations(parsed.data.specializations),
        joined_on: emptyToNull(parsed.data.joinedOn),
      } as never)
      .select("id")
      .single();

    if (error) {
      logAdminEvent({ area: "coaches", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    const id = (data as unknown as { id: string }).id;
    await recordAdminAudit({ actor: profile, action: "COACH_CREATED", entityType: "coach", entityId: id, summary: "Coach created." });

    revalidatePath("/admin/coaches");
    return { success: true, data: { id } };
  } catch {
    logAdminEvent({ area: "coaches", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateCoach(id: string, input: UpdateCoachValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_COACHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = updateCoachSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("coaches")
      .update({
        full_name: parsed.data.fullName,
        email: emptyToNull(parsed.data.email),
        phone: emptyToNull(parsed.data.phone),
        whatsapp: emptyToNull(parsed.data.whatsapp),
        bio: emptyToNull(parsed.data.bio),
        specializations: parseSpecializations(parsed.data.specializations),
        joined_on: emptyToNull(parsed.data.joinedOn),
      } as never)
      .eq("id", id as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({ actor: profile, action: "COACH_UPDATED", entityType: "coach", entityId: id, summary: "Coach record updated." });

    revalidatePath("/admin/coaches");
    revalidatePath(`/admin/coaches/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function changeCoachStatus(id: string, status: string): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_COACHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = changeCoachStatusSchema.safeParse({ status });
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("coaches").update({ status: parsed.data.status } as never).eq("id", id as never);
    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "COACH_UPDATED",
      entityType: "coach",
      entityId: id,
      summary: `Coach status changed to ${parsed.data.status}.`,
      metadata: { status_to: parsed.data.status },
    });

    revalidatePath("/admin/coaches");
    revalidatePath(`/admin/coaches/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function assignBatchCoach(input: { batchId: string; coachId: string; role: string }): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_BATCHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = assignBatchCoachSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("batch_coaches").insert({
      batch_id: parsed.data.batchId,
      coach_id: parsed.data.coachId,
      role: parsed.data.role,
    } as never);

    if (error) {
      // Most likely the partial-unique-index conflict (already assigned
      // in this role) — surfaced as a safe CONFLICT, never the raw
      // constraint name.
      return { success: false, message: getSafeAdminMessage("CONFLICT") };
    }

    await recordAdminAudit({
      actor: profile,
      action: "BATCH_COACH_ASSIGNED",
      entityType: "batch",
      entityId: parsed.data.batchId,
      summary: `Coach assigned to batch (${parsed.data.role}).`,
      metadata: { coach_id: parsed.data.coachId, role: parsed.data.role },
    });

    revalidatePath(`/admin/batches/${parsed.data.batchId}`);
    revalidatePath(`/admin/coaches/${parsed.data.coachId}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function unassignBatchCoach(input: { batchCoachId: string; batchId: string; coachId: string }): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_BATCHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = unassignBatchCoachSchema.safeParse({ batchCoachId: input.batchCoachId });
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("batch_coaches")
      .update({ ended_at: new Date().toISOString() } as never)
      .eq("id", parsed.data.batchCoachId as never);

    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "BATCH_COACH_UNASSIGNED",
      entityType: "batch",
      entityId: input.batchId,
      summary: "Coach unassigned from batch.",
      metadata: { coach_id: input.coachId },
    });

    revalidatePath(`/admin/batches/${input.batchId}`);
    revalidatePath(`/admin/coaches/${input.coachId}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
