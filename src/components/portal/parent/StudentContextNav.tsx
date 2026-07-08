"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getParentStudentContextNav } from "@/config/parentPortalNavigation";

/**
 * Contextual sub-navigation shown only while a parent is viewing one
 * linked student (Overview/Programs/Batches/Class Schedule) — never
 * shown in the global sidebar. See
 * docs/PARENT_PORTAL_ARCHITECTURE.md, "Linked Student Context
 * Navigation".
 */
export function StudentContextNav({ studentId, studentName }: { studentId: string; studentName: string }) {
  const pathname = usePathname();
  const items = getParentStudentContextNav(studentId);

  function isActive(href: string) {
    if (href === `/parent/students/${studentId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label={`${studentName} navigation`} className="flex flex-wrap gap-1 border-b border-border pb-2">
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
