import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CertificateForm } from "@/components/admin/certificates/CertificateForm";

export const metadata = buildMetadata({ title: "Add Certificate", description: "Create a new certificate record.", path: "/admin/certificates/new", index: false });

export default async function NewCertificatePage() {
  await requirePermission("MANAGE_CERTIFICATES");

  return (
    <div>
      <AdminPageHeader title="Add certificate" />
      <div className="mt-6">
        <CertificateForm mode="create" />
      </div>
    </div>
  );
}
