"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment } from "@/lib/actions/coach/assignments";
import type { assignmentAudienceValues } from "@/lib/validation/assignments";
import type { CoachRosterStudentRow } from "@/lib/supabase/types";
import type { CoachSessionListRow } from "@/lib/queries/coach/sessions";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const selectClasses = inputClasses;
const textareaClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type AudienceType = (typeof assignmentAudienceValues)[number];

export interface AssignmentBatchContext {
  id: string;
  name: string;
  batchCode: string;
  programId: string | null;
  programName: string;
}

/**
 * New-assignment form for one already-authorized assigned batch. The
 * batch and program are fixed display context (never editable here) —
 * mirrors `ProgressEvaluationForm` (Phase 15). `roster` and `sessions` are
 * both resolved by the Server Component parent for THIS batch only
 * (`getCoachBatchRoster(batchId)` / `listCoachBatchSessions(batchId)`) —
 * never an academy-wide student or session list. Submitting a
 * `studentId`/`sessionId` outside these scoped options is still rejected
 * server-side by `createAssignment()` re-authorizing through
 * `getAuthorizedBatchStudent()` and `create_assignment()`'s own session
 * check — these selects are a UX convenience, never the security
 * boundary. No `coachId`/`createdBy` field exists anywhere in this form.
 * See docs/ASSIGNMENTS_ARCHITECTURE.md, "New Assignment Page".
 */
export function AssignmentForm({
  batch,
  roster,
  sessions,
  initialStudentId,
}: {
  batch: AssignmentBatchContext;
  roster: CoachRosterStudentRow[];
  sessions: CoachSessionListRow[];
  initialStudentId: string;
}) {
  const [audienceType, setAudienceType] = useState<AudienceType>("BATCH");
  const [studentId, setStudentId] = useState(initialStudentId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (audienceType === "STUDENT" && !studentId) {
      setError("Select a student for a direct student assignment.");
      return;
    }

    startTransition(async () => {
      const result = await createAssignment({
        batchId: batch.id,
        audienceType,
        studentId: audienceType === "STUDENT" ? studentId : "",
        programId: batch.programId ?? "",
        sessionId,
        title,
        description,
        instructions,
        dueAt,
        allowLateSubmission,
      });
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.push(`/coach/assignments/${result.data?.id ?? ""}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-surface p-3 text-body-sm text-muted-foreground">
        Batch: <span className="font-medium text-foreground">{batch.name}</span> ({batch.batchCode}) · Program:{" "}
        <span className="font-medium text-foreground">{batch.programName}</span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm font-medium text-foreground">
          Audience <span className="text-danger">*</span>
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <label className="inline-flex items-center gap-2 text-body-sm text-foreground">
            <input
              type="radio"
              name="audienceType"
              value="BATCH"
              checked={audienceType === "BATCH"}
              onChange={() => {
                setAudienceType("BATCH");
                setStudentId("");
              }}
              className="h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            Whole batch
          </label>
          <label className="inline-flex items-center gap-2 text-body-sm text-foreground">
            <input
              type="radio"
              name="audienceType"
              value="STUDENT"
              checked={audienceType === "STUDENT"}
              onChange={() => setAudienceType("STUDENT")}
              className="h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            One student
          </label>
        </div>
      </fieldset>

      {audienceType === "STUDENT" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="studentId" className="text-body-sm font-medium text-foreground">
            Student <span className="text-danger">*</span>
          </label>
          <select id="studentId" className={selectClasses} value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">Select a student</option>
            {roster.map((student) => (
              <option key={student.student_id} value={student.student_id}>
                {student.full_name} ({student.student_code})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-body-sm font-medium text-foreground">
          Assignment Title <span className="text-danger">*</span>
        </label>
        <input id="title" className={inputClasses} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-body-sm font-medium text-foreground">
          Description <span className="text-danger">*</span>
        </label>
        <textarea
          id="description"
          className={`${textareaClasses} min-h-24`}
          maxLength={3000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-body-sm font-medium text-foreground">
          Instructions (optional)
        </label>
        <textarea
          id="instructions"
          className={`${textareaClasses} min-h-20`}
          maxLength={5000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sessionId" className="text-body-sm font-medium text-foreground">
            Class Session (optional)
          </label>
          <select id="sessionId" className={selectClasses} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">No linked session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.sessionDate} · {session.startTime}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dueAt" className="text-body-sm font-medium text-foreground">
          Due Date/Time (optional)
        </label>
        <input id="dueAt" type="datetime-local" className={inputClasses} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>

      <label className="inline-flex items-center gap-2 text-body-sm text-foreground">
        <input
          type="checkbox"
          checked={allowLateSubmission}
          onChange={(e) => setAllowLateSubmission(e.target.checked)}
          className="h-4 w-4 rounded border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        Allow late submission
      </label>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Assignment"}
        </button>
      </div>
    </form>
  );
}
