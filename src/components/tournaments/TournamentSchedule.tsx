import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatTournamentDate } from "@/lib/dates";
import type { TournamentScheduleItem } from "@/content/tournaments";

interface TournamentScheduleProps {
  schedule?: TournamentScheduleItem[];
}

export function TournamentSchedule({ schedule }: TournamentScheduleProps) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeader eyebrow="Schedule" title="Tournament schedule" />
        <ol className="mt-10 space-y-6">
          {schedule.map((item, index) => (
            <li
              key={`${item.date}-${item.title}-${index}`}
              className="flex flex-col gap-1 border-t border-border pt-5 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <p className="text-body-sm text-primary-text shrink-0 sm:w-48">
                <time dateTime={item.date}>{formatTournamentDate(item.date)}</time>
                {item.time ? ` · ${item.time}` : ""}
              </p>
              <div>
                <p className="text-body text-foreground">{item.title}</p>
                {item.description ? (
                  <p className="text-body-sm text-muted-foreground mt-1">{item.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
