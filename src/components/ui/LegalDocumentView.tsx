import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import type { LegalDocument } from "@/content/legal";

interface LegalDocumentViewProps {
  document: LegalDocument;
}

/**
 * Shared renderer for all four legal page foundations (privacy, terms,
 * refund policy, cookie policy) — same structure, so one component
 * instead of four near-identical pages. Always shows the draft/last
 * updated notice; never implies legal review.
 */
export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="text-caption text-muted-foreground">
          Last updated: {new Date(document.lastUpdated).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-h1 text-foreground mt-3">{document.title}</h1>

        <div className="mt-6 rounded-2xl border border-border-strong bg-surface p-5">
          <p className="text-body-sm text-muted-foreground">
            <strong className="text-foreground">Draft notice:</strong> {document.intro}
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {document.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-h3 text-foreground">{section.heading}</h2>
              <div className="text-body text-muted-foreground mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
