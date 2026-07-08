import type { Metadata } from "next";
import { spaceGrotesk, inter } from "@/lib/fonts";
import { siteConfig, getSiteUrl } from "@/config/site";
import "./globals.css";

/**
 * Root layout. Deliberately minimal — global HTML shell, fonts, and base
 * metadata only. The public Navbar/Footer live in the (public) route group
 * layout so that /portal, /parent, /coach, and /admin never inherit the
 * public marketing chrome.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteConfig.defaultTitle,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.locale} className={`${spaceGrotesk.variable} ${inter.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
