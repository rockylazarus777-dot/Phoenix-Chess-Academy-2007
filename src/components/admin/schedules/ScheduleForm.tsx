"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchedule } from "@/lib/actions/admin/schedules";
import { listBatchesForSelectAction } from "@/lib/actions/admin/search";
import { weekdayValues, type CreateScheduleValues } from "@/lib/validation/admin/schedule";
import { FormField, inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { BatchOption } from "@/lib/queries/admin/batches";

export function ScheduleForm({ initialBatchId }: { initialBatchId?: string }) {
  const [values, setValues] = useState<CreateScheduleValues>({
    batchId: initialBatchId ?? "",
    dayOfWeek: "MONDAY",
    startTime: "16:00",
    endTime: "17:00",
    timezone: "Asia/Kolkata",
    effectiveFrom: "",
    effectiveUntil: "",
    active: true,
  });
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const result = await listBatchesForSelectAction();
      if (result.ok) setBatches(result.data);
    });
  }, []);

  function set<K extends keyof CreateScheduleValues>(key: K, value: CreateScheduleValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = await createSchedule(values);
      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }
      router.push("/admin/schedules");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <FormField label="Batch" name="batchId" required>
        <select id="batchId" className={selectClasses} value={values.batchId} onChange={(e) => set("batchId", e.target.value)} required>
          <option value="">Select a batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} ({batch.batch_code})
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Day of week" name="dayOfWeek" required>
          <select id="dayOfWeek" className={selectClasses} value={values.dayOfWeek} onChange={(e) => set("dayOfWeek", e.target.value as typeof values.dayOfWeek)}>
            {weekdayValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Start time" name="startTime" required>
          <input id="startTime" type="time" className={inputClasses} value={values.startTime} onChange={(e) => set("startTime", e.target.value)} required />
        </FormField>
        <FormField label="End time" name="endTime" required>
          <input id="endTime" type="time" className={inputClasses} value={values.endTime} onChange={(e) => set("endTime", e.target.value)} required />
        </FormField>
      </div>

      <FormField label="Timezone" name="timezone" required>
        <input id="timezone" className={inputClasses} value={values.timezone} onChange={(e) => set("timezone", e.target.value)} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Effective from" name="effectiveFrom">
          <input id="effectiveFrom" type="date" className={inputClasses} value={values.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} />
        </FormField>
        <FormField label="Effective until" name="effectiveUntil">
          <input id="effectiveUntil" type="date" className={inputClasses} value={values.effectiveUntil} onChange={(e) => set("effectiveUntil", e.target.value)} />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-body-sm text-foreground">
        <input type="checkbox" checked={values.active} onChange={(e) => set("active", e.target.checked)} /> Active
      </label>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          Create schedule
        </Button>
      </div>
    </form>
  );
}
