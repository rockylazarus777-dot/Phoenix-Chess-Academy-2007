import { HeroVideo } from "@/components/home/HeroVideo";
import { HeroOverlay } from "@/components/home/HeroOverlay";
import { HeroContent } from "@/components/home/HeroContent";

/**
 * Full-viewport cinematic hero. The 10-second academy video is the entire
 * experience — one headline, one CTA, nothing else. Background color
 * behind the <video> is the brand navy so there's no flash of white if the
 * video asset is missing or still loading. Drop the source file at
 * public/videos/hero.mp4 (see public/videos/README.md).
 */
export function Hero() {
  return (
    <section className="relative h-svh min-h-[640px] w-full overflow-hidden bg-accent">
      <HeroVideo src="/videos/hero.mp4" />
      <HeroOverlay />
      <HeroContent />
    </section>
  );
}
