import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getAuthorizedBatchStudent } from "@/lib/coach/progressAuthorization";
import { getCoachStudentProgressHistory } from "@/lib/queries/coach/progress";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { ProgressEvaluationStatusBadge } from "@/components/portal/ProgressEvaluationStatusBadge";
import { DevelopmentAreaRating } from "@/components/portal/DevelopmentAreaRating";

export const metadata = buildMetadata({
  title: "Student Progress History",
  description: "Development progress evaluation history for a student in a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * `/coach/batches/[batchId]/students/[studentId]/progress` — authorizes
 * the batch assignment AND the student's membership in that specific
 * batch's roster (`getAuthorizedBatchStudent()`) before rendering anything
 * — "knowing studentId is never enough." Not a generic student profile:
 * shows only evaluation period/status/ratings/summaries for this batch,
 * never attendance, parent data, or student contact information. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Coach Student Progress History".
 */
export default async function CoachStudentProgressHistoryPage({
  params,
}: {
  params: Promise<{ batchId: string; studentId: string }>;
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

  const { batchId, studentId } = await params;
  const assigned = await getAssignedBatch(identity.coach.id, batchId);
  if (!assigned.ok) {
    if (assigned.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const authorizedStudent = await getAuthorizedBatchStudent(batchId, studentId);
  if (!authorizedStudent.ok) {
    if (authorizedStudent.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const batch = assigned.batch;
  const student = authorizedStudent.student;
  const result = await getCoachStudentProgressHistory(batch.id, student.student_id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">
          {student.full_name} ({student.student_code}) — Progress History
        </h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {batch.name} ({batch.batchCode})
        </p>
      </div>

      <div>
        <Link
          href={`/coach/progress/new?batchId=${batch.id}&studentId=${student.student_id}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground"
        >
          New Evaluation
        </Link>
      </div>

      {result.data.length === 0 ? (
        <CoachPortalState code="NO_PROGRESS" />
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.map((evaluation) => (
            <li key={evaluation.evaluation_id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body font-medium text-foreground">
                  {evaluation.evaluation_period_start} – {evaluation.evaluation_period_end}
                </p>
                <ProgressEvaluationStatusBadge status={evaluation.status} />
              </div>
              <p className="mt-1 text-body-sm text-muted-foreground">
                By {evaluation.author_name}
                {evaluation.published_at ? ` · Published ${evaluation.published_at.slice(0, 10)}` : ""}
              </p>
              {evaluation.overall_summary ? <p className="mt-2 text-body-sm text-foreground">{evaluation.overall_summary}</p> : null}
              {evaluation.area_ratings && evaluation.area_ratings.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {evaluation.area_ratings.map((rating) => (
                    <DevelopmentAreaRating key={rating.area} area={rating.area} rating={rating.rating} comment={rating.comment} />
                  ))}
                </div>
              ) : null}
              <Link href={`/coach/progress/${evaluation.evaluation_id}`} className="mt-3 inline-block text-body-sm text-primary-text hover:underline">
                View full evaluation
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
