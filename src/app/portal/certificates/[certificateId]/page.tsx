import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentCertificate } from "@/lib/queries/student/certificates";
import { getStudentCertificateDocumentAvailability } from "@/lib/queries/student/certificateDocuments";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";
import { DownloadCertificateLink } from "@/components/certificates/DownloadCertificateLink";

export const metadata = buildMetadata({
  title: "Certificate Detail",
  description: "Details for one of your Phoenix Chess Academy certificates.",
  path: "/portal/certificates",
  index: false,
});

/**
 * `/portal/certificates/[certificateId]` — "Knowing certificateId is not
 * enough": authorization derives entirely from `get_student_certificate()`,
 * which requires certificate.student_id = current_student_id() AND status
 * IN ('ISSUED','REVOKED'). Never shows revoked_by identity. No QR code,
 * no public "Verify Certificate" link, no email/WhatsApp share button —
 * those systems do not exist in this phase.
 *
 * PHASE 18: when ISSUED, shows "Download Certificate PDF" (linking only
 * to `/api/certificates/[certificateId]/download`) if a generated
 * document is AVAILABLE, otherwise the safe "Certificate document is not
 * available yet." message — never mentions generation failure/R2/PDF
 * errors. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md, "Student
 * Certificate Detail Update".
 */
export default async function StudentCertificateDetailPage({ params }: { params: Promise<{ certificateId: string }> }) {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return (
      <StudentPortalState
        code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { certificateId } = await params;
  const result = await getStudentCertificate(certificateId);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const certificate = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{certificate.title}</h1>
          <CertificateStatusBadge status={certificate.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {certificateTypeLabel(certificate.certificate_type)}
          {certificate.program_name ? ` · ${certificate.program_name}` : ""}
          {certificate.tournament_name ? ` · ${certificate.tournament_name}` : ""}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {certificate.certificate_number ? `${certificate.certificate_number} · ` : ""}
          Issued: {certificate.issued_on ?? "—"}
        </p>
      </div>

      {certificate.description ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Description</h2>
          <p className="whitespace-pre-wrap text-body-sm text-muted-foreground">{certificate.description}</p>
        </section>
      ) : null}

      {certificate.achievement_title ? (
        <section>
          <h2 className="mb-1 text-body font-medium text-foreground">Linked Achievement</h2>
          <p className="text-body-sm text-muted-foreground">{certificate.achievement_title}</p>
        </section>
      ) : null}

      {certificate.status === "REVOKED" ? (
        <section className="rounded-lg border border-danger/40 bg-surface p-4">
          <p className="text-body-sm font-medium text-foreground">This certificate has been revoked by Phoenix Chess Academy.</p>
          {certificate.revocation_reason ? (
            <p className="mt-2 whitespace-pre-wrap text-body-sm text-muted-foreground">{certificate.revocation_reason}</p>
          ) : null}
        </section>
      ) : null}

      {certificate.status === "ISSUED" ? (
        <section>
          <h2 className="mb-2 text-body font-medium text-foreground">Certificate document</h2>
          <StudentCertificateDocumentSection certificateId={certificate.certificate_id} />
        </section>
      ) : null}
    </div>
  );
}

/** Isolated so the availability RPC is only ever called for an ISSUED certificate. */
async function StudentCertificateDocumentSection({ certificateId }: { certificateId: string }) {
  const availability = await getStudentCertificateDocumentAvailability(certificateId);
  const isAvailable = availability.ok && availability.data;

  if (!isAvailable) {
    return <p className="text-body-sm text-muted-foreground">Certificate document is not available yet.</p>;
  }

  return <DownloadCertificateLink certificateId={certificateId} />;
}
