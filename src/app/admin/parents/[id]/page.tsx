import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getParentById, getLinkedStudents } from "@/lib/queries/admin/parents";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { ParentForm } from "@/components/admin/parents/ParentForm";
import { ParentStatusControl } from "@/components/admin/parents/ParentStatusControl";
import { LinkStudentPanel } from "@/components/admin/parents/LinkStudentPanel";
import { ProvisionAccountButton } from "@/components/admin/ProvisionAccountButton";
import { provisionParentAccount } from "@/lib/actions/admin/accounts";

export const metadata = buildMetadata({ title: "Parent", description: "Parent record.", path: "/admin/parents", index: false });

export default async function ParentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_PARENTS");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await getParentById(id);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const parent = result.data;
  const linkedResult = await getLinkedStudents(id);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={parent.full_name} description={parent.phone} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={parent.status} tone={toneForStatus("parent", parent.status)} />
        <ParentStatusControl parentId={id} currentStatus={parent.status} />
      </div>

      <section>
        <h2 className="text-body font-medium text-foreground">Portal account</h2>
        <div className="mt-2">
          <ProvisionAccountButton recordId={id} hasEmail={Boolean(parent.email)} hasAccount={Boolean(parent.profile_id)} action={provisionParentAccount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Record details</h2>
        <ParentForm
          mode="edit"
          parentId={id}
          initialValues={{
            fullName: parent.full_name,
            email: parent.email ?? "",
            phone: parent.phone,
            whatsapp: parent.whatsapp ?? "",
            country: parent.country ?? "",
            state: parent.state ?? "",
            city: parent.city ?? "",
            notes: parent.notes ?? "",
          }}
        />
      </section>

      <section>
        {linkedResult.ok ? <LinkStudentPanel parentId={id} linkedStudents={linkedResult.data} /> : <AdminQueryError code={linkedResult.code} />}
      </section>
    </div>
  );
}
