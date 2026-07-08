import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getStudentById } from "@/lib/queries/admin/students";
import { getLinkedParents } from "@/lib/queries/admin/parents";
import { listEnrollments } from "@/lib/queries/admin/enrollments";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { StudentForm } from "@/components/admin/students/StudentForm";
import { StudentStatusControl } from "@/components/admin/students/StudentStatusControl";
import { LinkParentPanel } from "@/components/admin/students/LinkParentPanel";
import { StudentEnrollPanel } from "@/components/admin/students/StudentEnrollPanel";
import { ProvisionAccountButton } from "@/components/admin/ProvisionAccountButton";
import { provisionStudentAccount } from "@/lib/actions/admin/accounts";

export const metadata = buildMetadata({ title: "Student", description: "Student record.", path: "/admin/students", index: false });

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_STUDENTS");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await getStudentById(id);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const student = result.data;

  const [parentsResult, enrollmentsResult] = await Promise.all([
    getLinkedParents(id),
    listEnrollments({ page: 1, pageSize: 50, studentId: id, programId: null, batchId: null, status: null }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={student.full_name} description={`Student code ${student.student_code}`} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={student.status} tone={toneForStatus("student", student.status)} />
        <StudentStatusControl studentId={id} currentStatus={student.status} />
      </div>

      <section>
        <h2 className="text-body font-medium text-foreground">Portal account</h2>
        <div className="mt-2">
          <ProvisionAccountButton
            recordId={id}
            hasEmail={Boolean(student.email)}
            hasAccount={Boolean(student.profile_id)}
            action={provisionStudentAccount}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Record details</h2>
        <StudentForm
          mode="edit"
          studentId={id}
          initialValues={{
            fullName: student.full_name,
            dateOfBirth: student.date_of_birth,
            gender: student.gender ?? "",
            email: student.email ?? "",
            phone: student.phone ?? "",
            whatsapp: student.whatsapp ?? "",
            country: student.country,
            state: student.state ?? "",
            city: student.city ?? "",
            address: student.address ?? "",
            fideId: student.fide_id ?? "",
            fideRating: student.fide_rating != null ? String(student.fide_rating) : "",
            chessAssociationId: student.chess_association_id ?? "",
            currentLevel: student.current_level ?? "",
            joinedOn: student.joined_on ?? "",
            notes: student.notes ?? "",
          }}
        />
      </section>

      <section>
        {parentsResult.ok ? (
          <LinkParentPanel studentId={id} linkedParents={parentsResult.data} />
        ) : (
          <AdminQueryError code={parentsResult.code} />
        )}
      </section>

      <section>
        {enrollmentsResult.ok ? (
          <StudentEnrollPanel
            studentId={id}
            enrollments={enrollmentsResult.data.rows.map((row) => ({
              id: row.id,
              program_name: row.program_name,
              batch_name: row.batch_name,
              status: row.status,
              enrolled_on: row.enrolled_on,
            }))}
          />
        ) : (
          <AdminQueryError code={enrollmentsResult.code} />
        )}
      </section>
    </div>
  );
}
