import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { listAdminCertificates } from "@/lib/queries/admin/certificates";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { CertificateStatusBadge } from "@/components/certificates/CertificateStatusBadge";
import { certificateTypeLabel } from "@/components/certificates/labels";
import type { CertificateStatus } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Certificates",
  description: "Academy-issued certificate records.",
  path: "/admin/certificates",
  index: false,
});

const GROUPS: { status: CertificateStatus; heading: string }[] = [
  { status: "DRAFT", heading: "Draft Certificates" },
  { status: "ISSUED", heading: "Issued Certificates" },
  { status: "REVOKED", heading: "Revoked Certificates" },
];

/**
 * `/admin/certificates` — every certificate record, grouped Draft/Issued/
 * Revoked. Never shows student contact PII, parent details, or payment
 * data. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Admin
 * Certificate List".
 */
export default async function AdminCertificatesPage() {
  await requirePermission("VIEW_CERTIFICATES");

  const result = await listAdminCertificates();

  return (
    <div>
      <AdminPageHeader title="Certificates" description="Academy-issued certificate records." action={{ href: "/admin/certificates/new", label: "Add certificate" }} />

      {!result.ok ? (
        <AdminQueryError code={result.code} />
      ) : result.data.length === 0 ? (
        <p className="mt-8 text-body-sm text-muted-foreground">No certificate records are currently available.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {GROUPS.map((group) => {
            const rows = result.data.filter((row) => row.status === group.status);
            if (rows.length === 0) return null;
            return (
              <section key={group.status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{group.heading}</h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-body-sm">
                    <thead className="border-b border-border bg-surface">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Certificate #</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Student</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Title</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Program</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Tournament</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.certificate_id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{row.certificate_number ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground">
                            {row.student_name} ({row.student_code})
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{certificateTypeLabel(row.certificate_type)}</td>
                          <td className="px-4 py-3 text-foreground">{row.title}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.program_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.tournament_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <CertificateStatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/admin/certificates/${row.certificate_id}`} className="text-primary-text hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
