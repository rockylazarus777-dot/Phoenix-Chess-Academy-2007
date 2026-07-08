"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { galleryCategoryLabels, type GalleryCategory, type GalleryItem } from "@/content/gallery";

interface GalleryClientProps {
  items: GalleryItem[];
  categories: GalleryCategory[];
}

/**
 * Small client island for the gallery grid + lightbox. The rest of
 * /gallery (hero, intro, empty state) stays a Server Component — only
 * the filterable grid and the modal preview need interactivity.
 *
 * Lightbox uses the native <dialog> element rather than a hand-rolled
 * modal or a third-party lightbox package: modal <dialog> gets a11y
 * behavior (Escape-to-close, inert background, focus containment)
 * largely for free from the browser, so this stays small and dependency
 * -free. Focus is still explicitly restored to the trigger on close
 * since that isn't guaranteed everywhere, and body scroll is explicitly
 * locked/unlocked since dialog doesn't always do this itself.
 */
export function GalleryClient({ items, categories }: GalleryClientProps) {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory | "ALL">("ALL");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const filteredItems = useMemo(
    () => (activeCategory === "ALL" ? items : items.filter((item) => item.category === activeCategory)),
    [items, activeCategory],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (openIndex !== null) {
      document.body.style.overflow = "hidden";
      if (!dialog.open) dialog.showModal();
    } else {
      document.body.style.overflow = "";
      if (dialog.open) dialog.close();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [openIndex]);

  function openLightbox(index: number, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setOpenIndex(index);
  }

  function closeLightbox() {
    setOpenIndex(null);
    // Restore focus to whatever card opened the lightbox, rather than
    // leaving focus on a now-hidden dialog.
    lastTriggerRef.current?.focus();
  }

  const activeItem = openIndex !== null ? filteredItems[openIndex] : null;

  return (
    <div>
      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
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
              {galleryCategoryLabels[category]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filteredItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={(event) => openLightbox(index, event.currentTarget)}
            className="group relative aspect-4/3 overflow-hidden rounded-2xl border border-border"
            aria-label={`View larger image: ${item.title}`}
          >
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              loading="lazy"
              className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={closeLightbox}
        onCancel={closeLightbox}
        aria-label={activeItem?.title ?? "Gallery image"}
        className="m-auto max-w-[90vw] rounded-2xl border border-border bg-surface p-0 backdrop:bg-background/80"
        onClick={(event) => {
          if (event.target === dialogRef.current) closeLightbox();
        }}
      >
        {activeItem ? (
          <div className="relative">
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground"
              aria-label="Close image preview"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <div className="relative aspect-4/3 max-h-[80vh] w-[90vw] max-w-3xl">
              <Image src={activeItem.image} alt={activeItem.alt} fill sizes="90vw" className="object-contain" />
            </div>
            {activeItem.description ? (
              <p className="text-body-sm text-muted-foreground p-4">{activeItem.description}</p>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
