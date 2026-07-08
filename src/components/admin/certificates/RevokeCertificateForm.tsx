"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeCertificate } from "@/lib/actions/admin/certificates";
import { FormField, textareaClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

/**
 * "Revoke Certificate" — the only ISSUED -> REVOKED control. Requires a
 * non-empty, visible-labeled revocation reason (never clears
 * certificate_number/issued_on). Never reachable from DRAFT or REVOKED.
 * See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md, "Revoke Certificate
 * RPC".
 */
export function RevokeCertificateForm({ certificateId }: { certificateId: string }) {
  const [revocationReason, setRevocationReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!revocationReason.trim()) {
      setNotice("Enter a reason for revoking this certificate.");
      return;
    }
    startTransition(async () => {
      const result = await revokeCertificate({ certificateId, revocationReason });
      if (!result.success) {
        setNotice(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-danger/40 p-4">
      {notice ? <FormNotice tone="error" message={notice} /> : null}
      <FormField label="Revocation reason" name="revocationReason" required>
        <textarea
          id="revocationReason"
          className={textareaClasses}
          value={revocationReason}
          onChange={(e) => setRevocationReason(e.target.value)}
          maxLength={2000}
          required
        />
      </FormField>
      <div>
        <Button type="submit" variant="danger" isLoading={pending} disabled={pending}>
          Revoke Certificate
        </Button>
      </div>
    </form>
  );
}
