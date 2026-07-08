"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAssignment } from "@/lib/actions/coach/assignments";
import type { CoachSessionListRow } from "@/lib/queries/coach/sessions";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const selectClasses = inputClasses;
const textareaClasses =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Inline DRAFT-edit form rendered directly on
 * `/coach/assignments/[assignmentId]` — no separate `/edit` route (mirrors
 * `ProgressEvaluationEditForm`, Phase 15). `audienceType`/`batchId`/
 * `studentId` are deliberately absent — they can never be changed here; if
 * a coach chose the wrong audience, the documented path is Archive +
 * recreate. `programId` is fixed (the batch's own program) and resubmitted
 * unchanged on every save.
 */
export function AssignmentEditForm({
  assignmentId,
  programId,
  sessions,
  initialTitle,
  initialDescription,
  initialInstructions,
  initialSessionId,
  initialDueAt,
  initialAllowLateSubmission,
}: {
  assignmentId: string;
  programId: string | null;
  sessions: CoachSessionListRow[];
  initialTitle: string;
  initialDescription: string;
  initialInstructions: string;
  initialSessionId: string;
  initialDueAt: string;
  initialAllowLateSubmission: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [dueAt, setDueAt] = useState(initialDueAt);
  const [allowLateSubmission, setAllowLateSubmission] = useState(initialAllowLateSubmission);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateAssignment({
        assignmentId,
        programId: programId ?? "",
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
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-title" className="text-body-sm font-medium text-foreground">
          Assignment Title <span className="text-danger">*</span>
        </label>
        <input id="edit-title" className={inputClasses} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-description" className="text-body-sm font-medium text-foreground">
          Description <span className="text-danger">*</span>
        </label>
        <textarea
          id="edit-description"
          className={`${textareaClasses} min-h-24`}
          maxLength={3000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-instructions" className="text-body-sm font-medium text-foreground">
          Instructions (optional)
        </label>
        <textarea
          id="edit-instructions"
          className={`${textareaClasses} min-h-20`}
          maxLength={5000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {sessions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-sessionId" className="text-body-sm font-medium text-foreground">
            Class Session (optional)
          </label>
          <select id="edit-sessionId" className={selectClasses} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
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
        <label htmlFor="edit-dueAt" className="text-body-sm font-medium text-foreground">
          Due Date/Time (optional)
        </label>
        <input id="edit-dueAt" type="datetime-local" className={inputClasses} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
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
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
