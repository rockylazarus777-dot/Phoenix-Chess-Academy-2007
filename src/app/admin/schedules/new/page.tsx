import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ScheduleForm } from "@/components/admin/schedules/ScheduleForm";

export const metadata = buildMetadata({ title: "Add Schedule", description: "Create a recurring class schedule.", path: "/admin/schedules/new", index: false });

export default async function NewSchedulePage({ searchParams }: { searchParams: Promise<{ batchId?: string }> }) {
  await requirePermission("MANAGE_SCHEDULES");
  const { batchId } = await searchParams;

  return (
    <div>
      <AdminPageHeader title="Add schedule" description="Defines a recurring weekly class time — not a dated attendance session." />
      <div className="mt-6">
        <ScheduleForm initialBatchId={batchId} />
      </div>
    </div>
  );
}
