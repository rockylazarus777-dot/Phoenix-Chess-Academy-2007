import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ParentForm } from "@/components/admin/parents/ParentForm";

export const metadata = buildMetadata({ title: "Add Parent", description: "Create a new parent/guardian record.", path: "/admin/parents/new", index: false });

export default async function NewParentPage() {
  await requirePermission("MANAGE_PARENTS");

  return (
    <div>
      <AdminPageHeader title="Add parent" />
      <div className="mt-6">
        <ParentForm mode="create" />
      </div>
    </div>
  );
}
