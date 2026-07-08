"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCertificateDocumentAction } from "@/lib/actions/admin/certificateDocuments";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

/**
 * "Generate Certificate PDF" / "Regenerate Certificate PDF" — the only
 * UI entry point for Phase 18 PDF generation. `hasAvailableDocument`
 * decides the button label per "Admin Certificate Detail Page Updates".
 *
 * GENERATION IDEMPOTENCY: this button disables itself while pending as
 * the first line of defense against a double-click, but the actual
 * authoritative protection is the database's partial unique index (only
 * one GENERATING document per certificate) — a double submission still
 * safely resolves to a `GENERATION_IN_PROGRESS` message rather than two
 * concurrent generations. See "Generation Idempotency".
 */
export function GenerateCertificateDocumentButton({
  certificateId,
  hasAvailableDocument,
}: {
  certificateId: string;
  hasAvailableDocument: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setNotice(null);
    startTransition(async () => {
      const result = await generateCertificateDocumentAction(certificateId);
      if (!result.success) {
        setNotice(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {notice ? <FormNotice tone="error" message={notice} /> : null}
      <Button type="button" onClick={handleClick} isLoading={pending} disabled={pending} variant={hasAvailableDocument ? "secondary" : "primary"}>
        {pending ? "Generating…" : hasAvailableDocument ? "Regenerate Certificate PDF" : "Generate Certificate PDF"}
      </Button>
    </div>
  );
}
