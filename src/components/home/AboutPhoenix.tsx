import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { aboutPreview } from "@/content/home";

/**
 * Editorial About Phoenix section. Copy lives in src/content/home.ts
 * (`aboutPreview`) rather than hardcoded here, so it stays in sync with
 * any future content updates in one place. Does not invent founding
 * year, founder story, or locations — those get added once the academy
 * confirms them.
 */
export function AboutPhoenix() {
  return (
    <Section surface>
      <Container className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border shadow-sm">
          <Image
            src="/images/home/about/about-phoenix.webp"
            alt="Students training at Phoenix Chess Academy"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div>
          <p className="text-caption text-primary-text mb-3">{aboutPreview.eyebrow}</p>
          <h2 className="text-h2 text-foreground">{aboutPreview.heading}</h2>
          <p className="text-body-lg text-muted-foreground mt-5">{aboutPreview.body}</p>
          <div className="mt-8">
            <Button href="/about" variant="outline" size="md">
              About Phoenix
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
