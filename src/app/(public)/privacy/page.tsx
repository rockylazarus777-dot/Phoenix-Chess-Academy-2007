import { buildMetadata } from "@/lib/seo/metadata";
import { LegalDocumentView } from "@/components/ui/LegalDocumentView";
import { privacyPolicy } from "@/content/legal";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How Phoenix Chess Academy's website and platform handle personal information.",
  path: "/privacy",
  index: false,
});

export default function PrivacyPage() {
  return <LegalDocumentView document={privacyPolicy} />;
}
