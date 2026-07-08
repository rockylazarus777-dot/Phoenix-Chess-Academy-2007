"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeCoachStatus } from "@/lib/actions/admin/coaches";
import { coachStatusValues } from "@/lib/validation/admin/coach";
import { selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { CoachStatus } from "@/lib/supabase/types";

export function CoachStatusControl({ coachId, currentStatus }: { coachId: string; currentStatus: CoachStatus }) {
  const [status, setStatus] = useState<CoachStatus>(currentStatus);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = await changeCoachStatus(coachId, status);
      setNotice(result.success ? "Status updated." : result.message ?? "Something went wrong.");
      if (result.success) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-body-sm font-medium text-foreground">
          Status
        </label>
        <select id="status" className={selectClasses} value={status} onChange={(e) => setStatus(e.target.value as CoachStatus)}>
          {coachStatusValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline" size="sm" isLoading={pending} disabled={pending || status === currentStatus}>
        Update status
      </Button>
      {notice ? <FormNotice tone={notice.includes("updated") ? "success" : "error"} message={notice} /> : null}
    </form>
  );
}
