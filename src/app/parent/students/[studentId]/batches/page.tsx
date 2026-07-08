import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { listParentStudentBatches, type ParentStudentBatchRow } from "@/lib/queries/parent/batches";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";

export const metadata = buildMetadata({
  title: "Student Batches",
  description: "Batch assignments for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

function BatchCard({ batch }: { batch: ParentStudentBatchRow }) {
  return (
    <li className="rounded-lg border border-border p-5">
      <p className="text-body font-medium text-foreground">{batch.batchName}</p>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {batch.programName} · {batch.trainingMode}
        {batch.level ? ` · ${batch.level}` : ""}
        {batch.locationName ? ` · ${batch.locationName}` : ""}
      </p>
      {batch.coaches.length > 0 ? (
        <p className="mt-1 text-body-sm text-muted-foreground">
          Coach{batch.coaches.length > 1 ? "es" : ""}: {batch.coaches.map((c) => c.fullName).join(", ")}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Assigned {batch.assignedAt}
        {batch.endedAt ? ` · Ended ${batch.endedAt}` : ""}
      </p>
    </li>
  );
}

/**
 * "Linked Student Batches" — supports multiple simultaneous current
 * batch assignments if the data contains them; no invented one-batch
 * rule. See docs/PARENT_PORTAL_ARCHITECTURE.md, "Current/Historical
 * Batch Display".
 */
export default async function ParentStudentBatchesPage({ params }: { params: Promise<{ studentId: string }> }) {
  const identity = await getCurrentParent();

  if (identity.status !== "OK") {
    return (
      <ParentPortalState
        code={identity.status === "NOT_LINKED" ? "PARENT_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <ParentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const { studentId } = await params;
  const linked = await getLinkedStudent(identity.parent.id, studentId);

  if (!linked.ok) {
    if (linked.reason === "DATABASE_UNAVAILABLE") {
      return <ParentPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const student = linked.student;
  const result = await listParentStudentBatches(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const { current, historical } = result.data;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h4 text-foreground">{student.fullName} — Batches</h1>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Current Batches</h2>
        {current.length === 0 ? (
          <ParentPortalState code="NO_BATCHES" />
        ) : (
          <ul className="flex flex-col gap-3">
            {current.map((batch) => (
              <BatchCard key={batch.batchId} batch={batch} />
            ))}
          </ul>
        )}
      </section>

      {historical.length > 0 ? (
        <section>
          <h2 className="mb-3 text-body font-medium text-foreground">Previous Batches</h2>
          <ul className="flex flex-col gap-3">
            {historical.map((batch) => (
              <BatchCard key={batch.batchId} batch={batch} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
