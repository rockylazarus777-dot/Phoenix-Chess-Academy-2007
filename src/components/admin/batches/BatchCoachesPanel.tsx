"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignBatchCoach, unassignBatchCoach } from "@/lib/actions/admin/coaches";
import { listCoachesForSelectAction } from "@/lib/actions/admin/search";
import { batchCoachRoleValues } from "@/lib/validation/admin/coach";
import type { BatchCoachAssignmentRow } from "@/lib/queries/admin/batches";
import type { CoachOption } from "@/lib/queries/admin/coaches";
import { selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

export function BatchCoachesPanel({ batchId, assignedCoaches }: { batchId: string; assignedCoaches: BatchCoachAssignmentRow[] }) {
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachId, setCoachId] = useState("");
  const [role, setRole] = useState<(typeof batchCoachRoleValues)[number]>("ASSISTANT");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const result = await listCoachesForSelectAction();
      if (result.ok) setCoaches(result.data);
    });
  }, []);

  function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!coachId) {
      setNotice({ tone: "error", message: "Choose a coach." });
      return;
    }
    startTransition(async () => {
      const result = await assignBatchCoach({ batchId, coachId, role });
      setNotice(result.success ? { tone: "success", message: "Coach assigned." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  function handleUnassign(row: BatchCoachAssignmentRow) {
    startTransition(async () => {
      const result = await unassignBatchCoach({ batchCoachId: row.batch_coach_id, batchId, coachId: row.coach_id });
      setNotice(result.success ? { tone: "success", message: "Coach unassigned." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Coaches</h2>

      {assignedCoaches.length === 0 ? (
        <p className="mt-2 text-body-sm text-muted-foreground">No coaches assigned yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {assignedCoaches.map((row) => (
            <li key={row.batch_coach_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-body-sm">
              <span className="text-foreground">
                {row.full_name} ({row.coach_code}) — {row.role}
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
          <label htmlFor="batch-coach" className="text-body-sm font-medium text-foreground">
            Coach
          </label>
          <select id="batch-coach" className={selectClasses} value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">Select a coach</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.full_name} ({coach.coach_code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="batch-coach-role" className="text-body-sm font-medium text-foreground">
            Role
          </label>
          <select id="batch-coach-role" className={selectClasses} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
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
