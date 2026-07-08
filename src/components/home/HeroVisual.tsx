"use client";

import { useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/ui/Logo";

interface HeroVisualProps {
  src: string;
  alt: string;
}

/**
 * Hero's right-side visual. Attempts the real academy photo first; if it
 * hasn't been supplied yet (no file at `src`), falls back to a branded
 * medallion display using the real Phoenix logo on a navy panel — never a
 * fabricated student photo — so the right side of the hero is never left
 * empty either way. Mirrors HeroMedia's poster-fallback pattern.
 */
export function HeroVisual({ src, alt }: HeroVisualProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <div className="relative aspect-4/5 overflow-hidden rounded-2xl bg-accent shadow-xl">
        <div className="absolute inset-5 rounded-xl border border-primary/40" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <Logo href="" height={168} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-accent/70 via-transparent to-transparent" />
      </div>
    );
  }

  return (
    <div className="relative aspect-4/5 overflow-hidden rounded-2xl border border-border shadow-xl">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1024px) 45vw, 100vw"
        className="object-cover"
        onError={() => setImageFailed(true)}
      />
    </div>
  );
}
