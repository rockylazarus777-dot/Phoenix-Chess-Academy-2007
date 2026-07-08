"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishProgressEvaluation, archiveProgressEvaluation } from "@/lib/actions/coach/progress";

/**
 * The only two evaluation-status actions that exist in Phase 15 —
 * "Publish Evaluation" (DRAFT -> PUBLISHED) and "Archive Draft" (DRAFT ->
 * ARCHIVED), both enforced server-side by
 * `publish_student_progress_evaluation()` /
 * `archive_student_progress_evaluation()`
 * (supabase/migrations/0022_student_progress_rls.sql). No generic status
 * dropdown exists. Archiving a PUBLISHED evaluation is never possible from
 * the Coach Portal — the RPC itself rejects it, and this component is only
 * ever rendered by the parent page when the evaluation is still DRAFT. See
 * docs/STUDENT_PROGRESS_ARCHITECTURE.md, "Publish Evaluation RPC" and
 * "Published Evaluation Immutability".
 */
export function EvaluationStatusActions({ evaluationId }: { evaluationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<{ success: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(evaluationId);
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(publishProgressEvaluation)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Publish Evaluation
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(archiveProgressEvaluation)}
          className="inline-flex h-10 items-center justify-center rounded-md border border-danger/50 px-4 text-body-sm font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Archive Draft
        </button>
      </div>
    </div>
  );
}
