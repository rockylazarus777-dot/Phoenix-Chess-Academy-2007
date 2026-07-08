"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignBatchCoach, unassignBatchCoach } from "@/lib/actions/admin/coaches";
import { listBatchesForSelectAction } from "@/lib/actions/admin/search";
import { batchCoachRoleValues } from "@/lib/validation/admin/coach";
import type { AssignedBatchRow } from "@/lib/queries/admin/coaches";
import type { BatchOption } from "@/lib/queries/admin/batches";
import { selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

export function CoachBatchAssignmentPanel({ coachId, assignedBatches }: { coachId: string; assignedBatches: AssignedBatchRow[] }) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState("");
  const [role, setRole] = useState<(typeof batchCoachRoleValues)[number]>("ASSISTANT");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const result = await listBatchesForSelectAction();
      if (result.ok) setBatches(result.data);
    });
  }, []);

  function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!batchId) {
      setNotice({ tone: "error", message: "Choose a batch." });
      return;
    }
    startTransition(async () => {
      const result = await assignBatchCoach({ batchId, coachId, role });
      setNotice(result.success ? { tone: "success", message: "Coach assigned." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  function handleUnassign(row: AssignedBatchRow) {
    startTransition(async () => {
      const result = await unassignBatchCoach({ batchCoachId: row.batch_coach_id, batchId: row.batch_id, coachId });
      setNotice(result.success ? { tone: "success", message: "Coach unassigned." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Assigned batches</h2>

      {assignedBatches.length === 0 ? (
        <p className="mt-2 text-body-sm text-muted-foreground">Not currently assigned to any batch.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {assignedBatches.map((row) => (
            <li key={row.batch_coach_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-body-sm">
              <span className="text-foreground">
                {row.batch_name} ({row.batch_code}) — {row.role}
              </span>
              <button type="button" onClick={() => handleUnassign(row)} disabled={pending} className="text-danger hover:underline">
                Unassign
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAssign} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assign-batch" className="text-body-sm font-medium text-foreground">
            Batch
          </label>
          <select id="assign-batch" className={selectClasses} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">Select a batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.batch_code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assign-role" className="text-body-sm font-medium text-foreground">
            Role
          </label>
          <select id="assign-role" className={selectClasses} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            {batchCoachRoleValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline" isLoading={pending} disabled={pending}>
          Assign
        </Button>
      </form>
    </div>
  );
}
