"use client";

import { motion } from "framer-motion";
import { HeroCTA } from "@/components/home/HeroCTA";

/**
 * Headline + CTA, staggered on top of the already-visible video/overlay per
 * the cinematic timeline: headline fades up at 0.6s, CTA follows at 1.2s.
 * No further animation after that — the video carries the rest.
 */
export function HeroContent() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.h1
        className="max-w-4xl font-heading text-[2.25rem] font-extrabold leading-[1.05] text-white sm:text-[3.5rem] md:text-[4rem] lg:text-[5rem]"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
      >
        Where Champions Begin
      </motion.h1>

      <motion.div
        className="mt-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
      >
        <HeroCTA />
      </motion.div>
    </div>
  );
}
