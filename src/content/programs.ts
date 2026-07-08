/**
 * Authoritative program data — the single source of truth for both the
 * /programs system and the home page's program preview. Do not maintain
 * a second program list anywhere else.
 *
 * Content rule: everything here is descriptive draft content ("training
 * may focus on...", "students develop...") rather than a claimed fixed
 * syllabus. Operational specifics the academy hasn't confirmed — class
 * duration, frequency, batch size, pricing, coach assignments, FIDE
 * rating thresholds, certificates — are intentionally omitted rather than
 * invented. `highlights` only lists dimensions that are actually
 * confirmed per program; most programs have none yet.
 *
 * Migration note (future Supabase move): this file's shape is designed to
 * map directly onto a `programs` table — `slug` as the natural key,
 * `developmentAreas`/`skills`/`recommendedFor`/`relatedSlugs` as either
 * join tables or jsonb columns, `faq` as a `program_faqs` table. The
 * `[slug]` route already resolves by slug and calls `notFound()` for
 * anything unrecognized, so swapping the lookup from this array to a
 * Supabase query is a localized change in `getProgramBySlug`/`getPrograms`
 * — page components don't need to change.
 *
 * CONTENT PASS 1 (real-content integration): descriptions/skills/
 * developmentAreas below were strengthened using source-supported
 * themes from the academy's prior website (tactical training, clock
 * awareness/time management, middlegame strategy, endgame technique,
 * opening repertoire development). Still no invented duration,
 * frequency, batch size, pricing, or rating-threshold claims — those
 * remain intentionally absent. See PHOENIX_REAL_CONTENT_MASTER.md at
 * the project root for the full source classification, including a
 * flag on the "Professional Chess Training" program name (see note on
 * that entry below).
 */

export type ProgramLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "professional"
  | "tournament-prep"
  | "online";

export interface ProgramHighlight {
  label: string;
  value: string;
}

export interface ProgramFaqItem {
  question: string;
  answer: string;
}

export interface Program {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  level: ProgramLevel;
  levelLabel: string;
  shortDescription: string;
  description: string;
  cardImage: string;
  /** Falls back to cardImage when not set — see getProgramHeroImage(). */
  heroImage?: string;
  /** e.g. "center", "center top", "40% center" — passed straight to CSS object-position. */
  imagePosition?: string;
  recommendedFor: string[];
  developmentAreas: string[];
  skills: string[];
  /** Only confirmed, configured values — omit rather than guess. */
  highlights?: ProgramHighlight[];
  faq: ProgramFaqItem[];
  relatedSlugs: string[];
  active: boolean;
}

/**
 * Shared descriptions for each chess development area, reused across
 * every program that lists it — avoids re-writing the same explanation
 * six times. Programs pick a relevant subset via `developmentAreas`.
 */
export const developmentAreaDescriptions: Record<string, string> = {
  Opening: "Understanding opening principles and how early moves shape the rest of the game.",
  Middlegame: "Planning, piece coordination, and finding a plan once the opening is complete.",
  Endgame: "Core endgame technique — the positions that decide close games.",
  Tactics: "Recognizing tactical patterns — pins, forks, skewers, and combinations.",
  Calculation: "Reading ahead accurately and evaluating resulting positions.",
  Strategy: "Long-term planning and understanding what a position calls for.",
  "Positional Understanding": "Reading pawn structure, piece activity, and long-term imbalances.",
  "Game Analysis": "Reviewing played games to understand mistakes and missed opportunities.",
  "Time Management": "Making sound decisions within a game clock, not just in unlimited analysis.",
  "Tournament Preparation": "Getting ready for competitive play — routines, mindset, and practical decision-making.",
};

// Phoenix's training methodology now lives in src/content/training.ts
// (`trainingMethodology` / `getTrainingMethodology()` /
// `getTrainingMethodologyForProgram()`) — the single authoritative
// source, consumed by TrainingApproach.tsx. Do not restate it here.

export const programs: Program[] = [
  {
    id: "beginner-chess",
    slug: "beginner-chess",
    name: "Beginner Chess",
    eyebrow: "Foundational Program",
    level: "beginner",
    levelLabel: "Foundational",
    shortDescription:
      "A structured first step into chess — rules, board vision, and the habits that make later stages click.",
    description:
      "Beginner Chess is designed for students with little or no prior chess experience. Training may focus on chessboard understanding, piece movement, basic rules, check and checkmate, and fundamental tactical awareness — building concentration and early problem-solving habits alongside the foundation the rest of a student's chess development depends on.",
    cardImage: "/images/programs/beginner-chess.webp",
    recommendedFor: [
      "Students new to chess with little or no prior experience",
      "Young learners building their first board understanding",
      "Anyone who wants a structured introduction rather than casual play",
    ],
    developmentAreas: ["Opening", "Tactics", "Game Analysis"],
    skills: [
      "Legal piece movement and board orientation",
      "Recognizing check, checkmate, and stalemate",
      "Basic opening principles",
      "Simple tactical patterns",
      "Reading a chessboard confidently",
    ],
    faq: [
      {
        question: "Does my child need to know how to play chess already?",
        answer: "No — Beginner Chess is designed for students with little or no prior experience.",
      },
      {
        question: "What comes after Beginner Chess?",
        answer: "Students typically move toward Intermediate Chess once foundational rules and board understanding are solid, based on coach evaluation.",
      },
    ],
    relatedSlugs: ["intermediate-chess", "online-chess-coaching"],
    active: true,
  },
  {
    id: "intermediate-chess",
    slug: "intermediate-chess",
    name: "Intermediate Chess",
    eyebrow: "Developing Program",
    level: "intermediate",
    levelLabel: "Developing",
    shortDescription:
      "Tactical pattern recognition and opening principles for players ready to compete with intent.",
    description:
      "Intermediate Chess is designed for students who already know the rules and play regularly. Training may focus on tactical pattern recognition, clock awareness, opening principles and repertoire development, middlegame planning, and endgame foundations, alongside reviewing played games to build real understanding.",
    cardImage: "/images/programs/intermediate-chess.webp",
    recommendedFor: [
      "Students who know the rules and play regularly",
      "Players ready to move beyond casual games",
      "Students preparing for their first tournaments",
    ],
    developmentAreas: ["Tactics", "Opening", "Middlegame", "Endgame", "Game Analysis", "Time Management"],
    skills: [
      "Common tactical motifs and combinations",
      "Clock awareness during practical play",
      "Opening principles and early repertoire development",
      "Basic middlegame planning",
      "Foundational endgame technique",
      "Reviewing and learning from played games",
    ],
    faq: [
      {
        question: "How is this different from Beginner Chess?",
        answer: "Intermediate Chess assumes a student already knows the rules and has some playing experience, and moves into tactical and positional ideas.",
      },
      {
        question: "Is this program suitable for tournament preparation?",
        answer: "It builds a foundation useful for competitive play; dedicated tournament preparation is covered in the Tournament Preparation program.",
      },
    ],
    relatedSlugs: ["advanced-chess", "tournament-preparation", "beginner-chess"],
    active: true,
  },
  {
    id: "advanced-chess",
    slug: "advanced-chess",
    name: "Advanced Chess",
    eyebrow: "Advanced Program",
    level: "advanced",
    levelLabel: "Advanced",
    shortDescription:
      "Deeper strategic understanding, calculation training, and endgame technique for serious players.",
    description:
      "Advanced Chess is designed for experienced players developing deeper strategic understanding. Training may focus on calculation, positional understanding, advanced endgames, opening preparation, clock management, and tournament decision-making.",
    cardImage: "/images/programs/advanced-chess.webp",
    recommendedFor: [
      "Experienced players with solid tactical and positional foundations",
      "Students preparing for more serious competitive play",
      "Players looking to deepen calculation and strategic understanding",
    ],
    developmentAreas: ["Calculation", "Strategy", "Positional Understanding", "Endgame", "Opening", "Time Management"],
    skills: [
      "Deeper calculation and candidate-move evaluation",
      "Positional assessment and long-term planning",
      "Advanced endgame technique",
      "Opening preparation beyond general principles",
      "Clock management in longer, serious games",
      "Practical tournament decision-making",
    ],
    faq: [
      {
        question: "Is Advanced Chess only for tournament players?",
        answer: "It's designed for experienced players deepening their understanding — many go on to compete, but that's not a requirement.",
      },
      {
        question: "Does this program guarantee a rating milestone?",
        answer: "No — Phoenix does not guarantee specific rating outcomes. Training focuses on building real understanding and skill.",
      },
    ],
    relatedSlugs: ["professional-training", "tournament-preparation"],
    active: true,
  },
  {
    // NAME NOTE (content pass 1): "Professional Chess Training" is the
    // working name carried over from Phase 5. Source material referenced
    // this program under slightly different naming — the exact official
    // public name is CURRENT PROJECT PROGRAM NAME — OWNER CONFIRMATION
    // REQUIRED (see PHOENIX_REAL_CONTENT_MASTER.md, Owner Confirmation
    // Register). The program is not being deleted or hidden while this
    // is pending — only the exact name string may change later.
    id: "professional-training",
    slug: "professional-training",
    name: "Professional Chess Training",
    eyebrow: "Competitive Program",
    level: "professional",
    levelLabel: "Competitive / Professional",
    shortDescription:
      "High-intensity coaching for players targeting competitive titles and national-level results.",
    description:
      "Professional Chess Training is designed for players pursuing serious, high-level competitive chess. Training may focus on advanced calculation, deep opening preparation, high-level game analysis, clock management, and practical tournament decision-making.",
    cardImage: "/images/programs/professional-training.webp",
    recommendedFor: [
      "Players pursuing serious, high-level competitive chess",
      "Students with a strong tactical and strategic foundation already in place",
      "Players training toward national-level tournament results",
    ],
    developmentAreas: ["Calculation", "Strategy", "Positional Understanding", "Opening", "Game Analysis", "Tournament Preparation", "Time Management"],
    skills: [
      "High-level calculation and evaluation",
      "In-depth opening preparation",
      "Advanced game analysis",
      "Clock management under serious tournament conditions",
      "Competitive mindset and preparation routines",
      "Practical decision-making under tournament conditions",
    ],
    highlights: [{ label: "Competitive Focus", value: "High-level tournament preparation" }],
    faq: [
      {
        question: "Does this program guarantee a chess title?",
        answer: "No — Phoenix does not guarantee titles or rating outcomes. This program is built around serious, structured competitive training.",
      },
      {
        question: "Who is this program not suitable for?",
        answer: "Students newer to chess are better served starting with Beginner or Intermediate Chess and progressing from there.",
      },
    ],
    relatedSlugs: ["tournament-preparation", "advanced-chess"],
    active: true,
  },
  {
    id: "tournament-preparation",
    slug: "tournament-preparation",
    name: "Tournament Preparation",
    eyebrow: "Competitive Program",
    level: "tournament-prep",
    levelLabel: "Tournament-Focused",
    shortDescription:
      "Focused preparation cycles — opening repertoire, time management, and tournament-day discipline.",
    description:
      "Tournament Preparation supports competitive players getting ready for upcoming tournaments. Training may focus on competitive preparation, time management, game analysis, tournament routines, and practical decision-making under real conditions.",
    cardImage: "/images/programs/tournament-preparation.webp",
    recommendedFor: [
      "Competitive players with an upcoming tournament",
      "Students at intermediate level and above",
      "Players who want focused preparation rather than general training",
    ],
    developmentAreas: ["Tournament Preparation", "Time Management", "Game Analysis", "Calculation"],
    skills: [
      "Tournament-day routines and preparation habits",
      "Time management under a game clock",
      "Practical, results-focused game analysis",
      "Handling competitive pressure",
    ],
    faq: [
      {
        question: "What experience level is Tournament Preparation for?",
        answer: "It supports competitive players at intermediate level and above who have an upcoming tournament in mind.",
      },
      {
        question: "Can this program be combined with Advanced Chess or Professional Training?",
        answer: "Yes — Tournament Preparation is designed to complement level-based programs ahead of competitive play.",
      },
    ],
    relatedSlugs: ["advanced-chess", "professional-training"],
    active: true,
  },
  {
    id: "online-chess-coaching",
    slug: "online-chess-coaching",
    name: "Online Chess Coaching",
    eyebrow: "Flexible / Remote Program",
    level: "online",
    levelLabel: "Flexible / Remote",
    shortDescription:
      "The same structured Phoenix curriculum, delivered live online for students anywhere in the world.",
    description:
      "Online Chess Coaching delivers structured, live remote chess instruction for students who can't train in person. Training may focus on the same core areas as in-person programs — remote instruction, structured online learning, and digital game analysis — adapted for an online format.",
    cardImage: "/images/programs/online-chess-coaching.webp",
    recommendedFor: [
      "Students who can't attend in-person training",
      "International students outside the academy's home city",
      "Families who prefer the flexibility of remote sessions",
    ],
    developmentAreas: ["Opening", "Tactics", "Game Analysis"],
    skills: [
      "The same structured curriculum as in-person levels",
      "Digital game review and analysis",
      "Independent study habits between sessions",
      "Comfort training and competing in an online environment",
    ],
    highlights: [{ label: "Training Mode", value: "Online" }],
    faq: [
      {
        question: "Is online coaching suitable for beginners?",
        answer: "Yes — online coaching follows the same level-based curriculum as in-person training, starting from a student's actual experience level.",
      },
      {
        question: "What do I need for online sessions?",
        answer: "A stable internet connection and a device with video and chess-board access. Specific platform details are confirmed during enrollment.",
      },
    ],
    relatedSlugs: ["beginner-chess", "intermediate-chess"],
    active: true,
  },
];

export function getPrograms(): Program[] {
  return programs.filter((program) => program.active);
}

export function getProgramBySlug(slug: string): Program | undefined {
  return programs.find((program) => program.active && program.slug === slug);
}

export function getProgramHeroImage(program: Program): string {
  return program.heroImage ?? program.cardImage;
}

export function getRelatedPrograms(program: Program, max = 3): Program[] {
  const active = getPrograms();
  return program.relatedSlugs
    .map((slug) => active.find((candidate) => candidate.slug === slug))
    .filter((candidate): candidate is Program => Boolean(candidate) && candidate!.slug !== program.slug)
    .slice(0, max);
}
