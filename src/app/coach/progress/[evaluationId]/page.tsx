import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getCoachProgressEvaluation } from "@/lib/queries/coach/progress";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ProgressEvaluationStatusBadge } from "@/components/portal/ProgressEvaluationStatusBadge";
import { DevelopmentAreaRating } from "@/components/portal/DevelopmentAreaRating";
import { ProgressEvaluationEditForm } from "@/components/portal/coach/ProgressEvaluationEditForm";
import { EvaluationStatusActions } from "@/components/portal/coach/EvaluationStatusActions";

export const metadata = buildMetadata({
  title: "Progress Evaluation Detail",
  description: "Details for a student development progress evaluation.",
  path: "/coach/progress",
  index: false,
});

/**
 * `/coach/progress/[evaluationId]` — every request independently calls
 * `getCoachProgressEvaluation()`, which enforces the coach historical read
 * rule inside `get_coach_progress_evaluation()`. Invalid UUID, nonexistent
 * evaluation, and an evaluation outside the read rule all render
 * `notFound()` identically (Evaluation Enumeration Protection). Internal
 * identifiers (`coach_id`/`created_by`/`published_by`) are never fetched
 * into this page at all — the RPC's `coach_can_manage` boolean is what
 * gates the Edit/Publish/Archive controls. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Evaluation Detail" and
 * "Edit Architecture".
 */
export default async function CoachProgressEvaluationDetailPage({ params }: { params: Promise<{ evaluationId: string }> }) {
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

  const { evaluationId } = await params;
  const result = await getCoachProgressEvaluation(evaluationId);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const evaluation = result.data;
  const canEdit = evaluation.coach_can_manage && evaluation.status === "DRAFT";
  const areaRatings = evaluation.area_ratings ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">
            {evaluation.student_full_name} ({evaluation.student_code})
          </h1>
          <ProgressEvaluationStatusBadge status={evaluation.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {evaluation.batch_name} · {evaluation.program_name ?? "—"}
          {evaluation.student_current_level ? ` · ${evaluation.student_current_level}` : ""}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Evaluation period: {evaluation.evaluation_period_start} – {evaluation.evaluation_period_end}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Authored by {evaluation.author_name}
          {evaluation.published_at ? ` · Published ${evaluation.published_at.slice(0, 10)}` : ""}
        </p>
      </div>

      {canEdit ? (
        <>
          <EvaluationStatusActions evaluationId={evaluation.evaluation_id} />
          <ProgressEvaluationEditForm
            evaluationId={evaluation.evaluation_id}
            initialPeriodStart={evaluation.evaluation_period_start}
            initialPeriodEnd={evaluation.evaluation_period_end}
            initialSummary={evaluation.overall_summary ?? ""}
            initialStrengths={evaluation.strengths ?? ""}
            initialDevelopmentFocus={evaluation.development_focus ?? ""}
            initialCoachRecommendation={evaluation.coach_recommendation ?? ""}
            initialAreaRatings={evaluation.area_ratings}
          />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {evaluation.overall_summary ? (
            <section>
              <h2 className="mb-1 text-body font-medium text-foreground">Overall Summary</h2>
              <p className="text-body-sm text-muted-foreground">{evaluation.overall_summary}</p>
            </section>
          ) : null}
          {evaluation.strengths ? (
            <section>
              <h2 className="mb-1 text-body font-medium text-foreground">Strengths</h2>
              <p className="text-body-sm text-muted-foreground">{evaluation.strengths}</p>
            </section>
          ) : null}
          {evaluation.development_focus ? (
            <section>
              <h2 className="mb-1 text-body font-medium text-foreground">Development Focus</h2>
              <p className="text-body-sm text-muted-foreground">{evaluation.development_focus}</p>
            </section>
          ) : null}
          {evaluation.coach_recommendation ? (
            <section>
              <h2 className="mb-1 text-body font-medium text-foreground">Coach Recommendation</h2>
              <p className="text-body-sm text-muted-foreground">{evaluation.coach_recommendation}</p>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-body font-medium text-foreground">Development Area Ratings</h2>
            {areaRatings.length === 0 ? (
              <p className="text-body-sm text-muted-foreground">No development areas were rated.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {areaRatings.map((rating) => (
                  <DevelopmentAreaRating key={rating.area} area={rating.area} rating={rating.rating} comment={rating.comment} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
