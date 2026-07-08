"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { VideoFacade } from "@/components/home/VideoFacade";
import { videoCategoryLabels, getVideoThumbnail, type VideoCategory, type VideoItem } from "@/content/videos";

interface VideoGridClientProps {
  videos: VideoItem[];
  categories: VideoCategory[];
}

/**
 * Small client island combining category discovery + the video grid.
 * Each card renders the Phase 3 `VideoFacade` (itself a client
 * component) so no YouTube iframe exists in the initial HTML — an
 * iframe only mounts after a user clicks a specific video's play button.
 */
export function VideoGridClient({ videos, categories }: VideoGridClientProps) {
  const [activeCategory, setActiveCategory] = useState<VideoCategory | "ALL">("ALL");

  const filteredVideos = useMemo(
    () => (activeCategory === "ALL" ? videos : videos.filter((video) => video.category === activeCategory)),
    [videos, activeCategory],
  );

  return (
    <div>
      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter videos by category">
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-body-sm transition-colors",
              activeCategory === "ALL"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong text-foreground hover:border-primary hover:text-primary-text",
            )}
            aria-pressed={activeCategory === "ALL"}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-body-sm transition-colors",
                activeCategory === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong text-foreground hover:border-primary hover:text-primary-text",
              )}
              aria-pressed={activeCategory === category}
            >
              {videoCategoryLabels[category]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVideos.map((video) => (
          <div key={video.id}>
            <VideoFacade youtubeVideoId={video.youtubeVideoId} title={video.title} thumbnail={getVideoThumbnail(video)} />
            <p className="text-h4 text-foreground mt-3">{video.title}</p>
            <p className="text-body-sm text-muted-foreground mt-1">{video.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
