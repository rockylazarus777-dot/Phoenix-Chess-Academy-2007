"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminSupabaseClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import { createScheduleSchema, type CreateScheduleValues } from "@/lib/validation/admin/schedule";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function createSchedule(input: CreateScheduleValues): Promise<AdminActionResult<{ id: string }>> {
  const profile = await requirePermission("MANAGE_SCHEDULES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  const parsed = createScheduleSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };

  try {
    const supabase = getAdminSupabaseClient();
    const { data, error } = await supabase
      .from("class_schedules")
      .insert({
        batch_id: parsed.data.batchId,
        day_of_week: parsed.data.dayOfWeek,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        timezone: parsed.data.timezone,
        effective_from: emptyToNull(parsed.data.effectiveFrom),
        effective_until: emptyToNull(parsed.data.effectiveUntil),
        active: parsed.data.active,
      } as never)
      .select("id")
      .single();

    if (error) {
      logAdminEvent({ area: "schedules", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
    }

    const id = (data as unknown as { id: string }).id;
    await recordAdminAudit({
      actor: profile,
      action: "SCHEDULE_CREATED",
      entityType: "schedule",
      entityId: id,
      summary: "Class schedule created.",
      metadata: { batch_id: parsed.data.batchId, day_of_week: parsed.data.dayOfWeek },
    });

    revalidatePath("/admin/schedules");
    return { success: true, data: { id } };
  } catch {
    logAdminEvent({ area: "schedules", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function setScheduleActive(id: string, active: boolean, batchId: string): Promise<AdminActionResult> {
  const profile = await requirePermission("MANAGE_SCHEDULES");

  if (!isAdminSupabaseConfigured()) return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };

  try {
    const supabase = getAdminSupabaseClient();
    const { error } = await supabase.from("class_schedules").update({ active } as never).eq("id", id as never);
    if (error) return { success: false, message: getSafeAdminMessage("UNKNOWN") };

    await recordAdminAudit({
      actor: profile,
      action: "SCHEDULE_UPDATED",
      entityType: "schedule",
      entityId: id,
      summary: active ? "Schedule reactivated." : "Schedule deactivated.",
      metadata: { active },
    });

    revalidatePath("/admin/schedules");
    revalidatePath(`/admin/batches/${batchId}`);
    return { success: true };
  } catch {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
