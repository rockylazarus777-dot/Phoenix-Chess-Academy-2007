"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findAccountCandidatesAction } from "@/lib/actions/admin/search";
import { provisionStudentAccount, provisionParentAccount, provisionCoachAccount, deactivateAccount, reactivateAccount } from "@/lib/actions/admin/accounts";
import type { AccountLinkCandidate } from "@/lib/queries/admin/accounts";
import { inputClasses, selectClasses } from "@/components/admin/forms/FormField";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";

type RecordType = "student" | "parent" | "coach";

const PROVISION_ACTIONS: Record<RecordType, (id: string) => Promise<{ success: boolean; message?: string }>> = {
  student: provisionStudentAccount,
  parent: provisionParentAccount,
  coach: provisionCoachAccount,
};

export function AccountSearchPanel() {
  const [recordType, setRecordType] = useState<RecordType>("student");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountLinkCandidate[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runSearch(nextQuery: string, nextType: RecordType) {
    startTransition(async () => {
      if (nextQuery.trim().length === 0) {
        setResults([]);
        return;
      }
      const result = await findAccountCandidatesAction(nextType, nextQuery);
      setResults(result.ok ? result.data : []);
    });
  }

  function handleProvision(id: string) {
    startTransition(async () => {
      const result = await PROVISION_ACTIONS[recordType](id);
      setNotice(result.success ? { tone: "success", message: result.message ?? "Invitation sent." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) {
        runSearch(query, recordType);
        router.refresh();
      }
    });
  }

  function handleDeactivate(profileId: string) {
    startTransition(async () => {
      const result = await deactivateAccount(profileId);
      setNotice(result.success ? { tone: "success", message: "Account deactivated." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) {
        runSearch(query, recordType);
        router.refresh();
      }
    });
  }

  function handleReactivate(profileId: string) {
    startTransition(async () => {
      const result = await reactivateAccount(profileId);
      setNotice(result.success ? { tone: "success", message: "Account reactivated." } : { tone: "error", message: result.message ?? "Something went wrong." });
      if (result.success) {
        runSearch(query, recordType);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="text-body font-medium text-foreground">Provision or manage a portal account</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        Role is derived automatically from the record type — students become STUDENT, parents PARENT, coaches COACH. This never assigns STAFF, ADMIN, or SUPER_ADMIN.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="record-type" className="text-body-sm font-medium text-foreground">
            Record type
          </label>
          <select
            id="record-type"
            className={selectClasses}
            value={recordType}
            onChange={(e) => {
              const next = e.target.value as RecordType;
              setRecordType(next);
              setResults([]);
              runSearch(query, next);
            }}
          >
            <option value="student">Student</option>
            <option value="parent">Parent</option>
            <option value="coach">Coach</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="account-search" className="text-body-sm font-medium text-foreground">
            Search
          </label>
          <input
            id="account-search"
            className={`${inputClasses} w-72`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              runSearch(e.target.value, recordType);
            }}
          />
        </div>
      </div>

      {notice ? <div className="mt-3"><FormNotice tone={notice.tone} message={notice.message} /></div> : null}

      {results.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {results.map((candidate) => (
            <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-body-sm">
              <div>
                <p className="text-foreground">
                  {candidate.full_name} <span className="text-muted-foreground">({candidate.code})</span>
                </p>
                <p className="text-muted-foreground">{candidate.email ?? "No email on file"}</p>
              </div>
              <div>
                {!candidate.profile_id ? (
                  <Button type="button" size="sm" variant="outline" disabled={pending || !candidate.email} isLoading={pending} onClick={() => handleProvision(candidate.id)}>
                    Invite account
                  </Button>
                ) : candidate.profile_active ? (
                  <Button type="button" size="sm" variant="outline" disabled={pending} isLoading={pending} onClick={() => handleDeactivate(candidate.profile_id as string)}>
                    Deactivate
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={pending} isLoading={pending} onClick={() => handleReactivate(candidate.profile_id as string)}>
                    Reactivate
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : query.trim().length > 0 ? (
        <p className="mt-4 text-body-sm text-muted-foreground">No matches.</p>
      ) : null}
    </div>
  );
}
