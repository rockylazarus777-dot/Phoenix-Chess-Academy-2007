import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { TournamentWinner } from "@/content/tournaments";

interface TournamentWinnersProps {
  winners?: TournamentWinner[];
}

/** Hidden entirely when empty — never a placeholder champion. */
export function TournamentWinners({ winners }: TournamentWinnersProps) {
  if (!winners || winners.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Winners" title="Tournament winners" />
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {winners.map((winner) => (
            <div key={`${winner.playerName}-${winner.position}`} className="text-center">
              {winner.photo ? (
                <div className="relative mx-auto aspect-square w-28 overflow-hidden rounded-full border-2 border-primary/40">
                  <Image src={winner.photo} alt={winner.playerName} fill sizes="112px" className="object-cover" />
                </div>
              ) : null}
              <p className="text-caption text-primary-text mt-4">{winner.position}</p>
              <p className="text-h4 text-foreground mt-1">{winner.playerName}</p>
              {winner.achievement ? (
                <p className="text-body-sm text-muted-foreground mt-2">{winner.achievement}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
