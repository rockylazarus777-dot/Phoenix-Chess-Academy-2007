"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import { createBatchSchema, updateBatchSchema, changeBatchStatusSchema, type CreateBatchValues, type UpdateBatchValues } from "@/lib/validation/admin/batch";
import type { UserRole } from "@/lib/supabase/types";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalInt(value: string | undefined): number | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createBatch(input: CreateBatchValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_BATCHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = createBatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase.rpc("create_batch_with_audit", {
      p_batch_code: parsed.data.batchCode,
      p_name: parsed.data.name,
      p_program_id: parsed.data.programId,
      p_location_id: emptyToNull(parsed.data.locationId),
      p_training_mode: parsed.data.trainingMode,
      p_level: emptyToNull(parsed.data.level),
      p_primary_coach_id: emptyToNull(parsed.data.primaryCoachId),
      p_capacity: parseOptionalInt(parsed.data.capacity),
      p_start_date: emptyToNull(parsed.data.startDate),
      p_end_date: emptyToNull(parsed.data.endDate),
      p_actor_profile_id: profile.id,
      p_actor_role: profile.role as UserRole,
    } as never);

    if (error) {
      logAdminEvent({ area: "batches", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("CONFLICT") };
    }

    revalidatePath("/admin/batches");
    return { success: true, data: { id: data as unknown as string } };
  } catch {
    logAdminEvent({ area: "batches", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateBatch(id: string, input: UpdateBatchValues): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_BATCHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = updateBatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase
      .from("batches")
      .update({
        name: parsed.data.name,
        program_id: parsed.data.programId,
        location_id: emptyToNull(parsed.data.locationId),
        training_mode: parsed.data.trainingMode,
        level: emptyToNull(parsed.data.level),
        primary_coach_id: emptyToNull(parsed.data.primaryCoachId),
        capacity: parseOptionalInt(parsed.data.capacity),
        start_date: emptyToNull(parsed.data.startDate),
        end_date: emptyToNull(parsed.data.endDate),
      } as never)
      .eq("id", id as never);

    if (error) {
      logAdminEvent({ area: "batches", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    await recordAdminAudit({ actor: profile, action: "BATCH_UPDATED", entityType: "batch", entityId: id, summary: "Batch details updated." });

    revalidatePath("/admin/batches");
    revalidatePath(`/admin/batches/${id}`);
    return { success: true };
  } catch {
    logAdminEvent({ area: "batches", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function changeBatchStatus(id: string, status: string): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_BATCHES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = changeBatchStatusSchema.safeParse({ status });
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("batches").update({ status: parsed.data.status } as never).eq("id", id as never);
    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "BATCH_UPDATED",
      entityType: "batch",
      entityId: id,
      summary: `Batch status changed to ${parsed.data.status}.`,
      metadata: { status_to: parsed.data.status },
    });

    revalidatePath("/admin/batches");
    revalidatePath(`/admin/batches/${id}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
