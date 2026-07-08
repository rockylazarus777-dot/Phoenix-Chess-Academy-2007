"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { primaryNavigation, isNavGroup } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * Desktop primary navigation with accessible dropdowns.
 *
 * - Dropdowns open on hover AND on click/keyboard (Enter/Space) so they
 *   work for mouse, touch, and keyboard users alike.
 * - Escape closes the open dropdown and returns focus to its trigger.
 * - Focus leaving the group (via Tab) closes the dropdown naturally.
 */
export function DesktopNav() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function closeGroup(label: string) {
    setOpenGroup((current) => (current === label ? null : current));
    triggerRefs.current[label]?.focus();
  }

  return (
    <nav aria-label="Primary" className="hidden lg:flex lg:items-center lg:gap-1">
      {primaryNavigation.map((entry) => {
        if (!isNavGroup(entry)) {
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="text-nav text-foreground/90 rounded-sm px-3 py-2 hover:text-primary-text transition-colors"
            >
              {entry.label}
            </Link>
          );
        }

        const isOpen = openGroup === entry.label;

        return (
          <div
            key={entry.label}
            className="relative"
            onMouseEnter={() => setOpenGroup(entry.label)}
            onMouseLeave={() => setOpenGroup((current) => (current === entry.label ? null : current))}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setOpenGroup((current) => (current === entry.label ? null : current));
              }
            }}
          >
            <button
              type="button"
              ref={(node) => {
                triggerRefs.current[entry.label] = node;
              }}
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => setOpenGroup((current) => (current === entry.label ? null : entry.label))}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeGroup(entry.label);
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpenGroup(entry.label);
                }
              }}
              className="text-nav text-foreground/90 rounded-sm px-3 py-2 hover:text-primary-text transition-colors inline-flex items-center gap-1"
            >
              {entry.label}
              <svg
                aria-hidden
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className={cn("transition-transform", isOpen && "rotate-180")}
              >
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </button>

            {isOpen ? (
              <div
                role="menu"
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeGroup(entry.label);
                }}
                className="absolute left-0 top-full pt-2 w-64 z-50"
              >
                <div className="rounded-2xl border border-border bg-surface-elevated shadow-xl py-2">
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className="block px-4 py-2.5 text-body-sm text-foreground/90 hover:bg-surface hover:text-primary-text transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
