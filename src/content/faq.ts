/**
 * FAQ content. Every answer here is either directly supported by
 * confirmed site architecture (programs, portals, tournaments) or is
 * deliberately non-committal where the academy hasn't confirmed a
 * specific business policy (payments, trial pricing, rescheduling) — per
 * the Phase 4 rule against inventing payment/refund/duration/rescheduling
 * policies.
 */
export interface FaqItem {
  id: string;
  category:
    | "Training"
    | "Programs"
    | "Online Coaching"
    | "Trial Classes"
    | "Tournaments"
    | "Student Progress"
    | "Parents"
    | "Payments";
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    id: "levels-trained",
    category: "Training",
    question: "What chess levels does Phoenix train?",
    answer:
      "Phoenix trains students from complete beginners through professional, competition-focused players, across six structured programs — see the Programs page for details on each level.",
  },
  {
    id: "no-experience",
    category: "Training",
    question: "Does my child need prior chess experience to join?",
    answer:
      "No. The Beginner Chess program is built for students with no prior experience. Students with existing experience are placed at the appropriate level after an initial evaluation.",
  },
  {
    id: "programs-offered",
    category: "Programs",
    question: "What programs does Phoenix offer?",
    answer:
      "Beginner Chess, Intermediate Chess, Advanced Chess, Professional Chess Training, Tournament Preparation, and Online Chess Coaching. Each program page has full details on format and focus.",
  },
  {
    id: "online-availability",
    category: "Online Coaching",
    question: "Is online coaching available?",
    answer:
      "Yes. The Online Chess Coaching program delivers the same structured Phoenix curriculum live online, for students who can't train in person.",
  },
  {
    id: "online-requirements",
    category: "Online Coaching",
    question: "What do I need for online chess coaching?",
    answer:
      "A stable internet connection and a device with video and chess-board access. Specific software/platform details are confirmed directly during enrollment.",
  },
  {
    id: "book-trial",
    category: "Trial Classes",
    question: "How do I book a trial class?",
    answer:
      "Submit the Book a Trial form with your details and preferred program. The academy will contact you directly to confirm scheduling.",
  },
  {
    id: "trial-details",
    category: "Trial Classes",
    question: "What happens after I submit a trial request?",
    answer:
      "The academy reviews your request and follows up directly to confirm trial details, including timing and any cost, since these are confirmed on a case-by-case basis.",
  },
  {
    id: "tournaments-conducted",
    category: "Tournaments",
    question: "Does Phoenix conduct tournaments?",
    answer:
      "Yes, Phoenix conducts state-level chess tournaments. Current and upcoming tournaments are listed on the Tournaments page.",
  },
  {
    id: "progress-tracking",
    category: "Student Progress",
    question: "How is a student's progress tracked?",
    answer:
      "Coaches evaluate students across categories such as opening, middlegame, endgame, tactics, and tournament readiness, with progress reviewed over time by their assigned coach.",
  },
  {
    id: "parent-visibility",
    category: "Parents",
    question: "Can parents track their child's progress?",
    answer:
      "Yes — enrolled families get access to a parent portal showing attendance, coach feedback, progress, and tournament results for their child.",
  },
  {
    id: "payment-process",
    category: "Payments",
    question: "How do I pay for a program?",
    answer:
      "Payment details are provided directly by the academy during enrollment — they are not processed through this website yet.",
  },
];
