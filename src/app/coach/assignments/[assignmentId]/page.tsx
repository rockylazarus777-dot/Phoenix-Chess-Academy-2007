import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getCoachAssignment } from "@/lib/queries/coach/assignments";
import { listCoachBatchSessions, type CoachSessionListRow } from "@/lib/queries/coach/sessions";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { AssignmentEditForm } from "@/components/portal/coach/AssignmentEditForm";
import { AssignmentStatusActions } from "@/components/portal/coach/AssignmentStatusActions";
import { formatAssignmentDueDate, formatAssignmentTimestamp, toDatetimeLocalInputValue } from "@/lib/portal/assignmentDates";

export const metadata = buildMetadata({
  title: "Assignment Detail",
  description: "Details for an assignment.",
  path: "/coach/assignments",
  index: false,
});

/**
 * `/coach/assignments/[assignmentId]` — every request independently calls
 * `getCoachAssignment()`, which enforces the coach historical read rule
 * inside `get_coach_assignment()`. Invalid UUID, nonexistent assignment,
 * and an assignment outside the read rule all render `notFound()`
 * identically. Internal identifiers (`coach_id`/`created_by`/
 * `published_by`) are never fetched into this page — `coach_can_manage`/
 * `coach_can_archive` gate the Edit/Publish/Archive controls. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Assignment Detail" and "Assignment
 * Edit Architecture".
 */
export default async function CoachAssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
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
  const result = await getCoachAssignment(assignmentId);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }
  if (!result.data) {
    notFound();
  }

  const assignment = result.data;
  const canEdit = assignment.coach_can_manage;

  let sessions: CoachSessionListRow[] = [];
  if (canEdit) {
    const sessionsResult = await listCoachBatchSessions(assignment.batch_id);
    if (sessionsResult.ok) sessions = sessionsResult.data;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h4 text-foreground">{assignment.title}</h1>
          <AssignmentStatusBadge status={assignment.status} />
        </div>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {assignment.audience_type === "STUDENT" && assignment.student_full_name
            ? `${assignment.student_full_name} (${assignment.student_code})`
            : "Whole batch"}{" "}
          · {assignment.batch_name} · {assignment.program_name ?? "—"}
        </p>
        {assignment.session_date ? <p className="mt-1 text-body-sm text-muted-foreground">Linked session: {assignment.session_date}</p> : null}
        <p className="mt-1 text-body-sm text-muted-foreground">
          Due: {formatAssignmentDueDate(assignment.due_at)} · Late submission: {assignment.allow_late_submission ? "Allowed" : "Not allowed"}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Authored by {assignment.author_name}
          {assignment.published_at ? ` · Published ${formatAssignmentTimestamp(assignment.published_at)}` : ""}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {assignment.recipient_count} recipients · {assignment.submission_count} submitted
        </p>
        {assignment.status !== "DRAFT" ? (
          <p className="mt-2">
            <Link href={`/coach/assignments/${assignment.assignment_id}/submissions`} className="text-body-sm font-medium text-primary-text hover:underline">
              View submissions
            </Link>
          </p>
        ) : null}
      </div>

      <AssignmentStatusActions
        assignmentId={assignment.assignment_id}
        canPublish={assignment.coach_can_manage && assignment.status === "DRAFT"}
        canArchive={assignment.coach_can_archive}
      />

      {canEdit && assignment.status === "DRAFT" ? (
        <AssignmentEditForm
          assignmentId={assignment.assignment_id}
          programId={null}
          sessions={sessions}
          initialTitle={assignment.title}
          initialDescription={assignment.description}
          initialInstructions={assignment.instructions ?? ""}
          initialSessionId={assignment.session_id ?? ""}
          initialDueAt={toDatetimeLocalInputValue(assignment.due_at)}
          initialAllowLateSubmission={assignment.allow_late_submission}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <section>
            <h2 className="mb-1 text-body font-medium text-foreground">Description</h2>
            <p className="text-body-sm text-muted-foreground">{assignment.description}</p>
          </section>
          {assignment.instructions ? (
            <section>
              <h2 className="mb-1 text-body font-medium text-foreground">Instructions</h2>
              <p className="text-body-sm text-muted-foreground">{assignment.instructions}</p>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
