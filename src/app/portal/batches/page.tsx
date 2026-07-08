import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { listStudentBatches, type StudentBatchRow } from "@/lib/queries/student/batches";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";

export const metadata = buildMetadata({
  title: "My Batches",
  description: "Your Phoenix Chess Academy batch assignments.",
  path: "/portal/batches",
  index: false,
});

function BatchCard({ batch }: { batch: StudentBatchRow }) {
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
 * "My Batches" — supports multiple simultaneous current batch
 * assignments if the data contains them; Phase 10 explicitly left
 * "one batch at a time" as an open business rule, not enforced. See
 * docs/STUDENT_PORTAL_ARCHITECTURE.md, "Active/Historical Batch
 * Display".
 */
export default async function StudentBatchesPage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return <StudentPortalState code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"} />;
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await listStudentBatches(identity.student.id);
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const { current, historical } = result.data;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h4 text-foreground">My Batches</h1>

      <section>
        <h2 className="mb-3 text-body font-medium text-foreground">Current Batches</h2>
        {current.length === 0 ? (
          <StudentPortalState code="NO_BATCHES" />
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
