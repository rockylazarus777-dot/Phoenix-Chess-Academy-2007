import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/ui/SkipLink";

/**
 * Public marketing site layout — Navbar + Footer wrap every page inside
 * the (public) route group. Portal/parent/coach/admin route segments sit
 * outside this group and define their own layouts, so this chrome never
 * leaks into dashboard views.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <Navbar />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
