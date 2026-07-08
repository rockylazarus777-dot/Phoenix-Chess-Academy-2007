"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveAssignment, publishAssignment } from "@/lib/actions/coach/assignments";

/**
 * "Publish Assignment" (DRAFT -> PUBLISHED, only shown when `canPublish` —
 * i.e. `coach_can_manage`, meaning DRAFT + author + current batch
 * assignment) and "Archive Assignment" (DRAFT|PUBLISHED -> ARCHIVED, shown
 * when `canArchive` — i.e. `coach_can_archive`). Unlike Phase 15's
 * evaluation "Archive Draft," an assignment may be archived from either
 * DRAFT or PUBLISHED (see docs/ASSIGNMENTS_ARCHITECTURE.md, "Archive
 * Assignment RPC") — existing recipients/submissions are preserved either
 * way; only new submissions are blocked going forward.
 */
export function AssignmentStatusActions({
  assignmentId,
  canPublish,
  canArchive,
}: {
  assignmentId: string;
  canPublish: boolean;
  canArchive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (id: string) => Promise<{ success: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(assignmentId);
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (!canPublish && !canArchive) return null;

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {canPublish ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(publishAssignment)}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Publish Assignment
          </button>
        ) : null}
        {canArchive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(archiveAssignment)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-danger/50 px-4 text-body-sm font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
          >
            Archive Assignment
          </button>
        ) : null}
      </div>
    </div>
  );
}
