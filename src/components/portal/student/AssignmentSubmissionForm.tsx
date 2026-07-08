"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAssignment } from "@/lib/actions/student/assignments";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const textareaClasses =
  "min-h-28 rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Student submission form — text and/or a chess-study/reference link, never
 * a file upload (Phase 16 intentionally has none). `isResubmission` only
 * ever renders true when the assignment's current status is
 * REVISION_REQUESTED (the parent page decides this, mirroring `submit_
 * assignment()`'s own resubmission rule) — the button label reflects that
 * ("Resubmit Assignment" vs "Submit Assignment"). No provider claim
 * (Chess.com/Lichess) is made anywhere in this form's copy. See
 * docs/ASSIGNMENTS_ARCHITECTURE.md, "Submit Assignment RPC" and "Chess
 * Platform URL Decision".
 */
export function AssignmentSubmissionForm({
  assignmentId,
  initialText,
  initialUrl,
  isResubmission,
}: {
  assignmentId: string;
  initialText: string;
  initialUrl: string;
  isResubmission: boolean;
}) {
  const [submissionText, setSubmissionText] = useState(initialText);
  const [submissionUrl, setSubmissionUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (submissionText.trim().length === 0 && submissionUrl.trim().length === 0) {
      setError("Add submission text or a link before submitting.");
      return;
    }

    startTransition(async () => {
      const result = await submitAssignment({ assignmentId, submissionText, submissionUrl });
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
        <label htmlFor="submissionText" className="text-body-sm font-medium text-foreground">
          Your Response
        </label>
        <textarea
          id="submissionText"
          className={textareaClasses}
          maxLength={5000}
          value={submissionText}
          onChange={(e) => setSubmissionText(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="submissionUrl" className="text-body-sm font-medium text-foreground">
          Link (optional)
        </label>
        <input
          id="submissionUrl"
          type="url"
          className={inputClasses}
          placeholder="https://"
          value={submissionUrl}
          onChange={(e) => setSubmissionUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">You may include a chess study, game, or reference link.</p>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {pending ? "Submitting…" : isResubmission ? "Resubmit Assignment" : "Submit Assignment"}
        </button>
      </div>
    </form>
  );
}
