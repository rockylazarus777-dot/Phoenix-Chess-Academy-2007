"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchStudentsAction } from "@/lib/actions/admin/search";
import { linkParentToStudent, unlinkParentFromStudent } from "@/lib/actions/admin/parents";
import { parentRelationshipValues } from "@/lib/validation/admin/parent";
import type { StudentOption } from "@/lib/queries/admin/students";
import type { LinkedStudentRow } from "@/lib/queries/admin/parents";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

/** Mirror of LinkParentPanel, from the parent's side of the same many-to-many relationship. */
export function LinkStudentPanel({ parentId, linkedStudents }: { parentId: string; linkedStudents: LinkedStudentRow[] }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [relationship, setRelationship] = useState<(typeof parentRelationshipValues)[number]>("GUARDIAN");
  const [isPrimary, setIsPrimary] = useState(false);
  const [canReceiveUpdates, setCanReceiveUpdates] = useState(true);
  const [canManageStudent, setCanManageStudent] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSearch(value: string) {
    setQuery(value);
    startTransition(async () => {
      if (value.trim().length === 0) {
        setOptions([]);
        return;
      }
      const result = await searchStudentsAction(value);
      setOptions(result.ok ? result.data : []);
    });
  }

  function handleLink(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedStudentId) {
      setNotice({ tone: "error", message: "Search for and select a student first." });
      return;
    }
    startTransition(async () => {
      const response = await linkParentToStudent({
        studentId: selectedStudentId,
        parentId,
        relationship,
        isPrimary,
        canReceiveUpdates,
        canManageStudent,
      });
      setNotice(response.success ? { tone: "success", message: "Student linked." } : { tone: "error", message: response.message ?? "Something went wrong." });
      if (response.success) {
        setSelectedStudentId("");
        setQuery("");
        setOptions([]);
        router.refresh();
      }
    });
  }

  function handleUnlink(studentId: string) {
    startTransition(async () => {
      const response = await unlinkParentFromStudent({ studentId, parentId });
      setNotice(response.success ? { tone: "success", message: "Student unlinked." } : { tone: "error", message: response.message ?? "Something went wrong." });
      if (response.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Linked students</h2>

      {linkedStudents.length === 0 ? (
        <p className="mt-2 text-body-sm text-muted-foreground">No students linked yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {linkedStudents.map((student) => (
            <li key={student.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-body-sm">
              <div>
                <p className="text-foreground">
                  {student.full_name} <span className="text-muted-foreground">({student.student_code} · {student.relationship}{student.is_primary ? ", primary" : ""})</span>
                </p>
              </div>
              <button type="button" onClick={() => handleUnlink(student.student_id)} disabled={pending} className="text-danger hover:underline">
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleLink} className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
        {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="student-search" className="text-body-sm font-medium text-foreground">
            Find student (name or code)
          </label>
          <input id="student-search" className={inputClasses} value={query} onChange={(e) => handleSearch(e.target.value)} />
          {options.length > 0 ? (
            <ul className="rounded-md border border-border">
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(option.id);
                      setQuery(`${option.full_name} (${option.student_code})`);
                      setOptions([]);
                    }}
                    className={`w-full px-3 py-2 text-left text-body-sm hover:bg-surface-elevated ${selectedStudentId === option.id ? "bg-surface-elevated" : ""}`}
                  >
                    {option.full_name} — {option.student_code}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="relationship" className="text-body-sm font-medium text-foreground">
              Relationship
            </label>
            <select id="relationship" className={selectClasses} value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)}>
              {parentRelationshipValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 text-body-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> Primary contact
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={canReceiveUpdates} onChange={(e) => setCanReceiveUpdates(e.target.checked)} /> Can receive updates
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={canManageStudent} onChange={(e) => setCanManageStudent(e.target.checked)} /> Can manage student
            </label>
          </div>
        </div>

        <div>
          <Button type="submit" size="sm" variant="outline" isLoading={pending} disabled={pending}>
            Link student
          </Button>
        </div>
      </form>
    </div>
  );
}
