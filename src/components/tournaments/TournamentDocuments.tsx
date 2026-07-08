import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { TournamentDocument } from "@/content/tournaments";

interface TournamentDocumentsProps {
  documents?: TournamentDocument[];
}

/** Document architecture only — never generates a fake PDF or empty file. */
export function TournamentDocuments({ documents }: TournamentDocumentsProps) {
  if (!documents || documents.length === 0) return null;

  return (
    <Section>
      <Container className="max-w-3xl">
        <SectionHeader eyebrow="Documents" title="Tournament documents" />
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {documents.map((doc) => (
            <li key={doc.url} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-body text-foreground">{doc.title}</p>
                <p className="text-caption text-muted-foreground mt-0.5">
                  {doc.type}
                  {doc.fileSize ? ` · ${doc.fileSize}` : ""}
                </p>
              </div>
              <a
                href={doc.url}
                target={doc.external ? "_blank" : undefined}
                rel={doc.external ? "noopener noreferrer" : undefined}
                className="shrink-0 text-body-sm text-primary-text hover:underline"
              >
                {doc.external ? "Open ↗" : "Download"}
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
