"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { AdminActionResult } from "@/lib/admin/errors";

interface ProvisionAccountButtonProps {
  recordId: string;
  hasEmail: boolean;
  hasAccount: boolean;
  /** Server Action reference — provisionStudentAccount/provisionParentAccount/provisionCoachAccount, passed in by the caller so this component stays record-type-agnostic. */
  action: (recordId: string) => Promise<AdminActionResult>;
}

/** Shared "invite a portal account" control used on student/parent/coach detail pages. See src/lib/actions/admin/accounts.ts for the underlying invite-and-link flow and its reconciliation strategy. */
export function ProvisionAccountButton({ recordId, hasEmail, hasAccount, action }: ProvisionAccountButtonProps) {
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (hasAccount) {
    return <p className="text-body-sm text-success">Portal account linked.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {!hasEmail ? <p className="text-body-sm text-muted-foreground">Add an email address to invite a portal account.</p> : null}
      {notice ? <FormNotice tone={notice.tone} message={notice.message} /> : null}
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasEmail || pending}
          isLoading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action(recordId);
              setNotice(result.success ? { tone: "success", message: result.message ?? "Invitation sent." } : { tone: "error", message: result.message ?? "Something went wrong." });
              if (result.success) router.refresh();
            })
          }
        >
          Invite portal account
        </Button>
      </div>
    </div>
  );
}
