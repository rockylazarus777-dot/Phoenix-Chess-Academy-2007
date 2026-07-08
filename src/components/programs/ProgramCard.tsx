import Image from "next/image";
import Link from "next/link";
import type { Program } from "@/content/programs";

interface ProgramCardProps {
  program: Program;
  /** Only an above-the-fold card (e.g. first card in a hero-adjacent grid) should ever set this true. */
  priority?: boolean;
}

/**
 * The single ProgramCard used everywhere a program is shown as a card —
 * home page preview and the /programs listing grid — so there's one
 * source of truth for how a program card looks and behaves.
 */
export function ProgramCard({ program, priority = false }: ProgramCardProps) {
  const trainingMode = program.highlights?.find((item) => item.label === "Training Mode")?.value;

  return (
    <Link
      href={`/programs/${program.slug}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
    >
      <div className="relative aspect-4/3 overflow-hidden">
        <Image
          src={program.cardImage}
          alt={program.name}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          style={program.imagePosition ? { objectPosition: program.imagePosition } : undefined}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-caption text-primary-text">{program.levelLabel}</p>
          {trainingMode ? <p className="text-caption text-muted-foreground">{trainingMode}</p> : null}
        </div>
        <h3 className="text-h4 text-foreground group-hover:text-primary-text transition-colors mt-1">
          {program.name}
        </h3>
        <p className="text-body-sm text-muted-foreground mt-2">{program.shortDescription}</p>
        <p className="text-body-sm text-primary-text mt-4">Explore Program →</p>
      </div>
    </Link>
  );
}
