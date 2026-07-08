"use client";

import { useState } from "react";
import Image from "next/image";

interface VideoFacadeProps {
  youtubeVideoId: string;
  title: string;
  thumbnail: string;
}

/**
 * Lightweight YouTube facade — renders only a thumbnail + play button
 * until the user actually clicks, so no YouTube iframe/script loads on
 * initial page render. Uses youtube-nocookie.com once activated.
 */
export function VideoFacade({ youtubeVideoId, title, thumbnail }: VideoFacadeProps) {
  const [isActive, setIsActive] = useState(false);

  if (isActive) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1`}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsActive(true)}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-border"
      aria-label={`Play video: ${title}`}
    >
      <Image src={thumbnail} alt="" fill sizes="(min-width: 1024px) 800px, 100vw" className="object-cover" />
      <div className="absolute inset-0 bg-background/40 transition-colors group-hover:bg-background/25" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:scale-105">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden>
            <path d="M6 4l12 7-12 7V4z" />
          </svg>
        </span>
      </span>
      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-5 text-left">
        <span className="text-body text-foreground">{title}</span>
      </span>
    </button>
  );
}
