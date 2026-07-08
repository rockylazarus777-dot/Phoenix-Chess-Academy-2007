import Image from "next/image";
import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { EmptyDataState } from "@/components/ui/EmptyDataState";
import { TrialCTA } from "@/components/home/TrialCTA";
import { leadership } from "@/content/about";

export const metadata = buildMetadata({
  title: "Leadership",
  description: "The people leading Phoenix Chess Academy's coaching and academy operations.",
  path: "/about/leadership",
});

export default function LeadershipPage() {
  return (
    <>
      <PageHero eyebrow="About Phoenix" title="Leadership" />

      {leadership.length === 0 ? (
        <EmptyDataState
          title="Leadership profiles are being finalized"
          description="Academy leadership will be introduced here once profiles are confirmed. In the meantime, get in touch through the Contact page with any questions."
          ctaLabel="Contact Phoenix"
          ctaHref="/contact"
        />
      ) : (
        <Section>
          <Container className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {leadership.map((leader) => (
              <div key={leader.id} className="text-center">
                <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-full border-2 border-primary/40">
                  <Image src={leader.image} alt={leader.name} fill sizes="160px" className="object-cover" />
                </div>
                <p className="text-h4 text-foreground mt-5">{leader.name}</p>
                <p className="text-body-sm text-muted-foreground">{leader.role}</p>
                {leader.chessTitle ? <p className="text-caption text-primary-text mt-1">{leader.chessTitle}</p> : null}

                {leader.credentials && leader.credentials.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap justify-center gap-2">
                    {leader.credentials.map((credential) => (
                      <li
                        key={credential}
                        className="rounded-full border border-primary/40 bg-surface px-3 py-1 text-caption text-primary-text"
                      >
                        {credential}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="text-body-sm text-muted-foreground mt-4">{leader.bio}</p>
              </div>
            ))}
          </Container>
        </Section>
      )}

      <TrialCTA />
    </>
  );
}
