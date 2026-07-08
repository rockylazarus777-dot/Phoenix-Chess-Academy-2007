/**
 * Home page content/config.
 *
 * This is temporary static content, kept separate from presentation
 * components so it's obvious what's business fact vs. layout. Nothing
 * here is fabricated: unverified figures and testimonials are left as
 * empty arrays rather than invented, and the components that consume
 * them render an honest fallback state instead of fake content.
 *
 * CONTENT PASS 1 (real-content integration): `aboutPreview` and
 * `whyPhoenixPoints` below were strengthened using source-supported
 * themes from the academy's own prior website (structured curriculum,
 * discipline, competitive/tournament focus, individual student
 * development, online availability). See PHOENIX_REAL_CONTENT_MASTER.md
 * at the project root for the full classification of what is confirmed
 * vs. draft vs. still awaiting owner confirmation — nothing marked
 * OWNER CONFIRMATION REQUIRED in that document appears here.
 *
 * PHASE 8 NOTE: achievements, champions, resource articles, the academy
 * video, and tournament-highlight images previously lived here as
 * separate, differently-shaped placeholder arrays. They have moved to
 * their own authoritative content sources — src/content/achievements.ts,
 * champions.ts, blog.ts, videos.ts, and gallery.ts (TOURNAMENT category)
 * respectively — since those are now also the source for the dedicated
 * /achievements, /champions, /blog, /videos, and /gallery routes. Do not
 * reintroduce a second, differently-shaped copy of any of these here.
 *
 * When Supabase-backed content lands (later phase), these types become
 * the shape returned by the data layer — components won't need to change.
 */

/**
 * Short editorial copy for the home page "About Phoenix" preview section.
 * Kept in the content layer (not hardcoded in AboutPhoenix.tsx) so it can
 * be updated in one place. Source-supported draft — see
 * PHOENIX_REAL_CONTENT_MASTER.md, Section 4.
 */
export const aboutPreview = {
  eyebrow: "About Phoenix",
  heading: "Chess training built on discipline, not shortcuts.",
  body: "Phoenix Chess Academy trains students through a structured curriculum built around concentration, discipline, and creative problem-solving — developing real chess understanding from first moves to tournament-level competition. Training is built around the individual student, with progress tracked stage by stage rather than assumed.",
};

export interface TrustStat {
  id: string;
  label: string;
  value: number;
  suffix?: string;
}

/**
 * Only include a stat here once it is a real, confirmed academy figure.
 * "5,000+ students" is the one number the academy has confirmed so far.
 * The ImpactStats component renders however many entries exist — one or
 * six — without needing a redesign later.
 */
export const trustStats: TrustStat[] = [
  { id: "students", label: "Students Trained", value: 5000, suffix: "+" },
];

// Program data lives in src/content/programs.ts — the single authoritative
// source used by both this home page and the /programs system. See
// ProgramsShowcase.tsx, which imports `getPrograms` from there directly.

export interface WhyPhoenixPoint {
  title: string;
  description: string;
}

export const whyPhoenixPoints: WhyPhoenixPoint[] = [
  {
    title: "Structured Chess Development",
    description: "A curriculum that builds skill in sequence — every level prepares a student for the next, rather than isolated one-off lessons.",
  },
  {
    title: "Focus & Discipline",
    description: "Chess training is used to build concentration and disciplined thinking habits, alongside the game itself.",
  },
  {
    title: "Competitive Training",
    description: "Training built around real competition, not just theory — students learn to perform under pressure and analyze their own games.",
  },
  {
    title: "Individual Student Development",
    description: "Coaches work with students individually, tracking each student's own progress rather than applying one pace to everyone.",
  },
  {
    title: "Creative Problem-Solving",
    description: "Tactical and strategic training builds the habit of finding a plan, not just reacting move to move.",
  },
  {
    title: "Online Training Capability",
    description: "The same structured Phoenix training, available to students who cannot train in person.",
  },
];

// Featured-tournament data now lives in src/content/tournaments.ts (the
// single authoritative tournament source, built in Phase 6) — see
// `getFeaturedTournament()`, consumed directly by
// components/home/FeaturedTournament.tsx. Do not reintroduce a second,
// differently-shaped tournament placeholder here.

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  image?: string;
}

/** No real testimonials supplied yet — kept empty intentionally. */
export const testimonials: Testimonial[] = [];
