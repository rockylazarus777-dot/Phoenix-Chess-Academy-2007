"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult } from "@/lib/admin/errors";
import {
  createCertificateSchema,
  issueCertificateSchema,
  revokeCertificateSchema,
  updateCertificateSchema,
  type CreateCertificateValues,
  type IssueCertificateValues,
  type RevokeCertificateValues,
  type UpdateCertificateValues,
} from "@/lib/validation/certificates";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Admin certificate mutations. Unlike every other Phase 10 admin
 * mutation (which writes via the service-role client,
 * `getAdminSupabaseClient()`), these five actions call the four
 * certificate write RPCs through the normal per-request session client —
 * the RPCs themselves independently verify the caller is an ADMIN/
 * SUPER_ADMIN profile via `auth.uid()`. `requirePermission()` is still
 * called first, exactly like every other admin action, as the
 * application-layer gate; the RPC's own check is additional
 * defense-in-depth, not a replacement. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin-Only Mutation
 * Decision". This file never issues a direct
 * `.from("student_certificates")` insert/update — every write goes
 * through create_/update_/issue_/revoke_student_certificate.
 */
export async function createCertificate(input: CreateCertificateValues): Promise<AdminActionResult<{ id: string }>> {
  await requirePermission("MANAGE_CERTIFICATES");

  const parsed = createCertificateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_student_certificate" as never, {
      target_student_id: parsed.data.studentId,
      target_certificate_type: parsed.data.certificateType,
      target_title: parsed.data.title,
      target_description: emptyToNull(parsed.data.description),
      target_program_id: emptyToNull(parsed.data.programId),
      target_tournament_id: emptyToNull(parsed.data.tournamentId),
      target_achievement_id: emptyToNull(parsed.data.achievementId),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("INVALID_CERTIFICATE_CONTEXT")) {
        logAdminEvent({ area: "certificates", code: "INVALID_CERTIFICATE_CONTEXT" });
        return { success: false, message: getSafeAdminMessage("INVALID_CERTIFICATE_CONTEXT") };
      }
      if (message.includes("VALIDATION_ERROR")) {
        return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      }
      if (message.includes("NOT_AUTHORIZED")) {
        return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      }
      logAdminEvent({ area: "certificates", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath("/admin/certificates");
    return { success: true, data: { id: data as unknown as string } };
  } catch {
    logAdminEvent({ area: "certificates", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

export async function updateCertificate(input: UpdateCertificateValues): Promise<AdminActionResult> {
  await requirePermission("MANAGE_CERTIFICATES");

  const parsed = updateCertificateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("update_student_certificate" as never, {
      target_certificate_id: parsed.data.certificateId,
      target_certificate_type: parsed.data.certificateType,
      target_title: parsed.data.title,
      target_description: emptyToNull(parsed.data.description),
      target_program_id: emptyToNull(parsed.data.programId),
      target_tournament_id: emptyToNull(parsed.data.tournamentId),
      target_achievement_id: emptyToNull(parsed.data.achievementId),
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("CERTIFICATE_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_FOUND") };
      if (message.includes("CERTIFICATE_NOT_EDITABLE")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_EDITABLE") };
      if (message.includes("INVALID_CERTIFICATE_CONTEXT")) return { success: false, message: getSafeAdminMessage("INVALID_CERTIFICATE_CONTEXT") };
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "certificates", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/certificates/${parsed.data.certificateId}`);
    revalidatePath("/admin/certificates");
    return { success: true };
  } catch {
    logAdminEvent({ area: "certificates", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

/** "Issue Certificate" — the only path DRAFT -> ISSUED. Generates certificate_number server-side. */
export async function issueCertificate(input: IssueCertificateValues): Promise<AdminActionResult> {
  await requirePermission("MANAGE_CERTIFICATES");

  const parsed = issueCertificateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("issue_student_certificate" as never, {
      target_certificate_id: parsed.data.certificateId,
      target_issued_on: parsed.data.issuedOn,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("CERTIFICATE_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_FOUND") };
      if (message.includes("CERTIFICATE_NUMBER_GENERATION_FAILED")) {
        logAdminEvent({ area: "certificates", code: "CERTIFICATE_NUMBER_GENERATION_FAILED" });
        return { success: false, message: getSafeAdminMessage("CERTIFICATE_NUMBER_GENERATION_FAILED") };
      }
      if (message.includes("INVALID_CERTIFICATE_CONTEXT")) return { success: false, message: getSafeAdminMessage("INVALID_CERTIFICATE_CONTEXT") };
      if (message.includes("INVALID_TRANSITION")) return { success: false, message: getSafeAdminMessage("INVALID_TRANSITION") };
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "certificates", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/certificates/${parsed.data.certificateId}`);
    revalidatePath("/admin/certificates");
    return { success: true };
  } catch {
    logAdminEvent({ area: "certificates", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

/** "Revoke Certificate" — the only path ISSUED -> REVOKED. Never clears certificate_number/issued_on. */
export async function revokeCertificate(input: RevokeCertificateValues): Promise<AdminActionResult> {
  await requirePermission("MANAGE_CERTIFICATES");

  const parsed = revokeCertificateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
  }

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  try {
    const supabase = await getServerSupabaseClient();
    const { error } = await supabase.rpc("revoke_student_certificate" as never, {
      target_certificate_id: parsed.data.certificateId,
      target_revocation_reason: parsed.data.revocationReason,
    } as never);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("CERTIFICATE_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_FOUND") };
      if (message.includes("REVOCATION_REASON_REQUIRED")) return { success: false, message: getSafeAdminMessage("REVOCATION_REASON_REQUIRED") };
      if (message.includes("INVALID_TRANSITION")) return { success: false, message: getSafeAdminMessage("INVALID_TRANSITION") };
      if (message.includes("VALIDATION_ERROR")) return { success: false, message: getSafeAdminMessage("VALIDATION_ERROR") };
      if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
      logAdminEvent({ area: "certificates", code: "UNKNOWN" });
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }

    revalidatePath(`/admin/certificates/${parsed.data.certificateId}`);
    revalidatePath("/admin/certificates");
    return { success: true };
  } catch {
    logAdminEvent({ area: "certificates", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}
