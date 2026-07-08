"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { primaryNavigation, isNavGroup } from "@/config/navigation";
import { ctaNavigation } from "@/config/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils/cn";

/**
 * Mobile navigation panel.
 *
 * - Full-screen overlay, not a squeezed-in version of the desktop mega menu.
 * - Nested groups expand in place (accordion) rather than opening a
 *   secondary menu layer.
 * - Body scroll is locked while open and restored on close.
 * - Escape closes the menu; focus is trapped inside while open and
 *   returned to the trigger button on close.
 */
export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="lg:hidden">
      <IconButton
        ref={triggerRef}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-panel"
        onClick={() => setIsOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
          <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </IconButton>

      {isOpen ? (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className="fixed inset-0 z-100 bg-background flex flex-col"
        >
          <div className="flex items-center justify-between px-4 h-16 border-b border-border">
            <Logo href="/" height={28} />
            <IconButton aria-label="Close menu" onClick={close}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <nav aria-label="Mobile primary" className="flex-1 overflow-y-auto px-2 py-4">
            <ul className="flex flex-col">
              {primaryNavigation.map((entry) => {
                if (!isNavGroup(entry)) {
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        onClick={close}
                        className="block px-4 py-3.5 text-body-lg text-foreground min-h-11"
                      >
                        {entry.label}
                      </Link>
                    </li>
                  );
                }

                const isExpanded = expandedGroup === entry.label;

                return (
                  <li key={entry.label} className="border-b border-border/60 last:border-none">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedGroup((current) => (current === entry.label ? null : entry.label))}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-body-lg text-foreground min-h-11"
                    >
                      {entry.label}
                      <svg
                        aria-hidden
                        width="12"
                        height="12"
                        viewBox="0 0 10 10"
                        className={cn("transition-transform", isExpanded && "rotate-180")}
                      >
                        <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                      </svg>
                    </button>
                    {isExpanded ? (
                      <ul className="pb-2">
                        {entry.items.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={close}
                              className="block px-8 py-3 text-body text-muted-foreground min-h-11"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-border p-4 flex flex-col gap-3">
            <Button href="/book-trial" variant="primary" size="lg" className="w-full" onClick={close}>
              {ctaNavigation.primary.label}
            </Button>
            <Button href="/login" variant="outline" size="lg" className="w-full" onClick={close}>
              {ctaNavigation.login.label}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
