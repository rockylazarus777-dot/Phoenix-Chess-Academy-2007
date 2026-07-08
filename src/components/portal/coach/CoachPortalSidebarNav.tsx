"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COACH_NAV_ITEMS } from "@/config/coachPortalNavigation";

export function CoachPortalSidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/coach") return pathname === "/coach";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Coach portal navigation" className="flex flex-col gap-1">
      {COACH_NAV_ITEMS.map((item) => {
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
