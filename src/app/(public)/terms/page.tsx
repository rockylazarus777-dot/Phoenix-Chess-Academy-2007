import { buildMetadata } from "@/lib/seo/metadata";
import { LegalDocumentView } from "@/components/ui/LegalDocumentView";
import { termsAndConditions } from "@/content/legal";

export const metadata = buildMetadata({
  title: "Terms & Conditions",
  description: "Terms governing use of the Phoenix Chess Academy website and platform.",
  path: "/terms",
  index: false,
});

export default function TermsPage() {
  return <LegalDocumentView document={termsAndConditions} />;
}
