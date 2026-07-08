import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { listCoachBatches } from "@/lib/queries/coach/batches";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { CoachStatusBadge, batchStatusTone } from "@/components/portal/coach/CoachStatusBadge";

export const metadata = buildMetadata({
  title: "My Batches",
  description: "Batches assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * "My Batches" — every current `batch_coaches` relationship for the
 * authenticated coach. Supports one coach -> many batches and one
 * batch -> many coaches. Authorization is based on the relationship
 * existing at all, not on the coach's assignment role — an ASSISTANT
 * coach sees their assigned batches exactly the same as a PRIMARY
 * coach in this read-only phase. See
 * docs/COACH_PORTAL_ARCHITECTURE.md, "My Batches Architecture".
 */
export default async function CoachBatchesPage() {
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h4 text-foreground">My Batches</h1>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_BATCHES" />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((batch) => (
            <li key={batch.id} className="rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/coach/batches/${batch.id}`} className="text-body font-medium text-primary-text hover:underline">
                  {batch.name}
                </Link>
                <CoachStatusBadge label={batch.status} tone={batchStatusTone(batch.status)} />
              </div>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {batch.batchCode} · {batch.programName} · {batch.trainingMode}
                {batch.level ? ` · ${batch.level}` : ""}
                {batch.locationName ? ` · ${batch.locationName}` : ""} · {batch.assignmentRole}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
