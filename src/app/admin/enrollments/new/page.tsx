import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EnrollmentForm } from "@/components/admin/enrollments/EnrollmentForm";

export const metadata = buildMetadata({ title: "Add Enrollment", description: "Create a program enrollment.", path: "/admin/enrollments/new", index: false });

export default async function NewEnrollmentPage() {
  await requirePermission("MANAGE_ENROLLMENTS");

  return (
    <div>
      <AdminPageHeader title="Add enrollment" description="Account provisioning is a separate, explicit action — creating an enrollment never creates a portal account." />
      <div className="mt-6">
        <EnrollmentForm />
      </div>
    </div>
  );
}
