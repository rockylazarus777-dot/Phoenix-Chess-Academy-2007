import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getAdminCertificate } from "@/lib/queries/admin/certificates";
import { listAdminCertificateDocuments } from "@/lib/queries/admin/certificateDocuments";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";
import { CertificateForm } from "@/components/admin/certificates/CertificateForm";
import { IssueCertificateForm } from "@/components/admin/certificates/IssueCertificateForm";
import { RevokeCertificateForm } from "@/components/admin/certificates/RevokeCertificateForm";
import { GenerateCertificateDocumentButton } from "@/components/admin/certificates/GenerateCertificateDocumentButton";
import { CertificateDocumentHistory } from "@/components/admin/certificates/CertificateDocumentHistory";
import { DownloadCertificateLink } from "@/components/certificates/DownloadCertificateLink";

export const metadata = buildMetadata({ title: "Certificate", description: "Certificate record detail.", path: "/admin/certificates", index: false });

/**
 * `/admin/certificates/[certificateId]` — DRAFT shows Edit + Issue
 * Certificate; ISSUED shows Revoke Certificate; REVOKED is read-only.
 * Never exposes created_by/issued_by/revoked_by UUIDs or student contact
 * PII. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin
 * Certificate Detail".
 */
export default async function AdminCertificateDetailPage({ params }: { params: Promise<{ certificateId: string }> }) {
  await requirePermission("VIEW_CERTIFICATES");
  const { certificateId } = await params;
  if (!isUuid(certificateId)) notFound();

  const result = await getAdminCertificate(certificateId);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const certificate = result.data;

  // Document generation only exists for ISSUED/REVOKED certificates —
  // DRAFT certificates never generate a document (see "Draft Certificate
  // Document Rule"). Fetching only when relevant avoids an unnecessary
  // RPC call on the common DRAFT-editing path.
  const documentsResult =
    certificate.status !== "DRAFT" ? await listAdminCertificateDocuments(certificate.certificate_id) : null;
  const documents = documentsResult?.ok ? documentsResult.data : [];
  const latestAvailable = documents
    .filter((doc) => doc.status === "AVAILABLE")
    .sort((a, b) => b.version - a.version)[0];

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={certificate.title}
        description={`${certificate.student_name} (${certificate.student_code}) · ${certificateTypeLabel(certificate.certificate_type)}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <CertificateStatusBadge status={certificate.status} />
        {certificate.certificate_number ? (
          <span className="font-mono text-xs text-muted-foreground">{certificate.certificate_number}</span>
        ) : null}
      </div>

      <section className="rounded-lg border border-border p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Program</dt>
            <dd className="text-body-sm text-foreground">{certificate.program_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Tournament</dt>
            <dd className="text-body-sm text-foreground">{certificate.tournament_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Linked achievement</dt>
            <dd className="text-body-sm text-foreground">{certificate.achievement_title ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Issue date</dt>
            <dd className="text-body-sm text-foreground">{certificate.issued_on ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Created</dt>
            <dd className="text-body-sm text-foreground">{certificate.created_at}</dd>
          </div>
        </dl>
        {certificate.description ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-foreground">{certificate.description}</p>
          </div>
        ) : null}
      </section>

      {certificate.status === "REVOKED" ? (
        <section className="rounded-lg border border-danger/40 p-4">
          <p className="text-body-sm font-medium text-foreground">This certificate has been revoked.</p>
          {certificate.revocation_reason ? (
            <p className="mt-2 whitespace-pre-wrap text-body-sm text-muted-foreground">{certificate.revocation_reason}</p>
          ) : null}
        </section>
      ) : null}

      {certificate.status === "DRAFT" ? (
        <>
          <section>
            <h2 className="mb-3 text-body font-medium text-foreground">Edit certificate</h2>
            <CertificateForm
              mode="edit"
              certificateId={certificate.certificate_id}
              student={{ id: certificate.student_id, fullName: certificate.student_name, studentCode: certificate.student_code }}
              initialValues={{
                certificateType: certificate.certificate_type,
                title: certificate.title,
                description: certificate.description ?? "",
                programId: certificate.program_id ?? "",
                tournamentId: certificate.tournament_id ?? "",
                achievementId: certificate.achievement_id ?? "",
              }}
            />
          </section>
          <section>
            <h2 className="mb-3 text-body font-medium text-foreground">Issue certificate</h2>
            <IssueCertificateForm certificateId={certificate.certificate_id} />
          </section>
        </>
      ) : null}

      {certificate.status === "ISSUED" ? (
        <section>
          <h2 className="mb-3 text-body font-medium text-foreground">Revoke certificate</h2>
          <RevokeCertificateForm certificateId={certificate.certificate_id} />
        </section>
      ) : null}

      {certificate.status !== "DRAFT" ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <h2 className="text-body font-medium text-foreground">Certificate document</h2>

          {certificate.status === "ISSUED" ? (
            <div className="flex flex-wrap items-center gap-3">
              <GenerateCertificateDocumentButton
                certificateId={certificate.certificate_id}
                hasAvailableDocument={Boolean(latestAvailable)}
              />
              {latestAvailable ? <DownloadCertificateLink certificateId={certificate.certificate_id} /> : null}
            </div>
          ) : null}

          {certificate.status === "REVOKED" ? (
            <p className="text-body-sm text-muted-foreground">
              This certificate is revoked — no document can be generated, regenerated, or downloaded.
            </p>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Document history</h3>
            <CertificateDocumentHistory documents={documents} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
