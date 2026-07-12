import Link from "next/link";

/**
 * Single hero CTA. Deliberately a bespoke gold pill rather than the shared
 * <Button> primitive — the cinematic spec (full rounding, lift + glow hover,
 * exact gold hex) is specific to this full-bleed hero moment and shouldn't
 * bleed into the site's standard button styling used everywhere else.
 */
export function HeroCTA() {
  return (
    <Link
      href="/book-trial"
      className="inline-flex items-center justify-center rounded-full bg-[#D4AF37] px-8 py-4 text-base font-semibold text-black shadow-lg shadow-black/30 transition-[transform,box-shadow] duration-300 hover:scale-[1.03] hover:shadow-[0_0_32px_rgba(212,175,55,0.55)]"
    >
      Start Your Journey
    </Link>
  );
}
