import { buildMetadata } from "@/lib/seo/metadata";
import { buildOrganizationSchema } from "@/lib/seo/organization";

import { Hero } from "@/components/home/Hero";
import { ImpactStats } from "@/components/home/ImpactStats";
import { AboutPhoenix } from "@/components/home/AboutPhoenix";
import { ProgramsShowcase } from "@/components/home/ProgramsShowcase";
import { WhyPhoenix } from "@/components/home/WhyPhoenix";
import { AcademyImpact } from "@/components/home/AcademyImpact";
import { FeaturedTournament } from "@/components/home/FeaturedTournament";
import { AchievementsShowcase } from "@/components/home/AchievementsShowcase";
import { HallOfFame } from "@/components/home/HallOfFame";
import { CoachesShowcase } from "@/components/home/CoachesShowcase";
import { VideoExperience } from "@/components/home/VideoExperience";
import { TournamentHighlights } from "@/components/home/TournamentHighlights";
import { Testimonials } from "@/components/home/Testimonials";
import { ResourcesPreview } from "@/components/home/ResourcesPreview";
import { TrialCTA } from "@/components/home/TrialCTA";

export const metadata = buildMetadata({
  title: "Phoenix Chess Academy | Professional Chess Training",
  description:
    "Phoenix Chess Academy trains disciplined, competitive chess players through professional coaching, structured student development, and state-level tournaments.",
  path: "/",
});

/**
 * Home page. Server Component composing section components in the
 * approved Phase 3 order. Navbar/Footer come from the (public) layout —
 * not duplicated here. Sections with no confirmed real data (achievements,
 * champions, coaches, testimonials, tournaments, video, articles) render
 * an honest fallback/CTA state instead of fabricated content — see
 * src/content/home.ts.
 */
export default function HomePage() {
  const organizationSchema = buildOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

      <Hero />
      <ImpactStats />
      <AboutPhoenix />
      <ProgramsShowcase />
      <WhyPhoenix />
      <AcademyImpact />
      <FeaturedTournament />
      <AchievementsShowcase />
      <HallOfFame />
      <CoachesShowcase />
      <VideoExperience />
      <TournamentHighlights />
      <Testimonials />
      <ResourcesPreview />
      <TrialCTA />
    </>
  );
}
