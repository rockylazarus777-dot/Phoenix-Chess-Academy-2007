"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeStudentStatus } from "@/lib/actions/admin/students";
import { studentStatusValues } from "@/lib/validation/admin/student";
import { selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { StudentStatus } from "@/lib/supabase/types";

export function StudentStatusControl({ studentId, currentStatus }: { studentId: string; currentStatus: StudentStatus }) {
  const [status, setStatus] = useState<StudentStatus>(currentStatus);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = await changeStudentStatus(studentId, { status });
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
        <select id="status" className={selectClasses} value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
          {studentStatusValues.map((value) => (
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
