"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PARENT_NAV_ITEMS } from "@/config/parentPortalNavigation";

/**
 * Accessible mobile drawer for the parent portal — same contract as
 * `src/components/portal/student/StudentPortalMobileNav.tsx`
 * (aria-expanded/aria-controls on the trigger, focus moves to the first
 * link on open, Escape closes and restores focus to the trigger, body
 * scroll lock while open). Duplicated rather than extracted into a
 * shared primitive — see docs/PARENT_PORTAL_ARCHITECTURE.md, "Parent
 * Mobile Navigation" for why a risky refactor of the already-shipped,
 * validated Student Portal drawer was not worth the small amount of code
 * reuse for Phase 12.
 */
export function ParentPortalMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) {
      firstLinkRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function isActive(href: string) {
    if (href === "/parent") return pathname === "/parent";
    return pathname.startsWith(href);
  }

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="parent-portal-mobile-drawer"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="sr-only">Open portal menu</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" role="presentation">
          <button type="button" aria-label="Close portal menu" onClick={close} className="absolute inset-0 bg-black/60" />
          <div
            id="parent-portal-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Parent portal navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface border-r border-border-strong p-4 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-body-sm font-medium text-muted-foreground">Parent Portal</span>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="sr-only">Close portal menu</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label="Parent portal navigation" className="flex flex-col gap-1">
              {PARENT_NAV_ITEMS.map((item, index) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={index === 0 ? firstLinkRef : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={close}
                    className={`rounded-md px-3 py-2 text-body-sm min-h-11 flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      active ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-surface-elevated"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
