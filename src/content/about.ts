/**
 * Content for /about, /about/our-story, /about/vision-mission, and
 * /about/leadership. Everything here is either (a) source-supported
 * draft copy that doesn't claim an unconfirmed fact, or (b) an empty,
 * typed array/null waiting on academy-confirmed data. Nothing here
 * invents founding years, credentials, or milestones.
 *
 * CONTENT PASS 1 (real-content integration): `philosophyPoints` and
 * `visionMissionDraft` below were strengthened using themes drawn from
 * the academy's own prior website (concentration, discipline, creative
 * problem-solving, confidence, focus, individual student development).
 * `leadership` includes the academy's founder, Dr. N. Krithika, with a
 * paraphrased bio (not a direct quote) plus a CONFIRMED, owner-approved
 * credentials list (All India Chess Federation Trainer, WORLD RECORDER,
 * 20+ years of experience in chess — see PHOENIX_REAL_CONTENT_MASTER.md,
 * Section 4). No FIDE ID/rating or chess title is included since none of
 * those specific facts is confirmed.
 */

export interface EditorialPoint {
  title: string;
  description: string;
}

export const philosophyPoints: EditorialPoint[] = [
  {
    title: "Chess Development Approach",
    description:
      "Students progress through a structured curriculum — opening principles, tactical patterns, and endgame technique — building on what came before rather than jumping between disconnected lessons.",
  },
  {
    title: "Focus, Discipline & Confidence",
    description:
      "Training is disciplined and consistent, and used to build concentration and confidence alongside chess skill. Students are expected to prepare, review, and practice between sessions, not just attend a weekly class.",
  },
  {
    title: "Competitive Chess Focus",
    description:
      "Phoenix trains students to compete, not just to learn rules. Tournament experience is treated as part of the curriculum, not an optional extra.",
  },
  {
    title: "Individual Student Development",
    description:
      "Every student is coached as an individual, with training paced to their own development rather than a single fixed schedule for every learner.",
  },
  {
    title: "Online & International Readiness",
    description:
      "The same structured training is available online, so a student's location doesn't limit access to the Phoenix curriculum.",
  },
];

// ---------------------------------------------------------------------------
// OUR STORY — /about/our-story
// ---------------------------------------------------------------------------

export interface StoryMilestone {
  year: number;
  title: string;
  description: string;
}

/**
 * No confirmed academy history has been provided yet — founding year,
 * founder, and milestones are all unconfirmed. This stays empty; the
 * timeline component hides entirely when empty rather than showing
 * placeholder years like 2010/2015/2020.
 */
export const storyMilestones: StoryMilestone[] = [];

export const storyIntro = {
  heading: "Our Story",
  body: "Phoenix Chess Academy's full history — founding, milestones, and growth — is being documented and will be published here. What's consistent throughout is the training approach: structured, disciplined, and built around real competition.",
};

// ---------------------------------------------------------------------------
// VISION & MISSION — /about/vision-mission
// ---------------------------------------------------------------------------

/**
 * SOURCE-SUPPORTED DRAFT — derived from themes present in the academy's
 * prior website content (expanding access to chess education, nurturing
 * young talent, school-curriculum integration, accessibility for
 * underprivileged communities, academy growth; and for the mission:
 * chess education across ages/skill levels, personalized coaching,
 * technology-supported and interactive learning, concentration,
 * discipline, competitive exposure). This is NOT a direct quote from
 * Dr. N. Krithika and is NOT owner-confirmed official wording — see
 * PHOENIX_REAL_CONTENT_MASTER.md, Section 6, for the full
 * classification. Kept in the content layer for easy replacement once
 * the academy confirms official language.
 */
export const visionMissionDraft = {
  vision:
    "To expand access to structured chess education, nurture young talent, and create opportunities for students to develop through disciplined, competitive, and meaningful chess learning.",
  mission:
    "To provide structured and accessible chess training through focused coaching, practical learning, tactical development, and competitive experience, helping students strengthen their chess skills, concentration, discipline, and confidence.",
  principles: [
    {
      title: "Student Development Principles",
      description: "Every student is evaluated and coached individually — progress is tracked, not assumed.",
    },
    {
      title: "Competitive Excellence",
      description: "Skill is proven in competition. Tournament preparation is part of training, not separate from it.",
    },
    {
      title: "Long-Term Chess Development",
      description: "Training is built in stages, so a student's early lessons still matter at an advanced level.",
    },
  ] satisfies EditorialPoint[],
};

// ---------------------------------------------------------------------------
// LEADERSHIP — /about/leadership
// ---------------------------------------------------------------------------

export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  image: string;
  bio: string;
  /**
   * Short, compact credential labels — rendered as individual facts/labels,
   * never concatenated into the bio paragraph. Only CONFIRMED, owner-
   * approved credentials belong here (see PHOENIX_REAL_CONTENT_MASTER.md,
   * Section 4). Exact wording matters — do not rephrase a confirmed
   * credential string.
   */
  credentials?: string[];
  chessTitle?: string;
  fideId?: string;
  fideRating?: number;
  profileUrl?: string;
}

/**
 * Dr. N. Krithika — CONFIRMED (see PHOENIX_REAL_CONTENT_MASTER.md,
 * Section 4). Founder and Director, with three owner-confirmed
 * credentials approved for public display. Credentials are kept as a
 * separate labeled list rather than folded into the bio paragraph. No
 * FIDE ID/rating or chess title is included since none is confirmed —
 * do not infer one from the credentials below.
 */
export const leadership: LeadershipMember[] = [
  {
    id: "n-krithika",
    name: "Dr. N. Krithika",
    role: "Founder and Director",
    image: "/images/leadership/dr-n-krithika.webp",
    bio: "Dr. N. Krithika founded Phoenix Chess Academy and leads it as Director. Her work spans teaching, coaching, and mentoring students, with training built around individual development, concentration, discipline, and competitive readiness — the same approach the academy continues to train students on today.",
    credentials: ["All India Chess Federation Trainer", "WORLD RECORDER", "20+ years of experience in chess"],
  },
];
