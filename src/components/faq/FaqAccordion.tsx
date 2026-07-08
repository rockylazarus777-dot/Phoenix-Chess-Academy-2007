export interface FaqAccordionItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqAccordionItem[];
}

/**
 * Native <details>/<summary> accordion — fully keyboard accessible (Tab to
 * a question, Enter/Space to toggle) with zero JavaScript and no UI
 * library. Renders as a Server Component since no client state is needed.
 *
 * Shared between the Phase 4 /faq page and Phase 5 program-specific FAQ
 * sections — accepts any {question, answer} shape rather than being
 * coupled to the /faq page's richer FaqItem type (id/category), so it
 * doesn't need a second near-identical accordion component.
 */
export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <details key={item.question} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-body text-foreground marker:content-none">
            {item.question}
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 10 10"
              className="shrink-0 transition-transform group-open:rotate-180"
            >
              <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
          </summary>
          <p className="text-body-sm text-muted-foreground mt-3 pr-8">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
