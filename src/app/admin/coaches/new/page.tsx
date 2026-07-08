import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CoachForm } from "@/components/admin/coaches/CoachForm";

export const metadata = buildMetadata({ title: "Add Coach", description: "Create a new coach record.", path: "/admin/coaches/new", index: false });

export default async function NewCoachPage() {
  await requirePermission("MANAGE_COACHES");

  return (
    <div>
      <AdminPageHeader title="Add coach" description="The coach code is generated automatically once saved." />
      <div className="mt-6">
        <CoachForm mode="create" />
      </div>
    </div>
  );
}
