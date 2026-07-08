"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Client-only shell that toggles a stronger surface background once the
 * page has scrolled past the hero. Kept as a small, focused client
 * component so the rest of the navbar (logo, nav links) can stay
 * server-rendered where it doesn't need interactivity.
 */
export function HeaderScrollShell({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors duration-200",
        isScrolled
          ? "bg-background/95 backdrop-blur border-b border-border"
          : "bg-transparent border-b border-transparent",
      )}
    >
      {children}
    </header>
  );
}
