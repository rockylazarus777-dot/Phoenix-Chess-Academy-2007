"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mediaQueryList = window.matchMedia(QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// Safe default while server-rendering / before hydration reconciles the
// real value: assume reduced motion so autoplaying media/animation never
// flashes before the true preference is known.
function getServerSnapshot() {
  return true;
}

/**
 * SSR-safe prefers-reduced-motion hook built on useSyncExternalStore —
 * avoids the "setState synchronously in an effect" anti-pattern entirely
 * (no effect needed) and has no hydration-mismatch risk, since
 * useSyncExternalStore is designed specifically for this external-source
 * sync case.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
