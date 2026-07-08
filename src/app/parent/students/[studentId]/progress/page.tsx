import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentParent } from "@/lib/parent/getCurrentParent";
import { getLinkedStudent } from "@/lib/parent/authorization";
import { getParentStudentProgressEvaluations } from "@/lib/queries/parent/progress";
import { ParentPortalState } from "@/components/portal/parent/ParentPortalState";
import { StudentContextNav } from "@/components/portal/parent/StudentContextNav";
import { DevelopmentAreaRating } from "@/components/portal/DevelopmentAreaRating";

export const metadata = buildMetadata({
  title: "Student Progress",
  description: "Development progress evaluations for a student linked to your Phoenix Chess Academy parent account.",
  path: "/parent/students",
  index: false,
});

/**
 * `/parent/students/[studentId]/progress` — every request re-verifies the
 * parent/student relationship via `getLinkedStudent()` first (same
 * enumeration-protection contract as every other linked-student route),
 * then queries evaluations through `getParentStudentProgressEvaluations()`,
 * a second, independent authorization layer. Only PUBLISHED evaluations are
 * ever shown — DRAFT/ARCHIVED never reach this page. Coach contact
 * details, student contact data, attendance data, payment data, and
 * internal UUIDs are never shown here. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Parent Progress Route".
 */
export default async function ParentStudentProgressPage({ params }: { params: Promise<{ studentId: string }> }) {
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
  const result = await getParentStudentProgressEvaluations(student.id);
  if (!result.ok) {
    return <ParentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{student.fullName} — Progress</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Published development progress evaluations.</p>
      </div>

      <StudentContextNav studentId={student.id} studentName={student.fullName} />

      {rows.length === 0 ? (
        <ParentPortalState code="NO_PROGRESS" />
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
