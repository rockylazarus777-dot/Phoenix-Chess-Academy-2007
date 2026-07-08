import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Program } from "@/content/programs";

interface ProgramComparisonProps {
  programs: Program[];
}

/**
 * Compares programs on confirmed descriptive dimensions only (level,
 * program type, primary focus, recommended for) — never price, exact
 * duration, classes per week, or batch size, since none of that is
 * confirmed. Desktop renders a table; below `lg` it switches to stacked
 * cards so nothing overflows horizontally on mobile.
 */
export function ProgramComparison({ programs }: ProgramComparisonProps) {
  return (
    <Section surface>
      <Container>
        <SectionHeader eyebrow="Compare Programs" title="Find the right level at a glance" />

        {/* Desktop table */}
        <div className="mt-10 hidden overflow-hidden rounded-2xl border border-border lg:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-background">
                <th scope="col" className="text-caption text-muted-foreground px-5 py-4">Program</th>
                <th scope="col" className="text-caption text-muted-foreground px-5 py-4">Level</th>
                <th scope="col" className="text-caption text-muted-foreground px-5 py-4">Primary Focus</th>
                <th scope="col" className="text-caption text-muted-foreground px-5 py-4">Recommended For</th>
                <th scope="col" className="text-caption text-muted-foreground px-5 py-4">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.slug} className="border-b border-border last:border-none odd:bg-background/40">
                  <th scope="row" className="text-body text-foreground px-5 py-4 font-normal">
                    {program.name}
                  </th>
                  <td className="text-body-sm text-muted-foreground px-5 py-4">{program.levelLabel}</td>
                  <td className="text-body-sm text-muted-foreground px-5 py-4">{program.shortDescription}</td>
                  <td className="text-body-sm text-muted-foreground px-5 py-4">{program.recommendedFor[0]}</td>
                  <td className="px-5 py-4">
                    <Link href={`/programs/${program.slug}`} className="text-body-sm text-primary-text whitespace-nowrap">
                      View Program →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile / tablet stacked cards */}
        <div className="mt-10 space-y-4 lg:hidden">
          {programs.map((program) => (
            <div key={program.slug} className="rounded-2xl border border-border bg-background p-5">
              <p className="text-h4 text-foreground">{program.name}</p>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-caption text-muted-foreground">Level</dt>
                  <dd className="text-body-sm text-foreground/90">{program.levelLabel}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Primary Focus</dt>
                  <dd className="text-body-sm text-foreground/90">{program.shortDescription}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted-foreground">Recommended For</dt>
                  <dd className="text-body-sm text-foreground/90">{program.recommendedFor[0]}</dd>
                </div>
              </dl>
              <Link href={`/programs/${program.slug}`} className="text-body-sm text-primary-text mt-4 inline-block">
                View Program →
              </Link>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
