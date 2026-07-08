import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface TournamentGalleryProps {
  images?: string[];
  tournamentName: string;
}

/** No above-the-fold priority loading here — gallery images always lazy-load. */
export function TournamentGallery({ images, tournamentName }: TournamentGalleryProps) {
  if (!images || images.length === 0) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Gallery" title="Tournament gallery" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((src, index) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-2xl border border-border">
              <Image
                src={src}
                alt={`${tournamentName} photo ${index + 1}`}
                fill
                loading="lazy"
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
