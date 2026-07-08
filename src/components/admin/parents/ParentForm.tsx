"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createParent, updateParent } from "@/lib/actions/admin/parents";
import type { CreateParentValues } from "@/lib/validation/admin/parent";
import { FormField, inputClasses, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

const EMPTY: CreateParentValues = { fullName: "", email: "", phone: "", whatsapp: "", country: "", state: "", city: "", notes: "" };

export function ParentForm({ mode, parentId, initialValues }: { mode: "create" | "edit"; parentId?: string; initialValues?: CreateParentValues }) {
  const [values, setValues] = useState<CreateParentValues>(initialValues ?? EMPTY);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof CreateParentValues>(key: K, value: CreateParentValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      const result = mode === "create" ? await createParent(values) : await updateParent(parentId as string, values);
      if (!result.success) {
        setNotice({ tone: "error", message: result.message ?? "Something went wrong." });
        return;
      }
      if (mode === "create" && result.data) {
        router.push(`/admin/parents/${result.data.id}`);
        return;
      }
      setNotice({ tone: "success", message: "Parent record saved." });
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
        <FormField label="Phone" name="phone" required>
          <input id="phone" className={inputClasses} value={values.phone} onChange={(e) => set("phone", e.target.value)} required />
        </FormField>
        <FormField label="Email" name="email">
          <input id="email" type="email" className={inputClasses} value={values.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
      </div>

      <FormField label="WhatsApp" name="whatsapp">
        <input id="whatsapp" className={inputClasses} value={values.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Country" name="country">
          <input id="country" className={inputClasses} value={values.country} onChange={(e) => set("country", e.target.value)} />
        </FormField>
        <FormField label="State" name="state">
          <input id="state" className={inputClasses} value={values.state} onChange={(e) => set("state", e.target.value)} />
        </FormField>
        <FormField label="City" name="city">
          <input id="city" className={inputClasses} value={values.city} onChange={(e) => set("city", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Notes" name="notes">
        <textarea id="notes" className={textareaClasses} value={values.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </FormField>

      <div>
        <Button type="submit" isLoading={pending} disabled={pending}>
          {mode === "create" ? "Create parent" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
