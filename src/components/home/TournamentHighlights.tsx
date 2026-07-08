import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { getGalleryItemsByCategory } from "@/content/gallery";

/**
 * No real tournament photography has been supplied yet. Renders a CTA-only
 * state until src/content/gallery.ts has TOURNAMENT-category entries —
 * capped at 6 on the home page either way (full galleries live on
 * /gallery), matching the performance requirement of not loading a large
 * masonry grid here. Sourced from the TOURNAMENT category of the same
 * authoritative gallery used by /gallery, rather than a separate,
 * differently-shaped image list.
 */
export function TournamentHighlights() {
  const images = getGalleryItemsByCategory("TOURNAMENT").slice(0, 6);

  return (
    <Section>
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader eyebrow="Tournament Highlights" title="Moments from Phoenix tournaments" />
          <Button href="/gallery" variant="outline" size="md" className="shrink-0">
            View Gallery
          </Button>
        </div>

        {images.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((image) => (
              <div key={image.id} className="relative aspect-square overflow-hidden rounded-2xl border border-border">
                <Image
                  src={image.image}
                  alt={image.alt}
                  fill
                  sizes="(min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground mt-8">
            Tournament photography will appear here once real Phoenix images are added.
          </p>
        )}
      </Container>
    </Section>
  );
}
