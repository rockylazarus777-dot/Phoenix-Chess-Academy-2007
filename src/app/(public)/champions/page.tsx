import Image from "next/image";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { getChampions, getFeaturedChampions, type Champion } from "@/content/champions";
import { trainingMethodology } from "@/content/training";

export const metadata = buildMetadata({
  title: "Champions — Hall of Fame",
  description: "The Phoenix Chess Academy Hall of Fame — verified player profiles and competitive chess records.",
  path: "/champions",
});

function ChampionCard({ champion }: { champion: Champion }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto aspect-4/5 w-full max-w-[220px] overflow-hidden rounded-2xl border-2 border-primary/40">
        <Image src={champion.photo} alt={champion.photoAlt} fill sizes="220px" loading="lazy" className="object-cover" />
      </div>
      <p className="text-h4 text-foreground mt-5">{champion.name}</p>
      <p className="text-caption text-primary-text mt-1">
        {[champion.title, champion.year].filter(Boolean).join(" · ")}
      </p>
      <p className="text-body-sm text-muted-foreground mt-3">{champion.summary}</p>
      {champion.achievements.length > 0 ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {champion.achievements.map((achievement) => (
            <li
              key={achievement}
              className="rounded-full border border-primary/40 bg-surface px-3 py-1 text-caption text-primary-text"
            >
              {achievement}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ChampionsPage() {
  const champions = getChampions();
  const featured = getFeaturedChampions();
  const playerDevelopmentItem = trainingMethodology.find((item) => item.id === "tournament-experience");

  return (
    <>
      <PageHero
        eyebrow="Hall of Fame"
        title="Phoenix Champions"
        description="Verified player profiles and competitive chess records from Phoenix Chess Academy."
      />

      {champions.length === 0 ? (
        <EmptyDataState
          eyebrow="Hall of Fame"
          title="Verified champion profiles, published as they're confirmed"
          description="Phoenix Chess Academy trains students toward real competitive results. Verified Phoenix player profiles and competitive records — names, titles, and achievements — are presented here once structured records are available. No profile is published without confirmation."
          ctaLabel="Book a Trial"
          ctaHref="/book-trial"
        />
      ) : (
        <>
          <Section>
            <Container>
              <SectionHeader
                eyebrow="Hall of Fame"
                title="Phoenix Champions"
                description="Verified player profiles and competitive chess records."
              />
            </Container>
          </Section>

          {featured.length > 0 ? (
            <Section surface>
              <Container>
                <SectionHeader eyebrow="Featured" title="Featured Champions" />
                <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
                  {featured.map((champion) => (
                    <ChampionCard key={champion.id} champion={champion} />
                  ))}
                </div>
              </Container>
            </Section>
          ) : null}

          <Section>
            <Container>
              <SectionHeader eyebrow="All Champions" title="Champion Grid" />
              <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
                {champions.map((champion) => (
                  <ChampionCard key={champion.id} champion={champion} />
                ))}
              </div>
            </Container>
          </Section>
        </>
      )}

      {playerDevelopmentItem ? (
        <Section surface>
          <Container className="max-w-2xl text-center mx-auto">
            <p className="text-caption text-primary-text mb-3">Phoenix Player Development</p>
            <h2 className="text-h2 text-foreground">{playerDevelopmentItem.title}</h2>
            <p className="text-body-lg text-muted-foreground mt-4">{playerDevelopmentItem.description}</p>
          </Container>
        </Section>
      ) : null}

      <TrialCTA />
    </>
  );
}
