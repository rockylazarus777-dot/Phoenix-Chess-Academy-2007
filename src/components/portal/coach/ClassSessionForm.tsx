"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClassSession } from "@/lib/actions/coach/sessions";
import { trainingModeValues, type CreateClassSessionValues } from "@/lib/validation/classSession";

const inputClasses =
  "h-11 rounded-md border border-border-strong bg-surface px-3 text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const selectClasses = inputClasses;

export interface CoachBatchOption {
  id: string;
  name: string;
  batchCode: string;
}

/**
 * New-session form — a coach may only ever select a batch from the
 * `batches` array the Server Component parent already resolved via
 * `listCoachBatches()` (itself scoped by `batch_coaches`). Submitting a
 * `batchId` outside this list is still rejected server-side by
 * `createClassSession()` re-authorizing through `getAssignedBatch()` —
 * this select is a UX convenience, never the security boundary. No
 * `coachId`/`createdBy` field exists anywhere in this form; the server
 * always derives both. Location override and schedule-prefill are
 * deliberately not exposed in this Phase 14 form — see
 * docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Recurring Schedule
 * Prefill Decision".
 */
export function ClassSessionForm({ batches, initialBatchId }: { batches: CoachBatchOption[]; initialBatchId: string }) {
  const [values, setValues] = useState<CreateClassSessionValues>({
    batchId: initialBatchId,
    sessionDate: "",
    startTime: "16:00",
    endTime: "17:00",
    timezone: "Asia/Kolkata",
    trainingMode: "",
    locationId: "",
    topic: "",
    scheduleId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof CreateClassSessionValues>(key: K, value: CreateClassSessionValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createClassSession(values);
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.push(`/coach/sessions/${result.data?.id ?? ""}`);
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
        <label htmlFor="batchId" className="text-body-sm font-medium text-foreground">
          Assigned Batch <span className="text-danger">*</span>
        </label>
        <select id="batchId" className={selectClasses} value={values.batchId} onChange={(e) => set("batchId", e.target.value)} required>
          <option value="">Select a batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} ({batch.batchCode})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sessionDate" className="text-body-sm font-medium text-foreground">
            Session Date <span className="text-danger">*</span>
          </label>
          <input
            id="sessionDate"
            type="date"
            className={inputClasses}
            value={values.sessionDate}
            onChange={(e) => set("sessionDate", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startTime" className="text-body-sm font-medium text-foreground">
            Start Time <span className="text-danger">*</span>
          </label>
          <input
            id="startTime"
            type="time"
            className={inputClasses}
            value={values.startTime}
            onChange={(e) => set("startTime", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endTime" className="text-body-sm font-medium text-foreground">
            End Time <span className="text-danger">*</span>
          </label>
          <input
            id="endTime"
            type="time"
            className={inputClasses}
            value={values.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-body-sm font-medium text-foreground">
          Timezone <span className="text-danger">*</span>
        </label>
        <input id="timezone" className={inputClasses} value={values.timezone} onChange={(e) => set("timezone", e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="trainingMode" className="text-body-sm font-medium text-foreground">
            Training Mode
          </label>
          <select
            id="trainingMode"
            className={selectClasses}
            value={values.trainingMode}
            onChange={(e) => set("trainingMode", e.target.value as CreateClassSessionValues["trainingMode"])}
          >
            <option value="">Use batch default</option>
            {trainingModeValues.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="topic" className="text-body-sm font-medium text-foreground">
            Topic (optional)
          </label>
          <input id="topic" className={inputClasses} value={values.topic} onChange={(e) => set("topic", e.target.value)} maxLength={200} />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create Session"}
        </button>
      </div>
    </form>
  );
}
