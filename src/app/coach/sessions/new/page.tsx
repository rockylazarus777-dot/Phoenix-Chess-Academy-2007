import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { listCoachBatches } from "@/lib/queries/coach/batches";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ClassSessionForm } from "@/components/portal/coach/ClassSessionForm";

export const metadata = buildMetadata({
  title: "New Class Session",
  description: "Create a class session for one of your assigned batches.",
  path: "/coach/sessions/new",
  index: false,
});

/**
 * A coach may only create a session for a batch already resolved by
 * `listCoachBatches()` (itself `batch_coaches`-scoped). The optional
 * `?batchId=` query param only preselects the `<select>` default — it is
 * still just one of the same authorized options, and the Server Action
 * re-authorizes the submitted batchId regardless. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "New Session Page".
 */
export default async function NewCoachSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ batchId?: string }>;
}) {
  const identity = await getCurrentCoach();

  if (identity.status !== "OK") {
    return (
      <CoachPortalState
        code={identity.status === "NOT_LINKED" ? "COACH_NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <CoachPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await listCoachBatches(identity.coach.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }
  if (result.data.length === 0) {
    return <CoachPortalState code="NO_BATCHES" />;
  }

  const { batchId: requestedBatchId } = await searchParams;
  const initialBatchId = result.data.some((batch) => batch.id === requestedBatchId) ? (requestedBatchId as string) : "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">New Class Session</h1>
      <ClassSessionForm
        batches={result.data.map((batch) => ({ id: batch.id, name: batch.name, batchCode: batch.batchCode }))}
        initialBatchId={initialBatchId}
      />
    </div>
  );
}
