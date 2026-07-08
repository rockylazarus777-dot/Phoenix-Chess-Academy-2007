import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { listCoachAssignments } from "@/lib/queries/coach/assignments";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { AssignmentStatusBadge } from "@/components/portal/AssignmentStatusBadge";
import { formatAssignmentDueDate } from "@/lib/portal/assignmentDates";
import type { AssignmentStatus, CoachAssignmentListRow } from "@/lib/supabase/types";

export const metadata = buildMetadata({
  title: "Assignments",
  description: "Assignments you have authored or currently manage for your assigned batches.",
  path: "/coach/assignments",
  index: false,
});

const GROUPS: { status: AssignmentStatus; heading: string }[] = [
  { status: "DRAFT", heading: "Draft Assignments" },
  { status: "PUBLISHED", heading: "Published Assignments" },
  { status: "ARCHIVED", heading: "Archived Assignments" },
];

function AssignmentRow({ row }: { row: CoachAssignmentListRow }) {
  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/coach/assignments/${row.assignment_id}`} className="text-body font-medium text-primary-text hover:underline">
          {row.title}
        </Link>
        <AssignmentStatusBadge status={row.status} />
      </div>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {row.audience_type === "STUDENT" && row.student_full_name
          ? `${row.student_full_name} (${row.student_code})`
          : "Whole batch"}{" "}
        · {row.batch_name} · {row.program_name ?? "—"}
      </p>
      <p className="mt-1 text-body-sm text-muted-foreground">Due: {formatAssignmentDueDate(row.due_at)}</p>
      {row.status !== "DRAFT" ? (
        <p className="mt-1 text-body-sm text-muted-foreground">
          {row.submission_count} submitted · {row.recipient_count} recipients
        </p>
      ) : null}
    </li>
  );
}

/**
 * `/coach/assignments` — every assignment visible under the coach
 * historical read rule, grouped Draft/Published/Archived. Submission
 * counts are explicit ("N submitted / M recipients") — never a fabricated
 * completion percentage. No student contact PII. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Coach Assignment List".
 */
export default async function CoachAssignmentsPage() {
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

  const result = await listCoachAssignments();
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  const rows = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h4 text-foreground">Assignments</h1>
        <Link
          href="/coach/assignments/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          New Assignment
        </Link>
      </div>

      {rows.length === 0 ? (
        <CoachPortalState code="NO_ASSIGNMENTS" />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((group) => {
            const groupRows = rows.filter((row) => row.status === group.status);
            if (groupRows.length === 0) return null;
            return (
              <section key={group.status}>
                <h2 className="mb-3 text-body font-medium text-foreground">{group.heading}</h2>
                <ul className="flex flex-col gap-3">
                  {groupRows.map((row) => (
                    <AssignmentRow key={row.assignment_id} row={row} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
