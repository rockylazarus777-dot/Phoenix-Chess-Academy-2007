import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AchievementForm } from "@/components/admin/achievements/AchievementForm";

export const metadata = buildMetadata({ title: "Add Achievement", description: "Create a new achievement record.", path: "/admin/achievements/new", index: false });

export default async function NewAchievementPage() {
  await requirePermission("MANAGE_ACHIEVEMENTS");

  return (
    <div>
      <AdminPageHeader title="Add achievement" />
      <div className="mt-6">
        <AchievementForm mode="create" />
      </div>
    </div>
  );
}
