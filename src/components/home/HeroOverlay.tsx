"use client";

import { motion } from "framer-motion";

/**
 * Cinematic gradient scrim over the hero video. Darkens top-to-bottom just
 * enough to keep the headline/CTA readable (WCAG contrast) without
 * flattening the video's motion and detail. Fades in on its own so the
 * video is visible, unobscured, for the first instant of playback.
 */
export function HeroOverlay() {
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.55))",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
      aria-hidden
    />
  );
}
