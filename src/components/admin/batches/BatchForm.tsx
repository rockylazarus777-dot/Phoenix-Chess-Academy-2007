"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBatch, updateBatch } from "@/lib/actions/admin/batches";
import { listProgramsForSelectAction, listLocationsForSelectAction, listCoachesForSelectAction } from "@/lib/actions/admin/search";
import { trainingModeValues, type CreateBatchValues } from "@/lib/validation/admin/batch";
import { FormField, inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { ProgramRow, AcademyLocationRow } from "@/lib/supabase/types";
import type { CoachOption } from "@/lib/queries/admin/coaches";

const EMPTY: CreateBatchValues = {
  batchCode: "",
  name: "",
  programId: "",
  locationId: "",
  trainingMode: "OFFLINE",
  level: "",
  primaryCoachId: "",
  capacity: "",
  startDate: "",
  endDate: "",
};

export function BatchForm({ mode, batchId, initialValues }: { mode: "create" | "edit"; batchId?: string; initialValues?: CreateBatchValues }) {
  const [values, setValues] = useState<CreateBatchValues>(initialValues ?? EMPTY);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [locations, setLocations] = useState<AcademyLocationRow[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    startTransition(async () => {
      const [programResult, locationResult, coachResult] = await Promise.all([
        listProgramsForSelectAction(),
        listLocationsForSelectAction(),
        listCoachesForSelectAction(),
      ]);
      if (programResult.ok) setPrograms(programResult.data);
      if (locationResult.ok) setLocations(locationResult.data);
      if (coachResult.ok) setCoaches(coachResult.data);
    });
  }, []);

  function set<K extends keyof CreateBatchValues>(key: K, value: CreateBatchValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = mode === "create" ? await createBatch(values) : await updateBatch(batchId as string, values);
      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }
      if (mode === "create" && result.data) {
        router.push(`/admin/batches/${result.data.id}`);
        return;
      }
      setNotice({ tone: "success", message: "Batch saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Batch code" name="batchCode" required>
          <input id="batchCode" className={inputClasses} value={values.batchCode} onChange={(e) => set("batchCode", e.target.value)} required disabled={mode === "edit"} maxLength={50} />
        </FormField>
        <FormField label="Name" name="name" required>
          <input id="name" className={inputClasses} value={values.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Program" name="programId" required>
          <select id="programId" className={selectClasses} value={values.programId} onChange={(e) => set("programId", e.target.value)} required>
            <option value="">Select a program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Location" name="locationId">
          <select id="locationId" className={selectClasses} value={values.locationId} onChange={(e) => set("locationId", e.target.value)}>
            <option value="">No fixed location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Training mode" name="trainingMode" required>
          <select id="trainingMode" className={selectClasses} value={values.trainingMode} onChange={(e) => set("trainingMode", e.target.value as typeof values.trainingMode)}>
            {trainingModeValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Level" name="level">
          <input id="level" className={inputClasses} value={values.level} onChange={(e) => set("level", e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Primary coach" name="primaryCoachId">
          <select id="primaryCoachId" className={selectClasses} value={values.primaryCoachId} onChange={(e) => set("primaryCoachId", e.target.value)}>
            <option value="">Unassigned</option>
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.full_name} ({coach.coach_code})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Capacity" name="capacity">
          <input id="capacity" inputMode="numeric" className={inputClasses} value={values.capacity} onChange={(e) => set("capacity", e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Start date" name="startDate">
          <input id="startDate" type="date" className={inputClasses} value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </FormField>
        <FormField label="End date" name="endDate">
          <input id="endDate" type="date" className={inputClasses} value={values.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </FormField>
      </div>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create batch" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
