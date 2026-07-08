import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BatchForm } from "@/components/admin/batches/BatchForm";

export const metadata = buildMetadata({ title: "Add Batch", description: "Create a new training batch.", path: "/admin/batches/new", index: false });

export default async function NewBatchPage() {
  await requirePermission("MANAGE_BATCHES");

  return (
    <div>
      <AdminPageHeader title="Add batch" />
      <div className="mt-6">
        <BatchForm mode="create" />
      </div>
    </div>
  );
}
