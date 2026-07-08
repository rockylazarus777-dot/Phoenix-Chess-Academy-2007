"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishAchievement, archiveAchievement } from "@/lib/actions/admin/achievements";
import { FormNotice } from "@/components/admin/forms/FormNotice";
import { Button } from "@/components/ui/Button";
import type { AchievementStatus } from "@/lib/supabase/types";

/**
 * DRAFT -> "Publish Achievement" (never auto-creates a certificate).
 * DRAFT|PUBLISHED -> "Archive Achievement" (never reverts). ARCHIVED is
 * read-only — no controls render. Every control is a labeled button, never
 * icon-only. See docs/CERTIFICATES_ACHIEVEMENTS_ARCHITECTURE.md,
 * "Publish Achievement RPC" and "Archive Achievement RPC".
 */
export function AchievementLifecycleControls({ achievementId, status }: { achievementId: string; status: AchievementStatus }) {
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runAction(action: (id: string) => Promise<{ success: boolean; message?: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action(achievementId);
      if (!result.success) {
        setNotice(result.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  if (status === "ARCHIVED") return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {notice ? <FormNotice tone="error" message={notice} /> : null}
      {status === "DRAFT" ? (
        <Button type="button" isLoading={pending} disabled={pending} onClick={() => runAction(publishAchievement)}>
          Publish Achievement
        </Button>
      ) : null}
      <Button type="button" variant="outline" isLoading={pending} disabled={pending} onClick={() => runAction(archiveAchievement)}>
        Archive Achievement
      </Button>
    </div>
  );
}
