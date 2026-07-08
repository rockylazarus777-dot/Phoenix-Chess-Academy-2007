"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueCertificate } from "@/lib/actions/admin/certificates";
import { FormField, inputClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Issue Certificate" — the only DRAFT -> ISSUED control. `issuedOn` is
 * always an explicit admin-selected date, never auto-inferred from
 * program completion/tournament date/achievement date/created_at.
 * `certificate_number` is never collected here — always generated
 * server-side inside `issue_student_certificate()`. See
 * docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Certificate Issue
 * Date".
 */
export function IssueCertificateForm({ certificateId }: { certificateId: string }) {
  const [issuedOn, setIssuedOn] = useState(today());
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await issueCertificate({ certificateId, issuedOn });
      if (!result.success) {
        setNotice(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      {notice ? <FormNotice tone="error" message={notice} /> : null}
      <FormField label="Issue date" name="issuedOn" required>
        <input
          id="issuedOn"
          type="date"
          className={inputClasses}
          value={issuedOn}
          max={today()}
          onChange={(e) => setIssuedOn(e.target.value)}
          required
        />
      </FormField>
      <Button type="submit" isLoading={pending} disabled={pending}>
        Issue Certificate
      </Button>
    </form>
  );
}
