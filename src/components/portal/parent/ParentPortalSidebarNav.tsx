"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PARENT_NAV_ITEMS } from "@/config/parentPortalNavigation";

export function ParentPortalSidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/parent") return pathname === "/parent";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="Parent portal navigation" className="flex flex-col gap-1">
      {PARENT_NAV_ITEMS.map((item) => {
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
