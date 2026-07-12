interface HeroVideoProps {
  src: string;
  poster?: string;
}

/**
 * Full-bleed looping background video for the hero. Autoplays muted so
 * browsers allow it without a user gesture; `disablePictureInPicture` and
 * `controls={false}` keep it purely ambient. Sits behind HeroOverlay via
 * z-index in Hero.tsx, not here, so this component only owns the media.
 */
export function HeroVideo({ src, poster }: HeroVideoProps) {
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      disablePictureInPicture
      aria-hidden
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
