import { Space_Grotesk, Inter } from "next/font/google";

/**
 * Typography system — maximum of two font families, loaded via next/font
 * so files are self-hosted at build time (no external font script calls).
 *
 * Heading: Space Grotesk — geometric, confident, international.
 * Body: Inter — highly legible at small sizes, professional.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
