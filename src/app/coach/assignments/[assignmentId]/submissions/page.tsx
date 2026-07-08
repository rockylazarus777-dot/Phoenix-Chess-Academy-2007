import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getCoachAssignment } from "@/lib/queries/coach/assignments";
import { listAssignmentSubmissions } from "@/lib/queries/coach/submissions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentSubmissionStatusBadge, type SubmissionDisplayStatus } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { formatAssignmentTimestamp } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Assignment Submissions",
  description: "Student submissions for one assignment.",
  path: "/coach/assignments",
  index: false,
});

/**
 * `/coach/assignments/[assignmentId]/submissions` — authorizes the
 * assignment first via `getCoachAssignment()` (identical historical read
 * rule as the detail page), then lists every `assignment_recipients` row
 * for this assignment merged with narrow submission state. Never shows
 * student contact PII, parent data, attendance, progress evaluations, or
 * payment information. See docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach
 * Submissions Page".
 */
export default async function CoachAssignmentSubmissionsPage({ params }: { params: Promise<{ assignmentId: string }> }) {
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

  const { assignmentId } = await params;
  const assignmentResult = await getCoachAssignment(assignmentId);
  if (!assignmentResult.ok) {
    return <CoachPortalState code={assignmentResult.code} />;
  }
  if (!assignmentResult.data) {
    notFound();
  }
  const assignment = assignmentResult.data;

  const submissionsResult = await listAssignmentSubmissions(assignmentId);
  if (!submissionsResult.ok) {
    return <CoachPortalState code={submissionsResult.code} />;
  }
  const rows = submissionsResult.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{assignment.title} — Submissions</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {assignment.batch_name} · {assignment.recipient_count} recipients
        </p>
        <p className="mt-2">
          <Link href={`/coach/assignments/${assignment.assignment_id}`} className="text-body-sm font-medium text-primary-text hover:underline">
            Back to assignment
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <CoachPortalState code="NO_SUBMISSIONS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const displayStatus: SubmissionDisplayStatus = row.status ?? "NOT_SUBMITTED";
            return (
              <li key={row.student_id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body font-medium text-foreground">
                    {row.student_full_name} ({row.student_code})
                  </p>
                  <AssignmentSubmissionStatusBadge status={displayStatus} />
                </div>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  Submitted: {formatAssignmentTimestamp(row.submitted_at)}
                  {row.reviewed_at ? ` · Reviewed: ${formatAssignmentTimestamp(row.reviewed_at)}` : ""}
                </p>
                {row.submission_id ? (
                  <p className="mt-2">
                    <Link
                      href={`/coach/assignments/${assignment.assignment_id}/submissions/${row.submission_id}`}
                      className="text-body-sm font-medium text-primary-text hover:underline"
                    >
                      View submission
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
