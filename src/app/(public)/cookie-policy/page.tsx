import { buildMetadata } from "@/lib/seo/metadata";
import { LegalDocumentView } from "@/components/ui/LegalDocumentView";
import { cookiePolicy } from "@/content/legal";

export const metadata = buildMetadata({
  title: "Cookie Policy",
  description: "Cookies and similar technologies used on the Phoenix Chess Academy website.",
  path: "/cookie-policy",
  index: false,
});

export default function CookiePolicyPage() {
  return <LegalDocumentView document={cookiePolicy} />;
}
