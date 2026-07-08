import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentCertificates } from "@/lib/queries/student/certificates";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Certificates",
  description: "Your Phoenix Chess Academy certificates.",
  path: "/portal/certificates",
  index: false,
});

/**
 * `/portal/certificates` — every row comes from `get_student_certificates()`,
 * which returns only ISSUED/REVOKED certificates for the current student.
 * DRAFT never appears. No Download/View PDF/QR/Verify controls exist
 * anywhere on this page. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Student Certificate
 * List".
 */
export default async function StudentCertificatesPage() {
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

  const result = await getStudentCertificates();
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Certificates</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Certificates issued to you by Phoenix Chess Academy.</p>
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_CERTIFICATES" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.certificate_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/portal/certificates/${row.certificate_id}`} className="text-body font-medium text-primary-text hover:underline">
                  {row.title}
                </Link>
                <CertificateStatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {certificateTypeLabel(row.certificate_type)}
                {row.program_name ? ` · ${row.program_name}` : ""}
                {row.tournament_name ? ` · ${row.tournament_name}` : ""}
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {row.certificate_number ? `${row.certificate_number} · ` : ""}
                Issued: {row.issued_on ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
