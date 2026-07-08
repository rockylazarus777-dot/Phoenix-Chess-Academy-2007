"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { requirePermission } from "@/lib/auth/permissions";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getSafeAdminMessage, logAdminEvent, type AdminActionResult, type AdminErrorCode } from "@/lib/admin/errors";
import { getCertificateGenerationContext } from "@/lib/queries/admin/certificateDocuments";
import { generateCertificatePdf, type CertificatePdfFailureCode } from "@/lib/certificates/generateCertificatePdf";
import { isR2Configured, uploadCertificatePdf } from "@/lib/storage/r2";
import type { BeginCertificateGenerationRow } from "@/lib/supabase/types";

/**
 * "Generate Certificate PDF" / "Regenerate Certificate PDF" Server
 * Action (Phase 18). Orchestrates the full generation lifecycle:
 * begin -> load narrow generation context -> generate PDF bytes ->
 * enforce max size -> compute SHA-256 -> build server-derived R2 key ->
 * upload to private R2 -> finalize. Only ADMIN/SUPER_ADMIN may call
 * this (`requirePermission("MANAGE_CERTIFICATES")` first, then every
 * RPC independently re-verifies via `auth.uid()` — same defense-in-depth
 * pattern as Phase 17's certificate/achievement actions).
 *
 * PDF generation happens ONLY from this explicit admin action — never
 * during certificate issuance, achievement publication, assignment
 * completion, program completion, or tournament results. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "No Automatic PDF
 * Generation Audit".
 *
 * FAILED REGENERATION DECISION: if generation fails at any step after
 * `begin_certificate_document_generation` created a GENERATING row,
 * this action attempts `fail_certificate_document_generation` as
 * best-effort cleanup so the row never lingers as GENERATING forever
 * (which would otherwise permanently block future regeneration via the
 * one-GENERATING-per-certificate constraint). A failed regeneration
 * NEVER supersedes the certificate's previous AVAILABLE document — see
 * "Failed Regeneration Decision".
 */
export async function generateCertificateDocumentAction(certificateId: string): Promise<AdminActionResult<{ documentId: string; version: number }>> {
  await requirePermission("MANAGE_CERTIFICATES");

  if (!isSupabaseConfigured()) {
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }

  // R2 CONFIGURATION FAILURE: checked before any document row is
  // created, so a missing/incomplete R2 configuration never leaves a
  // stuck GENERATING row behind.
  if (!isR2Configured()) {
    logAdminEvent({ area: "certificates", code: "STORAGE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("STORAGE_UNAVAILABLE") };
  }

  let documentId: string | null = null;

  try {
    const supabase = await getServerSupabaseClient();

    const beginResult = await supabase.rpc("begin_certificate_document_generation" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (beginResult.error) {
      return mapBeginError(beginResult.error.message ?? "");
    }

    const beginRows = (beginResult.data ?? []) as unknown as BeginCertificateGenerationRow[];
    const begin = beginRows.length > 0 ? beginRows[0] : null;
    if (!begin) {
      return { success: false, message: getSafeAdminMessage("UNKNOWN") };
    }
    documentId = begin.document_id;

    const contextResult = await getCertificateGenerationContext(certificateId);
    if (!contextResult.ok) {
      await safelyFail(supabase, documentId, "CERTIFICATE_CONTEXT_INVALID");
      return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
    }
    const context = contextResult.data;
    if (!context) {
      await safelyFail(supabase, documentId, "CERTIFICATE_CONTEXT_INVALID");
      return { success: false, message: getSafeAdminMessage("CERTIFICATE_CONTEXT_INVALID") };
    }

    const pdfResult = await generateCertificatePdf({
      certificateNumber: begin.certificate_number,
      certificateType: context.certificate_type,
      certificateTitle: context.title,
      certificateDescription: context.description,
      studentName: context.student_name,
      programName: context.program_name,
      tournamentName: context.tournament_name,
      achievementTitle: context.achievement_title,
      issuedOn: context.issued_on,
    });

    if (!pdfResult.ok) {
      await safelyFail(supabase, documentId, pdfResult.code);
      logAdminEvent({ area: "certificates", code: mapPdfFailureToAdminCode(pdfResult.code) });
      return { success: false, message: getSafeAdminMessage(mapPdfFailureToAdminCode(pdfResult.code)) };
    }

    const checksum = createHash("sha256").update(pdfResult.bytes).digest("hex");
    const storageKey = `certificates/${begin.certificate_id}/v${begin.version}/${begin.certificate_number}.pdf`;

    const uploadResult = await uploadCertificatePdf(storageKey, pdfResult.bytes);
    if (!uploadResult.ok) {
      await safelyFail(supabase, documentId, "R2_UPLOAD_FAILED");
      logAdminEvent({ area: "certificates", code: "STORAGE_UNAVAILABLE" });
      return { success: false, message: getSafeAdminMessage("STORAGE_UNAVAILABLE") };
    }

    const finalizeResult = await supabase.rpc("finalize_certificate_document_generation" as never, {
      target_document_id: documentId,
      target_storage_key: storageKey,
      target_mime_type: "application/pdf",
      target_file_size_bytes: pdfResult.bytes.byteLength,
      target_sha256_checksum: checksum,
    } as never);

    if (finalizeResult.error) {
      // ORPHAN R2 OBJECT RISK: the PDF has already been uploaded to R2
      // at `storageKey`, but the database could not record it as
      // AVAILABLE. Documented, deferred cleanup risk — see
      // docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Orphan R2 Object
      // Risk". This action does not attempt to delete the orphaned R2
      // object (no verified cleanup design exists yet), and does not
      // silently claim success.
      await safelyFail(supabase, documentId, "DOCUMENT_FINALIZATION_FAILED");
      logAdminEvent({ area: "certificates", code: "DOCUMENT_FINALIZATION_FAILED" });
      return { success: false, message: getSafeAdminMessage("DOCUMENT_FINALIZATION_FAILED") };
    }

    revalidatePath(`/admin/certificates/${certificateId}`);
    return { success: true, data: { documentId, version: begin.version } };
  } catch {
    if (documentId) {
      try {
        const supabase = await getServerSupabaseClient();
        await safelyFail(supabase, documentId, "DOCUMENT_FINALIZATION_FAILED");
      } catch {
        // Best-effort only — see "Orphan R2 Object Risk".
      }
    }
    logAdminEvent({ area: "certificates", code: "DATABASE_UNAVAILABLE" });
    return { success: false, message: getSafeAdminMessage("DATABASE_UNAVAILABLE") };
  }
}

async function safelyFail(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  documentId: string,
  errorCode: string,
): Promise<void> {
  try {
    await supabase.rpc("fail_certificate_document_generation" as never, {
      target_document_id: documentId,
      target_error_code: errorCode,
    } as never);
  } catch {
    // Best-effort cleanup only — never throws past this point.
  }
}

function mapBeginError(message: string): AdminActionResult<{ documentId: string; version: number }> {
  if (message.includes("CERTIFICATE_NOT_FOUND")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_FOUND") };
  if (message.includes("CERTIFICATE_NOT_ISSUED")) return { success: false, message: getSafeAdminMessage("CERTIFICATE_NOT_ISSUED") };
  if (message.includes("GENERATION_IN_PROGRESS")) return { success: false, message: getSafeAdminMessage("GENERATION_IN_PROGRESS") };
  if (message.includes("NOT_AUTHORIZED")) return { success: false, message: getSafeAdminMessage("AUTHORIZATION_DENIED") };
  logAdminEvent({ area: "certificates", code: "UNKNOWN" });
  return { success: false, message: getSafeAdminMessage("UNKNOWN") };
}

function mapPdfFailureToAdminCode(code: CertificatePdfFailureCode): AdminErrorCode {
  switch (code) {
    case "CERTIFICATE_CONTEXT_INVALID":
      return "CERTIFICATE_CONTEXT_INVALID";
    case "CERTIFICATE_CONTENT_TOO_LONG":
      return "CERTIFICATE_CONTEXT_INVALID";
    case "PDF_TOO_LARGE":
      return "PDF_TOO_LARGE";
    case "PDF_GENERATION_FAILED":
    default:
      return "PDF_GENERATION_FAILED";
  }
}
