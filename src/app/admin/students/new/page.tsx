import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StudentForm } from "@/components/admin/students/StudentForm";

export const metadata = buildMetadata({ title: "Add Student", description: "Create a new student record.", path: "/admin/students/new", index: false });

export default async function NewStudentPage() {
  await requirePermission("MANAGE_STUDENTS");

  return (
    <div>
      <AdminPageHeader title="Add student" description="The student code is generated automatically once saved." />
      <div className="mt-6">
        <StudentForm mode="create" />
      </div>
    </div>
  );
}
