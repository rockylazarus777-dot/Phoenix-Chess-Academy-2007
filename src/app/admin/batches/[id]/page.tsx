import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { requirePermission } from "@/lib/auth/permissions";
import { getBatchById, getBatchCoaches, getBatchStudents } from "@/lib/queries/admin/batches";
import { listSchedules } from "@/lib/queries/admin/schedules";
import { isUuid } from "@/lib/admin/uuid";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminQueryError } from "@/components/admin/AdminQueryError";
import { StatusBadge, toneForStatus } from "@/components/admin/StatusBadge";
import { BatchForm } from "@/components/admin/batches/BatchForm";
import { BatchStatusControl } from "@/components/admin/batches/BatchStatusControl";
import { BatchCoachesPanel } from "@/components/admin/batches/BatchCoachesPanel";

export const metadata = buildMetadata({ title: "Batch", description: "Training batch record.", path: "/admin/batches", index: false });

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_BATCHES");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const result = await getBatchById(id);
  if (!result.ok) return <AdminQueryError code={result.code} />;
  if (!result.data) notFound();

  const batch = result.data;

  const [coachesResult, studentsResult, schedulesResult] = await Promise.all([
    getBatchCoaches(id),
    getBatchStudents(id),
    listSchedules({ page: 1, pageSize: 50, batchId: id, dayOfWeek: null, activeOnly: false }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={batch.name} description={`Batch code ${batch.batch_code}`} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={batch.status} tone={toneForStatus("batch", batch.status)} />
        <BatchStatusControl batchId={id} currentStatus={batch.status} />
      </div>

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Batch details</h2>
        <BatchForm
          mode="edit"
          batchId={id}
          initialValues={{
            batchCode: batch.batch_code,
            name: batch.name,
            programId: batch.program_id,
            locationId: batch.location_id ?? "",
            trainingMode: batch.training_mode,
            level: batch.level ?? "",
            primaryCoachId: batch.primary_coach_id ?? "",
            capacity: batch.capacity != null ? String(batch.capacity) : "",
            startDate: batch.start_date ?? "",
            endDate: batch.end_date ?? "",
          }}
        />
      </section>

      <section>{coachesResult.ok ? <BatchCoachesPanel batchId={id} assignedCoaches={coachesResult.data} /> : <AdminQueryError code={coachesResult.code} />}</section>

      <section className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-medium text-foreground">Schedules</h2>
          <Link href={`/admin/schedules/new?batchId=${id}`} className="text-body-sm text-primary-text hover:underline">
            Add schedule
          </Link>
        </div>
        {!schedulesResult.ok ? (
          <AdminQueryError code={schedulesResult.code} />
        ) : schedulesResult.data.rows.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No class schedules yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {schedulesResult.data.rows.map((row) => (
              <li key={row.id} className="rounded-md border border-border p-3 text-body-sm text-foreground">
                {row.day_of_week} {row.start_time}–{row.end_time} {row.active ? "" : "(inactive)"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-body font-medium text-foreground">Current students</h2>
        {!studentsResult.ok ? (
          <AdminQueryError code={studentsResult.code} />
        ) : studentsResult.data.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted-foreground">No students currently assigned to this batch.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {studentsResult.data.map((row) => (
              <li key={row.student_id} className="text-body-sm text-foreground">
                <Link href={`/admin/students/${row.student_id}`} className="text-primary-text hover:underline">
                  {row.full_name} ({row.student_code})
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
