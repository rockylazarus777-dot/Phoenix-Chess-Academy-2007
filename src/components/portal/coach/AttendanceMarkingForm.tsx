"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markSessionAttendance } from "@/lib/actions/coach/sessions";
import { attendanceStatusValues } from "@/lib/validation/classSession";
import type { CoachSessionAttendanceRow } from "@/lib/supabase/types";

type AttendanceValue = (typeof attendanceStatusValues)[number];

interface EntryState {
  status: AttendanceValue | "";
  notes: string;
}

function statusLabel(status: AttendanceValue): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * One form, one submission, covering every session-date-eligible student
 * (see `roster`, already resolved server-side by
 * `get_coach_session_attendance()` — never an academy-wide student
 * list). Only students the coach explicitly sets a status for are
 * included in the submitted payload; `mark_session_attendance()`
 * re-verifies eligibility and rejects the ENTIRE submission if any
 * student is unauthorized — no partial/mixed success is possible here.
 * Attendance controls are keyboard accessible (`fieldset`/`legend`,
 * labelled radio buttons) and never communicate status by color alone.
 * See docs/CLASS_SESSIONS_ATTENDANCE_ARCHITECTURE.md, "Attendance Form
 * Architecture".
 */
export function AttendanceMarkingForm({ sessionId, roster }: { sessionId: string; roster: CoachSessionAttendanceRow[] }) {
  const [entries, setEntries] = useState<Record<string, EntryState>>(() =>
    Object.fromEntries(
      roster.map((student) => [
        student.student_id,
        { status: (student.attendance_status as AttendanceValue | null) ?? "", notes: student.notes ?? "" },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(studentId: string, status: AttendanceValue) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
  }

  function setNotes(studentId: string, notes: string) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes } }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payloadEntries = Object.entries(entries)
      .filter(([, entry]) => entry.status !== "")
      .map(([studentId, entry]) => ({
        studentId,
        status: entry.status as AttendanceValue,
        notes: entry.notes.trim().length > 0 ? entry.notes.trim() : undefined,
      }));

    if (payloadEntries.length === 0) {
      setError("Mark at least one student before saving.");
      return;
    }

    startTransition(async () => {
      const result = await markSessionAttendance({ sessionId, entries: payloadEntries });
      if (!result.success) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 p-3 text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {roster.map((student) => {
          const entry = entries[student.student_id];
          return (
            <li key={student.student_id} className="rounded-lg border border-border p-4">
              <fieldset>
                <legend className="text-body font-medium text-foreground">
                  {student.full_name}
                  <span className="ml-2 text-body-sm font-normal text-muted-foreground">
                    {student.student_code}
                    {student.current_level ? ` · ${student.current_level}` : ""}
                  </span>
                </legend>

                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Attendance status for ${student.full_name}`}>
                  {attendanceStatusValues.map((status) => {
                    const inputId = `${student.student_id}-${status}`;
                    const checked = entry.status === status;
                    return (
                      <label
                        key={status}
                        htmlFor={inputId}
                        className={`inline-flex h-10 min-w-20 cursor-pointer items-center justify-center rounded-md border px-3 text-body-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-foreground"
                        }`}
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name={`status-${student.student_id}`}
                          className="sr-only"
                          checked={checked}
                          onChange={() => setStatus(student.student_id, status)}
                        />
                        {statusLabel(status)}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-col gap-1.5">
                  <label htmlFor={`${student.student_id}-notes`} className="text-xs text-muted-foreground">
                    Note (optional) — use a short attendance-related note only
                  </label>
                  <textarea
                    id={`${student.student_id}-notes`}
                    className="min-h-16 rounded-md border border-border-strong bg-surface px-3 py-2 text-body-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    maxLength={500}
                    value={entry.notes}
                    onChange={(e) => setNotes(student.student_id, e.target.value)}
                  />
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-body-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </form>
  );
}
