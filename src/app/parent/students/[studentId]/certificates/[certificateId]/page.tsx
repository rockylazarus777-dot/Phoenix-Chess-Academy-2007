import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentCertificate } from "@/lib/queries/parent/certificates";
import { getParentStudentCertificateDocumentAvailability } from "@/lib/queries/parent/certificateDocuments";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";
import { DownloadCertificateLink } from "@/components/certificates/DownloadCertificateLink";

export const metadata = buildMetadata({
  title: "Certificate Detail",
  description: "Details for one of a linked student's Phoenix Chess Academy certificates.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/certificates/[certificateId]` — every
 * request re-verifies the parent/student relationship via
 * `getLinkedStudent()` first, then `getParentStudentCertificate()`
 * independently re-verifies `parent_has_student()` inside the RPC
 * (defense in depth), and additionally requires status IN
 * ('ISSUED','REVOKED'). Never shows revoked_by identity. No QR code, no
 * public "Verify Certificate" link, no email/WhatsApp share button.
 *
 * PHASE 18: when ISSUED, shows "Download Certificate PDF" if a generated
 * document is AVAILABLE — resolved via
 * `getParentStudentCertificateDocumentAvailability()`, which
 * independently re-verifies `parent_has_student()` again (its own
 * defense-in-depth layer, separate from `getLinkedStudent()` above),
 * otherwise the safe "Certificate document is not available yet for this
 * student." message. See docs/CERTIFICATE_DOCUMENT_ARCHITECTURE.md,
 * "Parent Certificate Detail Update".
 */
export default async function ParentStudentCertificateDetailPage({
  params,
}: {
  params: Promise<{ studentId: string; certificateId: string }>;
}) {
  const identity = await getCurrentParent();

  if (identity.status !== "OK") {
    return (
      <ParentPortalState
        code={identity.status === "NOT_LINKED" ? "PARENT_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <ParentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { studentId, certificateId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await getParentStudentCertificate(student.id, certificateId);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
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
          {student.fullName} · {certificateTypeLabel(certificate.certificate_type)}
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
          <ParentCertificateDocumentSection studentId={student.id} certificateId={certificate.certificate_id} />
        </section>
      ) : null}
    </div>
  );
}

/** Isolated so the availability RPC is only ever called for an ISSUED certificate. */
async function ParentCertificateDocumentSection({ studentId, certificateId }: { studentId: string; certificateId: string }) {
  const availability = await getParentStudentCertificateDocumentAvailability(studentId, certificateId);
  const isAvailable = availability.ok && availability.data;

  if (!isAvailable) {
    return <p className="text-body-sm text-muted-foreground">Certificate document is not available yet for this student.</p>;
  }

  return <DownloadCertificateLink certificateId={certificateId} />;
}
