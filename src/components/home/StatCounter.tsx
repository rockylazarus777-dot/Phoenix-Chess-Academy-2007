"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

interface StatCounterProps {
  value: number;
  suffix?: string;
  label: string;
}

/**
 * Animates a number counting up once it scrolls into view, then never
 * again. No animation library — IntersectionObserver + requestAnimationFrame.
 * Respects prefers-reduced-motion by rendering the final value immediately
 * (the observer effect below is skipped entirely in that case, so no
 * animation-only setState ever runs).
 */
export function StatCounter({ value, suffix = "", label }: StatCounterProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const node = elementRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;

        const durationMs = 1200;
        const startTime = performance.now();

        function tick(now: number) {
          const progress = Math.min((now - startTime) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, prefersReducedMotion]);

  const shownValue = prefersReducedMotion ? value : displayValue;

  return (
    <div ref={elementRef} className="text-center">
      <p className="text-display text-primary-text tabular-nums">
        {shownValue.toLocaleString()}
        {suffix}
      </p>
      <p className="text-caption text-muted-foreground mt-2">{label}</p>
    </div>
  );
}
