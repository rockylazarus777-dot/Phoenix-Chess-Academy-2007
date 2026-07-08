/**
 * Single source of truth for public site navigation.
 *
 * Both the desktop navbar and the mobile navigation render from this
 * config so nav items are never duplicated between the two components.
 */

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  href: string;
  items: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return Array.isArray((entry as NavGroup).items);
}

export const primaryNavigation: NavEntry[] = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "About",
    href: "/about",
    items: [
      { label: "About Phoenix", href: "/about", description: "Who we are and what we stand for" },
      { label: "Our Story", href: "/about/our-story", description: "How Phoenix Chess Academy began" },
      { label: "Vision & Mission", href: "/about/vision-mission", description: "What we are building toward" },
      { label: "Leadership", href: "/about/leadership", description: "The people leading the academy" },
    ],
  },
  {
    label: "Programs",
    href: "/programs",
    items: [
      { label: "Beginner Chess", href: "/programs/beginner-chess" },
      { label: "Intermediate Chess", href: "/programs/intermediate-chess" },
      { label: "Advanced Chess", href: "/programs/advanced-chess" },
      { label: "Professional Training", href: "/programs/professional-training" },
      { label: "Tournament Preparation", href: "/programs/tournament-preparation" },
      { label: "Online Chess Coaching", href: "/programs/online-chess-coaching" },
    ],
  },
  {
    label: "Coaches",
    href: "/coaches",
  },
  {
    // PHASE 7 NAV FIX: "Tournament Calendar" previously linked to
    // /tournaments/calendar, which has no matching content and 404s via
    // the dynamic [slug] route (there's no tournament with that slug).
    // Removed rather than pointed at a fake calendar page — see
    // docs/DATABASE_ARCHITECTURE.md "Static Content vs Database" section.
    // Re-add only once a real calendar view exists.
    label: "Tournaments",
    href: "/tournaments",
    items: [
      { label: "Upcoming Tournaments", href: "/tournaments?status=upcoming" },
      { label: "State Tournaments", href: "/tournaments?category=state" },
      { label: "Past Tournaments", href: "/tournaments?status=completed" },
    ],
  },
  {
    // PHASE 8 NAV FIX: "Tournament Winners" (/achievements/tournament-
    // winners) and "Hall of Fame" (/achievements/hall-of-fame) previously
    // pointed to sub-routes that were never built and would 404. Phase 8
    // built /achievements (which includes a Tournament Achievements
    // section once tournament-type records exist) and /champions (the
    // actual Hall of Fame experience) instead — consolidated to those two
    // real routes rather than building two more placeholder pages.
    label: "Achievements",
    href: "/achievements",
    items: [
      { label: "Student Achievements", href: "/achievements" },
      { label: "Hall of Fame", href: "/champions" },
    ],
  },
  {
    label: "Media",
    href: "/gallery",
    items: [
      { label: "Gallery", href: "/gallery" },
      { label: "Videos", href: "/videos" },
    ],
  },
  {
    label: "Resources",
    href: "/blog",
    items: [
      { label: "Chess Resources / Blog", href: "/blog" },
      { label: "FAQs", href: "/faq" },
    ],
  },
  {
    label: "Contact",
    href: "/contact",
  },
];

export const footerNavigation = {
  programs: [
    { label: "Beginner Chess", href: "/programs/beginner-chess" },
    { label: "Intermediate Chess", href: "/programs/intermediate-chess" },
    { label: "Advanced Chess", href: "/programs/advanced-chess" },
    { label: "Professional Training", href: "/programs/professional-training" },
    { label: "Tournament Preparation", href: "/programs/tournament-preparation" },
    { label: "Online Chess Coaching", href: "/programs/online-chess-coaching" },
  ] satisfies NavLink[],
  academy: [
    { label: "About Phoenix", href: "/about" },
    { label: "Our Story", href: "/about/our-story" },
    { label: "Vision & Mission", href: "/about/vision-mission" },
    { label: "Leadership", href: "/about/leadership" },
    { label: "Coaches", href: "/coaches" },
  ] satisfies NavLink[],
  tournaments: [
    { label: "Upcoming Tournaments", href: "/tournaments?status=upcoming" },
    { label: "State Tournaments", href: "/tournaments?category=state" },
    { label: "Past Tournaments", href: "/tournaments?status=completed" },
  ] satisfies NavLink[],
  resources: [
    { label: "Chess Resources / Blog", href: "/blog" },
    { label: "Gallery", href: "/gallery" },
    { label: "Videos", href: "/videos" },
    { label: "Contact", href: "/contact" },
  ] satisfies NavLink[],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Cookie Policy", href: "/cookie-policy" },
  ] satisfies NavLink[],
};

export const ctaNavigation = {
  primary: { label: "Book a Trial", href: "/book-trial" },
  login: { label: "Login", href: "/login" },
};
