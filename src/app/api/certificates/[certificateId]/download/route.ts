import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCertificatePdfObject } from "@/lib/storage/r2";
import { isUuid } from "@/lib/admin/uuid";
import type { CertificateDownloadResolutionRow } from "@/lib/supabase/types";

/**
 * Secure certificate download Route Handler (Phase 18).
 *
 * `/api/certificates/[certificateId]/download` — the ONLY way a
 * certificate PDF ever reaches a browser. Streams the PDF bytes through
 * this server route; NEVER redirects to R2, and NEVER returns the R2
 * storage key/bucket/credentials to the client. See
 * docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Secure Download
 * Architecture".
 *
 * `runtime = "nodejs"` is required because `@aws-sdk/client-s3` is not
 * Edge-compatible.
 *
 * AUTHORIZATION: this route does not do its own role/ownership check —
 * it defers entirely to the `resolve_certificate_download` RPC, which
 * independently resolves `auth.uid()` and re-verifies Admin/Super Admin,
 * the owning Student, or a linked Parent (via `parent_has_student()`)
 * every single call. This route never trusts page-level authorization
 * alone (a Student/Parent could otherwise guess another certificateId in
 * the URL). See "Resolve Certificate Download RPC".
 *
 * REVOKED CERTIFICATES: `resolve_certificate_download` requires
 * certificate.status = ISSUED, so a REVOKED certificate (even with a
 * still-AVAILABLE document row) resolves zero rows here and this route
 * returns the same generic "not found" response as any other
 * unavailable case — never a distinct "revoked" signal. See "Revoked
 * Certificate Download Rule".
 *
 * RESPONSE SHAPE: 401 only for a missing/invalid session; every other
 * failure (certificate not found, not visible to this caller, not
 * ISSUED, no AVAILABLE document, R2 object missing/unretrievable) maps
 * to the SAME generic 404-style response — this route never leaks
 * cross-user resource existence or internal document/generation state
 * beyond what the portal UI already shows. See "Download Response
 * Status".
 *
 * NO DOWNLOAD AUDIT: this route deliberately does not record a
 * download-count, IP, user-agent, or last-downloaded-at anywhere — see
 * "Download Audit Decision" (deferred to a future privacy/audit-driven
 * phase).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailableResponse(status: 401 | 404): NextResponse {
  return new NextResponse(status === 401 ? "Unauthorized" : "Not found", {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Builds the download filename from the certificate number only —
 * never the student's name (PII reduction, see "PDF Filename
 * Decision"). Defensive re-sanitization here even though
 * certificate_number is itself a server-generated, already-safe value.
 */
function buildDownloadFilename(certificateNumber: string): string {
  const safe = certificateNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 100);
  return `phoenix-chess-academy-${safe || "certificate"}.pdf`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> },
): Promise<NextResponse> {
  const { certificateId } = await params;

  if (!isSupabaseConfigured() || !isUuid(certificateId)) {
    return unavailableResponse(404);
  }

  try {
    const supabase = await getServerSupabaseClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return unavailableResponse(401);
    }

    const { data, error } = await supabase.rpc("resolve_certificate_download" as never, {
      target_certificate_id: certificateId,
    } as never);

    if (error) {
      return unavailableResponse(404);
    }

    const rows = (data ?? []) as unknown as CertificateDownloadResolutionRow[];
    const resolution = rows.length > 0 ? rows[0] : null;
    if (!resolution) {
      return unavailableResponse(404);
    }

    const objectResult = await getCertificatePdfObject(resolution.storage_key);
    if (!objectResult.ok) {
      return unavailableResponse(404);
    }

    const filename = buildDownloadFilename(resolution.certificate_number);
    const body = new Uint8Array(objectResult.body);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return unavailableResponse(404);
  }
}
