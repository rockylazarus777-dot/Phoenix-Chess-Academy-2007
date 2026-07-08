import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentProgressEvaluations } from "@/lib/queries/student/progress";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { DevelopmentAreaRating } from "@/components/portal/DevelopmentAreaRating";

export const metadata = buildMetadata({
  title: "Progress",
  description: "Your Phoenix Chess Academy development progress evaluations.",
  path: "/portal/progress",
  index: false,
});

/**
 * `/portal/progress` — every row comes from
 * `get_student_progress_evaluations()`, scoped internally to the current
 * student only (never a `studentId` accepted from the browser) and
 * PUBLISHED-only (DRAFT/ARCHIVED never reach this page). Coach display
 * name may be shown; coach email/phone/whatsapp/profile ID are never
 * fetched into this page. No percentage/overall score is ever calculated
 * or displayed. See docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Student
 * Progress Route".
 */
export default async function StudentProgressPage() {
  const identity = await getCurrentStudent();

  if (identity.status !== "OK") {
    return (
      <StudentPortalState
        code={identity.status === "NOT_LINKED" ? "NOT_LINKED" : identity.status === "DATABASE_UNAVAILABLE" ? "DATABASE_UNAVAILABLE" : "UNKNOWN"}
      />
    );
  }
  if (identity.access === "DENIED") {
    return <StudentPortalState code="ACCOUNT_RESTRICTED" />;
  }

  const result = await getStudentProgressEvaluations();
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Progress</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Your published development progress evaluations.</p>
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_PROGRESS" />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.evaluation_id} className="rounded-lg border border-border p-4">
              <p className="text-body font-medium text-foreground">
                {row.evaluation_period_start} – {row.evaluation_period_end}
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {row.batch_name} · {row.program_name ?? "—"} · By {row.coach_display_name} · Published {row.published_at.slice(0, 10)}
              </p>

              {row.overall_summary ? <p className="mt-2 text-body-sm text-foreground">{row.overall_summary}</p> : null}
              {row.strengths ? (
                <p className="mt-2 text-body-sm text-foreground">
                  <span className="font-medium">Strengths:</span> {row.strengths}
                </p>
              ) : null}
              {row.development_focus ? (
                <p className="mt-2 text-body-sm text-foreground">
                  <span className="font-medium">Development Focus:</span> {row.development_focus}
                </p>
              ) : null}
              {row.coach_recommendation ? (
                <p className="mt-2 text-body-sm text-foreground">
                  <span className="font-medium">Coach Recommendation:</span> {row.coach_recommendation}
                </p>
              ) : null}

              {row.area_ratings && row.area_ratings.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {row.area_ratings.map((rating) => (
                    <DevelopmentAreaRating key={rating.area} area={rating.area} rating={rating.rating} comment={rating.comment} />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
