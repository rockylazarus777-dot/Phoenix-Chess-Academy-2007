"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCoach, updateCoach } from "@/lib/actions/admin/coaches";
import type { CreateCoachValues } from "@/lib/validation/admin/coach";
import { FormField, inputClasses, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

const EMPTY: CreateCoachValues = { fullName: "", email: "", phone: "", whatsapp: "", bio: "", specializations: "", joinedOn: "" };

export function CoachForm({ mode, coachId, initialValues }: { mode: "create" | "edit"; coachId?: string; initialValues?: CreateCoachValues }) {
  const [values, setValues] = useState<CreateCoachValues>(initialValues ?? EMPTY);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof CreateCoachValues>(key: K, value: CreateCoachValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = mode === "create" ? await createCoach(values) : await updateCoach(coachId as string, values);
      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }
      if (mode === "create" && result.data) {
        router.push(`/admin/coaches/${result.data.id}`);
        return;
      }
      setNotice({ tone: "success", message: "Coach record saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}

      <FormField label="Full name" name="fullName" required>
        <input id="fullName" className={inputClasses} value={values.fullName} onChange={(e) => set("fullName", e.target.value)} required maxLength={200} />
      </FormField>

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

      <FormField label="Specializations" name="specializations">
        <input id="specializations" className={inputClasses} placeholder="Comma-separated, e.g. Openings, Endgames" value={values.specializations} onChange={(e) => set("specializations", e.target.value)} />
      </FormField>

      <FormField label="Bio" name="bio">
        <textarea id="bio" className={textareaClasses} value={values.bio} onChange={(e) => set("bio", e.target.value)} maxLength={2000} />
      </FormField>

      <FormField label="Joined on" name="joinedOn">
        <input id="joinedOn" type="date" className={inputClasses} value={values.joinedOn} onChange={(e) => set("joinedOn", e.target.value)} />
      </FormField>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create coach" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
