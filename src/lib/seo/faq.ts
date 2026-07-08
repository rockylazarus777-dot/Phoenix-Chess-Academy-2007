interface FaqSchemaItem {
  question: string;
  answer: string;
}

/**
 * FAQPage JSON-LD — built only from the items actually passed in (i.e.
 * whatever is genuinely rendered on the page). Never generate schema for
 * hidden, filtered-out, or placeholder FAQ entries. Accepts any
 * {question, answer} shape so it works for both the /faq page's FaqItem
 * type and a program's lighter-weight FAQ entries.
 */
export function buildFaqSchema(items: FaqSchemaItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
