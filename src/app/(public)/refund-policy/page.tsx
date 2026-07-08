import { buildMetadata } from "@/lib/seo/metadata";
import { LegalDocumentView } from "@/components/ui/LegalDocumentView";
import { refundPolicy } from "@/content/legal";

export const metadata = buildMetadata({
  title: "Refund Policy",
  description: "Phoenix Chess Academy's refund policy status for programs, trials, and tournament fees.",
  path: "/refund-policy",
  index: false,
});

export default function RefundPolicyPage() {
  return <LegalDocumentView document={refundPolicy} />;
}
