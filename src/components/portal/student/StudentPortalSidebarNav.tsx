"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDENT_NAV_ITEMS } from "@/config/studentPortalNavigation";

export function StudentPortalSidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Student portal navigation" className="flex flex-col gap-1">
      {STUDENT_NAV_ITEMS.map((item) => {
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
