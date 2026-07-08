"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeClassSession, cancelClassSession } from "@/lib/actions/coach/sessions";

/**
 * The only two session-status actions that exist in Phase 14 —
 * "Mark Session Completed" and "Cancel Session," both SCHEDULED-only
 * transitions enforced server-side by `transition_class_session_status()`
 * (supabase/migrations/0020_attendance_rls.sql). No generic status
 * dropdown exists; the current status is never trusted from the browser
 * — the RPC re-reads it and conditions its UPDATE atomically on
 * `status = 'SCHEDULED'`. See
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Session Status
 * Transition Architecture".
 */
export function SessionStatusActions({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<{ success: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(sessionId);
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
          onClick={() => run(completeClassSession)}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border-strong px-4 text-body-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Mark Session Completed
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(cancelClassSession)}
          className="inline-flex h-10 items-center justify-center rounded-md border border-danger/50 px-4 text-body-sm font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Cancel Session
        </button>
      </div>
    </div>
  );
}
