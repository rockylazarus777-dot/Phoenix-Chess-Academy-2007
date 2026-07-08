"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { isUuid } from "@/lib/admin/uuid";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  createAchievementSchema,
  updateAchievementSchema,
  type CreateAchievementValues,
  type UpdateAchievementValues,
} from "@/lib/validation/achievements";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function placementToNumber(value: number | "" | undefined): number | null {
  if (value === "" || value === undefined) return null;
  return value;
}

/**
 * Admin achievement mutations — same session-client architecture as
 * `src/lib/actions/admin/certificates.ts`. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only Mutation
 * Decision". Never issues a direct `.from("student_achievements")`
 * insert/update — every write goes through create_/update_/publish_/
 * archive_student_achievement.
 */
export async function createAchievement(input: CreateAchievementValues): Promise<AdminActionResult<{ id: string }>> {
  await requirePermission("MANAGE_ACHIEVEMENTS");

  const parsed = createAchievementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_student_achievement" as never, {
      target_student_id: parsed.data.studentId,
      target_achievement_type: parsed.data.achievementType,
      target_title: parsed.data.title,
      target_description: emptyToNull(parsed.data.description),
      target_achievement_date: emptyToNull(parsed.data.achievementDate),
      target_program_id: emptyToNull(parsed.data.programId),
      target_tournament_id: emptyToNull(parsed.data.tournamentId),
      target_placement: placementToNumber(parsed.data.placement),
      target_external_organization: emptyToNull(parsed.data.externalOrganization),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("INVALID_ACHIEVEMENT_CONTEXT")) {
        logAdminEvent({ area: "achievements", code: "INVALID_ACHIEVEMENT_CONTEXT" });
        return { success: false, message: getSafeAdminMessage("INVALID_ACHIEVEMENT_CONTEXT") };
      }
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "achievements", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath("/admin/achievements");
    return { success: true, data: { id: data as unknown as string } };
  } catch {
    logAdminEvent({ area: "achievements", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateAchievement(input: UpdateAchievementValues): Promise<AdminActionResult> {
  await requirePermission("MANAGE_ACHIEVEMENTS");

  const parsed = updateAchievementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("update_student_achievement" as never, {
      target_achievement_id: parsed.data.achievementId,
      target_achievement_type: parsed.data.achievementType,
      target_title: parsed.data.title,
      target_description: emptyToNull(parsed.data.description),
      target_achievement_date: emptyToNull(parsed.data.achievementDate),
      target_program_id: emptyToNull(parsed.data.programId),
      target_tournament_id: emptyToNull(parsed.data.tournamentId),
      target_placement: placementToNumber(parsed.data.placement),
      target_external_organization: emptyToNull(parsed.data.externalOrganization),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("ACHIEVEMENT_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("ACHIEVEMENT_NOT_FOUND") };
      if (message.includes("ACHIEVEMENT_NOT_EDITABLE")) return { success: false, message: getSafeAdminMessage("ACHIEVEMENT_NOT_EDITABLE") };
      if (message.includes("INVALID_ACHIEVEMENT_CONTEXT")) return { success: false, message: getSafeAdminMessage("INVALID_ACHIEVEMENT_CONTEXT") };
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "achievements", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/achievements/${parsed.data.achievementId}`);
    revalidatePath("/admin/achievements");
    return { success: true };
  } catch {
    logAdminEvent({ area: "achievements", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

async function transitionAchievement(
  achievementId: string,
  rpcName: "publish_student_achievement" | "archive_student_achievement",
): Promise<AdminActionResult> {
  await requirePermission("MANAGE_ACHIEVEMENTS");

  if (!isUuid(achievementId)) {
    return { success: false, message: getSafeAdminMessage("ACHIEVEMENT_NOT_FOUND") };
  }
  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc(rpcName as never, {
      target_achievement_id: achievementId,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("ACHIEVEMENT_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("ACHIEVEMENT_NOT_FOUND") };
      if (message.includes("INVALID_ACHIEVEMENT_CONTEXT")) return { success: false, message: getSafeAdminMessage("INVALID_ACHIEVEMENT_CONTEXT") };
      if (message.includes("INVALID_TRANSITION")) return { success: false, message: getSafeAdminMessage("INVALID_TRANSITION") };
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "achievements", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/achievements/${achievementId}`);
    revalidatePath("/admin/achievements");
    return { success: true };
  } catch {
    logAdminEvent({ area: "achievements", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

/** "Publish Achievement" — the only path DRAFT -> PUBLISHED. Never automatically creates a certificate. */
export async function publishAchievement(achievementId: string): Promise<AdminActionResult> {
  return transitionAchievement(achievementId, "publish_student_achievement");
}

/** "Archive Achievement" — the only path DRAFT|PUBLISHED -> ARCHIVED. Preserves the record and any certificate reference. */
export async function archiveAchievement(achievementId: string): Promise<AdminActionResult> {
  return transitionAchievement(achievementId, "archive_student_achievement");
}
