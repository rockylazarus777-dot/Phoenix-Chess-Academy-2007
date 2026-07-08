import { buildMetadata } from "@/lib/seo/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { ContactDetails } from "@/components/ui/ContactDetails";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata = buildMetadata({
  title: "Contact",
  description: "Get in touch with Phoenix Chess Academy — training, tournament, and general enquiries.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch with Phoenix"
        description="Training questions, tournament enquiries, or anything else — send a message and the academy will get back to you."
      />

      <Section>
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ContactForm />
          </div>
          <div>
            <p className="text-caption text-muted-foreground mb-4">Contact Details</p>
            <ContactDetails />
          </div>
        </Container>
      </Section>
    </>
  );
}
