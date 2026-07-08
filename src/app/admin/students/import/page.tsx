import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ImportWizard } from "@/components/admin/students/ImportWizard";

export const metadata = buildMetadata({ title: "Import Students", description: "Bulk-import student records from CSV.", path: "/admin/students/import", index: false });

export default async function StudentImportPage() {
  await requirePermission("MANAGE_STUDENTS");

  return (
    <div>
      <AdminPageHeader
        title="Bulk import students"
        description="Upload a CSV to preview and validate rows before anything is created. No accounts or invitations are created by this import."
      />
      <div className="mt-6">
        <ImportWizard />
      </div>
    </div>
  );
}
