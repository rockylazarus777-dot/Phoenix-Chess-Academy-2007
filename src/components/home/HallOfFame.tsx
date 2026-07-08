import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getFeaturedChampions, getChampions } from "@/content/champions";

/**
 * A distinct, prestigious presentation for confirmed champions — gold
 * typography accents, no trophy/crown emoji, no confetti. Per spec, this
 * section hides entirely on the production-facing page when there is no
 * real champion data, rather than showing fabricated names. Sourced from
 * src/content/champions.ts — the same authoritative source as /champions.
 */
export function HallOfFame() {
  const featured = getFeaturedChampions();
  const champions = (featured.length > 0 ? featured : getChampions()).slice(0, 4);

  if (champions.length === 0) return null;

  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Hall of Fame" title="Phoenix Champions" align="center" className="mx-auto" />
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {champions.map((champion) => (
            <div key={champion.id} className="text-center">
              <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-full border-2 border-primary/40">
                <Image src={champion.photo} alt={champion.photoAlt} fill sizes="160px" className="object-cover" />
              </div>
              <p className="text-h4 text-foreground mt-5">{champion.name}</p>
              <p className="text-caption text-primary-text mt-1">
                {[champion.title, champion.year].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
