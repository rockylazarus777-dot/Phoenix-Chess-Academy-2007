import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentCertificates } from "@/lib/queries/parent/certificates";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";

export const metadata = buildMetadata({
  title: "Student Certificates",
  description: "Certificates for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/certificates` — every request re-verifies
 * the parent/student relationship via `getLinkedStudent()` first, then
 * queries certificates through `listParentStudentCertificates()`, a
 * second, independent authorization layer. Read-only. No Download/View
 * PDF/QR/Verify controls exist anywhere. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Parent Certificate
 * Routes".
 */
export default async function ParentStudentCertificatesPage({ params }: { params: Promise<{ studentId: string }> }) {
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

  const { studentId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await listParentStudentCertificates(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Certificates</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Certificates issued to this student by Phoenix Chess Academy.</p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_CERTIFICATES" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.certificate_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/parent/students/${student.id}/certificates/${row.certificate_id}`}
                  className="text-body font-medium text-primary-text hover:underline"
                >
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
