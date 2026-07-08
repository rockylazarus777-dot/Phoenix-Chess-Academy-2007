import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getCoachById, getAssignedBatches } from "@/lib/queries/admin/coaches";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { CoachForm } from "@/components/admin/coaches/CoachForm";
import { CoachStatusControl } from "@/components/admin/coaches/CoachStatusControl";
import { CoachBatchAssignmentPanel } from "@/components/admin/coaches/CoachBatchAssignmentPanel";
import { ProvisionAccountButton } from "@/components/admin/ProvisionAccountButton";
import { provisionCoachAccount } from "@/lib/actions/admin/accounts";

export const metadata = buildMetadata({ title: "Coach", description: "Coach record.", path: "/admin/coaches", index: false });

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_COACHES");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await getCoachById(id);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const coach = result.data;
  const assignedResult = await getAssignedBatches(id);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={coach.full_name} description={`Coach code ${coach.coach_code}`} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={coach.status} tone={toneForStatus("coach", coach.status)} />
        <CoachStatusControl coachId={id} currentStatus={coach.status} />
      </div>

      <section>
        <h2 className="text-body font-medium text-foreground">Portal account</h2>
        <div className="mt-2">
          <ProvisionAccountButton recordId={id} hasEmail={Boolean(coach.email)} hasAccount={Boolean(coach.profile_id)} action={provisionCoachAccount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Record details</h2>
        <CoachForm
          mode="edit"
          coachId={id}
          initialValues={{
            fullName: coach.full_name,
            email: coach.email ?? "",
            phone: coach.phone ?? "",
            whatsapp: coach.whatsapp ?? "",
            bio: coach.bio ?? "",
            specializations: coach.specializations.join(", "),
            joinedOn: coach.joined_on ?? "",
          }}
        />
      </section>

      <section>
        {assignedResult.ok ? <CoachBatchAssignmentPanel coachId={id} assignedBatches={assignedResult.data} /> : <AdminQueryError code={assignedResult.code} />}
      </section>
    </div>
  );
}
