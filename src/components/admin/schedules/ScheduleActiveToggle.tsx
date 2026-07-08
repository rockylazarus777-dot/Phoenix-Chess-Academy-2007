"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setScheduleActive } from "@/lib/actions/admin/schedules";

export function ScheduleActiveToggle({ scheduleId, batchId, active }: { scheduleId: string; batchId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setScheduleActive(scheduleId, !active, batchId);
          router.refresh();
        })
      }
      className="text-body-sm text-primary-text hover:underline disabled:opacity-50"
    >
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}
