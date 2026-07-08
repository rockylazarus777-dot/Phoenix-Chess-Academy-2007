import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCurrentCoach } from "@/lib/coach/getCurrentCoach";
import { getAssignedBatch } from "@/lib/coach/authorization";
import { getCoachBatchRoster } from "@/lib/queries/coach/roster";
import { CoachPortalState } from "@/components/portal/coach/CoachPortalState";
import { CoachStatusBadge, rosterStudentStatusTone } from "@/components/portal/coach/CoachStatusBadge";
import { BatchContextNav } from "@/components/portal/coach/BatchContextNav";

export const metadata = buildMetadata({
  title: "Batch Students",
  description: "Student roster for a batch assigned to your Phoenix Chess Academy coach account.",
  path: "/coach/batches",
  index: false,
});

/**
 * `/coach/batches/[batchId]/students` — after `getAssignedBatch()`
 * authorization, the roster itself comes exclusively from the
 * `get_coach_batch_roster()` RPC (never a direct `.from("students")`
 * select) — see docs/COACH_PORTAL_ARCHITECTURE.md, "Students Table
 * Privacy Decision" and "Roster Dual-Path Decision". No DOB, address,
 * email, phone, WhatsApp, parent names/contact, chess association ID,
 * or payment information is ever present in this row shape.
 */
export default async function CoachBatchStudentsPage({ params }: { params: Promise<{ batchId: string }> }) {
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

  const { batchId } = await params;
  const assigned = await getAssignedBatch(identity.coach.id, batchId);

  if (!assigned.ok) {
    if (assigned.reason === "DATABASE_UNAVAILABLE") {
      return <CoachPortalState code="DATABASE_UNAVAILABLE" />;
    }
    notFound();
  }

  const batch = assigned.batch;
  const result = await getCoachBatchRoster(batch.id);
  if (!result.ok) {
    return <CoachPortalState code={result.code} />;
  }

  const roster = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h4 text-foreground">{batch.name} — Students</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">{batch.batchCode}</p>
      </div>

      <BatchContextNav batchId={batch.id} batchName={batch.name} />

      {roster.length === 0 ? (
        <CoachPortalState code="NO_STUDENTS" />
      ) : (
        <ul className="flex flex-col gap-3">
          {roster.map((student) => (
            <li key={student.student_id} className="rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body font-medium text-foreground">{student.full_name}</p>
                <CoachStatusBadge label={student.status} tone={rosterStudentStatusTone(student.status)} />
              </div>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {student.student_code}
                {student.current_level ? ` · ${student.current_level}` : ""}
                {student.fide_id ? ` · FIDE ID ${student.fide_id}` : ""}
                {student.fide_rating != null ? ` · FIDE rating ${student.fide_rating}` : ""}
              </p>
              {student.assignment_status ? (
                <p className="mt-1 text-xs text-muted-foreground">Batch assignment status: {student.assignment_status}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
