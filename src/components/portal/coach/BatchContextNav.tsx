"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCoachBatchContextNav } from "@/config/coachPortalNavigation";

/**
 * Contextual sub-navigation shown only while a coach is viewing one
 * assigned batch (Overview/Students/Class Schedule) — never shown in
 * the global sidebar. See docs/COACH_PORTAL_ARCHITECTURE.md, "Batch
 * Context Navigation".
 */
export function BatchContextNav({ batchId, batchName }: { batchId: string; batchName: string }) {
  const pathname = usePathname();
  const items = getCoachBatchContextNav(batchId);

  function isActive(href: string) {
    if (href === `/coach/batches/${batchId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label={`${batchName} navigation`} className="flex flex-wrap gap-1 border-b border-border pb-2">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-body-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              active ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-surface-elevated"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
