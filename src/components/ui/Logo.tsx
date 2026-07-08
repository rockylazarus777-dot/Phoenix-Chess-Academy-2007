import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  /** Where the logo should link to. Defaults to the homepage. */
  href?: string;
  className?: string;
  /** Use for above-the-fold placements (navbar) to avoid layout shift. */
  priority?: boolean;
  /** Rendered pixel height; width equals height (the source is a 1:1 circular medallion). */
  height?: number;
}

/**
 * Reusable brand logo.
 *
 * OFFICIAL ASSET IN USE:
 * Renders the real Phoenix Chess Academy logo at
 * /public/images/brand/phoenix-logo.jpg — a 638×638 JPEG circular gold
 * medallion (Phoenix bird, crown, "PHOENIX CHESS ACADEMY · CHENNAI" ring
 * text) supplied by the academy. The file has a white background baked
 * into the raster image; this is not faked as transparent via CSS
 * blend/filter tricks. Do not recolor, crop, distort, or add glow/shadow
 * to the logo itself.
 *
 * KNOWN LIMITATION — LEGIBILITY AT SMALL SIZES:
 * Because the mark is a circular medallion with ring text (not a compact
 * wordmark), the "PHOENIX CHESS ACADEMY" text becomes hard to read at
 * small navbar heights (~28–36px). No workaround has been applied here
 * without being asked — flagging this so the academy can decide whether
 * to size the navbar mark up, supply a simplified wordmark for small
 * placements, or accept the current sizing.
 *
 * If a transparent PNG/SVG or a simplified wordmark version is supplied
 * later, update the `src` below — no other component needs to change,
 * since every usage goes through this single component. Also update
 * MEDIA_MAPPING.md with the new path/format.
 */
export function Logo({ href = "/", className, priority = false, height = 36 }: LogoProps) {
  const mark = (
    <Image
      src="/images/brand/phoenix-logo.jpg"
      alt="Phoenix Chess Academy logo"
      height={height}
      width={height}
      priority={priority}
      className={className}
    />
  );

  if (!href) return mark;

  return (
    <Link href={href} aria-label="Phoenix Chess Academy" className="inline-flex items-center">
      {mark}
    </Link>
  );
}
