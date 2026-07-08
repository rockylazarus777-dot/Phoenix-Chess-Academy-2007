"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStudent, updateStudent } from "@/lib/actions/admin/students";
import type { CreateStudentValues } from "@/lib/validation/admin/student";
import { FormField, inputClasses, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

const EMPTY: CreateStudentValues = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  phone: "",
  whatsapp: "",
  country: "",
  state: "",
  city: "",
  address: "",
  fideId: "",
  fideRating: "",
  chessAssociationId: "",
  currentLevel: "",
  joinedOn: "",
  notes: "",
};

interface StudentFormProps {
  mode: "create" | "edit";
  studentId?: string;
  initialValues?: CreateStudentValues;
}

/**
 * Shared create/edit form for the student business record. Client-side
 * required-field checks here are UX only — createStudent/updateStudent
 * re-validate with the same Zod schema server-side, since a client
 * check can always be bypassed. Controlled fields (student_code,
 * status, profile_id) are not editable here — see
 * docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Admin Forms".
 */
export function StudentForm({ mode, studentId, initialValues }: StudentFormProps) {
  const [values, setValues] = useState<CreateStudentValues>(initialValues ?? EMPTY);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof CreateStudentValues>(key: K, value: CreateStudentValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result =
        mode === "create" ? await createStudent(values) : await updateStudent(studentId as string, values);

      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }

      if (mode === "create" && result.data) {
        router.push(`/admin/students/${result.data.id}`);
        return;
      }
      setNotice({ tone: "success", message: "Student record saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <FormField label="Full name" name="fullName" required>
        <input
          id="fullName"
          className={inputClasses}
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          required
          maxLength={200}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date of birth" name="dateOfBirth" required>
          <input
            id="dateOfBirth"
            type="date"
            className={inputClasses}
            value={values.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            required
          />
        </FormField>
        <FormField label="Gender" name="gender">
          <input id="gender" className={inputClasses} value={values.gender} onChange={(e) => set("gender", e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" name="email">
          <input id="email" type="email" className={inputClasses} value={values.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Phone" name="phone">
          <input id="phone" className={inputClasses} value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </FormField>
      </div>

      <FormField label="WhatsApp" name="whatsapp">
        <input id="whatsapp" className={inputClasses} value={values.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Country" name="country" required>
          <input id="country" className={inputClasses} value={values.country} onChange={(e) => set("country", e.target.value)} required />
        </FormField>
        <FormField label="State" name="state">
          <input id="state" className={inputClasses} value={values.state} onChange={(e) => set("state", e.target.value)} />
        </FormField>
        <FormField label="City" name="city">
          <input id="city" className={inputClasses} value={values.city} onChange={(e) => set("city", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Address" name="address">
        <textarea id="address" className={textareaClasses} value={values.address} onChange={(e) => set("address", e.target.value)} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="FIDE ID" name="fideId">
          <input id="fideId" className={inputClasses} value={values.fideId} onChange={(e) => set("fideId", e.target.value)} />
        </FormField>
        <FormField label="FIDE rating" name="fideRating">
          <input id="fideRating" inputMode="numeric" className={inputClasses} value={values.fideRating} onChange={(e) => set("fideRating", e.target.value)} />
        </FormField>
        <FormField label="Chess association ID" name="chessAssociationId">
          <input id="chessAssociationId" className={inputClasses} value={values.chessAssociationId} onChange={(e) => set("chessAssociationId", e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Current level" name="currentLevel">
          <input id="currentLevel" className={inputClasses} value={values.currentLevel} onChange={(e) => set("currentLevel", e.target.value)} />
        </FormField>
        <FormField label="Joined on" name="joinedOn">
          <input id="joinedOn" type="date" className={inputClasses} value={values.joinedOn} onChange={(e) => set("joinedOn", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Notes" name="notes">
        <textarea id="notes" className={textareaClasses} value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </FormField>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create student" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
