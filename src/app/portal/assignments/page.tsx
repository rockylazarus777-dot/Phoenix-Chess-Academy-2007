import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentStudent } from "@/lib/portal/getCurrentStudent";
import { getStudentAssignments } from "@/lib/queries/student/assignments";
import { StudentPortalState } from "@/components/portal/student/StudentPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { AssignmentSubmissionStatusBadge, type SubmissionDisplayStatus } from "@/components/portal/AssignmentSubmissionStatusBadge";
import { formatAssignmentDueDate } from "@/lib/portal/assignmentDates";
import type { StudentAssignmentRow } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Assignments",
  description: "Your Phoenix Chess Academy assignments.",
  path: "/portal/assignments",
  index: false,
});

type Group = "OPEN" | "SUBMITTED" | "REVISION_REQUESTED" | "REVIEWED" | "ARCHIVED";

const GROUP_HEADINGS: Record<Group, string> = {
  OPEN: "Open Assignments",
  SUBMITTED: "Submitted Assignments",
  REVISION_REQUESTED: "Revision Requested",
  REVIEWED: "Reviewed Assignments",
  ARCHIVED: "Archived Assignments",
};

const GROUP_ORDER: Group[] = ["REVISION_REQUESTED", "OPEN", "SUBMITTED", "REVIEWED", "ARCHIVED"];

function groupFor(row: StudentAssignmentRow): Group {
  if (row.status === "ARCHIVED") return "ARCHIVED";
  if (row.submission_status === "REVISION_REQUESTED") return "REVISION_REQUESTED";
  if (row.submission_status === "REVIEWED") return "REVIEWED";
  if (row.submission_status === "SUBMITTED") return "SUBMITTED";
  return "OPEN";
}

/**
 * `/portal/assignments` — every row comes from `get_student_assignments()`,
 * read authorization deriving from `assignment_recipients` (never live
 * batch membership). DRAFT never appears. `submission_status` null renders
 * as the UI-only "Not Submitted" label — never persisted. No completion
 * percentage is ever calculated or displayed. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Student Assignment List".
 */
export default async function StudentAssignmentsPage() {
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

  const result = await getStudentAssignments();
  if (!result.ok) {
    return <StudentPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">Assignments</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">Assignments from your batch or assigned directly to you.</p>
      </div>

      {rows.length === 0 ? (
        <StudentPortalState code="NO_ASSIGNMENTS" />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUP_ORDER.map((group) => {
            const groupRows = rows.filter((row) => groupFor(row) === group);
            if (groupRows.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="mb-3 text-body font-medium text-foreground">{GROUP_HEADINGS[group]}</h2>
                <ul className="flex flex-col gap-3">
                  {groupRows.map((row) => {
                    const displayStatus: SubmissionDisplayStatus = row.submission_status ?? "NOT_SUBMITTED";
                    return (
                      <li key={row.assignment_id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/portal/assignments/${row.assignment_id}`} className="text-body font-medium text-primary-text hover:underline">
                            {row.title}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2">
                            <AssignmentStatusBadge status={row.status} />
                            <AssignmentSubmissionStatusBadge status={displayStatus} />
                          </div>
                        </div>
                        <p className="mt-1 text-body-sm text-muted-foreground">
                          {row.batch_name} · {row.program_name ?? "—"}
                        </p>
                        <p className="mt-1 text-body-sm text-muted-foreground">Due: {formatAssignmentDueDate(row.due_at)}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
