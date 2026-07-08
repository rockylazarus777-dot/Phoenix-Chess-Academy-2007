import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import type { Program } from "@/content/programs";
import { getProgramHeroImage } from "@/content/programs";

interface ProgramHeroProps {
  program: Program;
  breadcrumbItems: BreadcrumbItem[];
}

/**
 * Reusable program detail hero — real Phoenix program photography, no
 * clipart/flame effects/animated logo. Training mode is only shown when
 * actually configured on the program (via `highlights`).
 */
export function ProgramHero({ program, breadcrumbItems }: ProgramHeroProps) {
  const trainingMode = program.highlights?.find((item) => item.label === "Training Mode")?.value;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10">
        <Image
          src={getProgramHeroImage(program)}
          alt=""
          fill
          priority
          sizes="100vw"
          style={program.imagePosition ? { objectPosition: program.imagePosition } : undefined}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
      </div>

      <Container className="py-16 lg:py-24">
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
          <p className="text-caption text-primary-text">{program.eyebrow}</p>
          <p className="text-caption text-muted-foreground">{program.levelLabel}</p>
          {trainingMode ? <p className="text-caption text-muted-foreground">{trainingMode}</p> : null}
        </div>

        <h1 className="text-h1 text-foreground max-w-2xl">{program.name}</h1>
        <p className="text-body-lg text-muted-foreground mt-5 max-w-xl">{program.description}</p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Button href={`/book-trial?program=${program.slug}`} variant="primary" size="lg">
            Book a Trial
          </Button>
          <Button href="/programs" variant="outline" size="lg">
            Back to Programs
          </Button>
        </div>
      </Container>
    </section>
  );
}
