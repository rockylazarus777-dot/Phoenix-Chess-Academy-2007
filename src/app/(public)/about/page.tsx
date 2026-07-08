import Image from "next/image";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { EditorialSection } from "@/components/ui/EditorialSection";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { PointsGrid } from "@/components/ui/PointsGrid";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ImpactStats } from "@/components/home/ImpactStats";
import { TrialCTA } from "@/components/home/TrialCTA";
import { philosophyPoints, visionMissionDraft, leadership } from "@/content/about";

export const metadata = buildMetadata({
  title: "About Phoenix Chess Academy",
  description: "Structured, disciplined chess training built around real competition — Phoenix Chess Academy's approach to student development.",
  path: "/about",
});

const [developmentApproach, trainingCulture, competitiveFocus, individualDevelopment, onlineReadiness] = philosophyPoints;

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Phoenix"
        title="Chess training built on discipline, not shortcuts."
        description="Phoenix Chess Academy trains students through a structured curriculum that develops real chess understanding — from first moves to tournament-level competition."
      />

      <EditorialSection
        eyebrow="Academy Philosophy"
        title="Training built in stages, not one-off lessons"
        image="/images/about/academy-training.webp"
        imageAlt="Students training at Phoenix Chess Academy"
      >
        <p>
          Every student moves through a structured path — each level builds
          the skills the next one depends on. Coaches evaluate progress
          directly rather than assuming a student is ready to advance.
        </p>
      </EditorialSection>

      {developmentApproach ? (
        <EditorialSection
          title={developmentApproach.title}
          image="/images/about/chess-development.webp"
          imageAlt="Chess development training session"
          imageSide="left"
          surface
        >
          <p>{developmentApproach.description}</p>
        </EditorialSection>
      ) : null}

      <ImpactStats />

      {trainingCulture ? (
        <EditorialSection
          title={trainingCulture.title}
          image="/images/about/training-culture.webp"
          imageAlt="Phoenix training culture"
        >
          <p>{trainingCulture.description}</p>
        </EditorialSection>
      ) : null}

      {competitiveFocus ? (
        <EditorialSection
          title={competitiveFocus.title}
          image="/images/about/competitive-chess.webp"
          imageAlt="Competitive chess training at Phoenix"
          imageSide="left"
          surface
        >
          <p>{competitiveFocus.description}</p>
        </EditorialSection>
      ) : null}

      {individualDevelopment || onlineReadiness ? (
        <Section>
          <Container>
            <PointsGrid points={[individualDevelopment, onlineReadiness].filter(Boolean) as typeof philosophyPoints} columns={2} />
          </Container>
        </Section>
      ) : null}

      <Section surface>
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <p className="text-caption text-primary-text mb-3">Vision & Mission</p>
            <h2 className="text-h2 text-foreground">{visionMissionDraft.vision}</h2>
            <div className="mt-6">
              <Button href="/about/vision-mission" variant="outline" size="md">
                Read Vision & Mission
              </Button>
            </div>
          </div>
          <div>
            <p className="text-body-lg text-muted-foreground">{visionMissionDraft.mission}</p>
          </div>
        </Container>
      </Section>

      {leadership.length === 0 ? (
        <EmptyDataState
          eyebrow="Leadership"
          title="The people leading Phoenix"
          description="Academy leadership profiles are being finalized and will be published here."
          ctaLabel="View Leadership"
          ctaHref="/about/leadership"
        />
      ) : (
        <Section surface>
          <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
            <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-full border-2 border-primary/40 lg:mx-0">
              <Image src={leadership[0].image} alt={leadership[0].name} fill sizes="128px" className="object-cover" />
            </div>
            <div>
              <p className="text-caption text-primary-text mb-2">Leadership</p>
              <h2 className="text-h3 text-foreground">{leadership[0].name}</h2>
              <p className="text-body-sm text-muted-foreground">{leadership[0].role}</p>
              {leadership[0].credentials && leadership[0].credentials.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {leadership[0].credentials.map((credential) => (
                    <li
                      key={credential}
                      className="rounded-full border border-primary/40 bg-surface px-3 py-1 text-caption text-primary-text"
                    >
                      {credential}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-5">
                <Button href="/about/leadership" variant="outline" size="md">
                  View Leadership
                </Button>
              </div>
            </div>
          </Container>
        </Section>
      )}

      <TrialCTA />
    </>
  );
}
