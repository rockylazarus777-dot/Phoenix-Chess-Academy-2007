"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeEnrollmentStatus } from "@/lib/actions/admin/enrollments";
import { enrollmentStatusValues } from "@/lib/validation/admin/enrollment";
import { selectClasses } from "@/components/admin/forms/FormField";
import type { EnrollmentStatus } from "@/lib/supabase/types";

export function EnrollmentStatusSelect({ enrollmentId, studentId, currentStatus }: { enrollmentId: string; studentId: string; currentStatus: EnrollmentStatus }) {
  const [status, setStatus] = useState<EnrollmentStatus>(currentStatus);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      className={`${selectClasses} h-9 py-0`}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as EnrollmentStatus;
        setStatus(next);
        startTransition(async () => {
          await changeEnrollmentStatus(enrollmentId, next, studentId);
          router.refresh();
        });
      }}
    >
      {enrollmentStatusValues.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}
