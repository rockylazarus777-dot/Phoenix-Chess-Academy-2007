import { buildMetadata } from "@/lib/seo/metadata";
import { buildFaqSchema } from "@/lib/seo/faq";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { faqItems } from "@/content/faq";

export const metadata = buildMetadata({
  title: "FAQ",
  description: "Answers to common questions about Phoenix Chess Academy's programs, coaching, tournaments, and trial classes.",
  path: "/faq",
});

const categories = Array.from(new Set(faqItems.map((item) => item.category)));

export default function FaqPage() {
  const faqSchema = buildFaqSchema(faqItems);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <PageHero eyebrow="FAQ" title="Frequently Asked Questions" />

      <Section>
        <Container className="max-w-3xl space-y-14">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-h3 text-foreground mb-4">{category}</h2>
              <FaqAccordion items={faqItems.filter((item) => item.category === category)} />
            </div>
          ))}
        </Container>
      </Section>
    </>
  );
}
