/**
 * Draft legal page foundations for /privacy, /terms, /refund-policy, and
 * /cookie-policy. These are structural drafts, not legally reviewed
 * documents — each page renders a visible notice to that effect. Content
 * describes the platform's actual/planned data handling (what's true
 * about the architecture) without inventing jurisdiction-specific legal
 * assurances or business policy specifics (e.g. exact refund terms) that
 * the academy hasn't confirmed.
 */
export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lastUpdated: "2026-07-05",
  intro:
    "This is a draft privacy policy foundation describing how Phoenix Chess Academy's website and platform are designed to handle data. It has not yet been reviewed by a legal professional and will be finalized before full account and payment features go live.",
  sections: [
    {
      heading: "Information We Collect",
      body: [
        "Contact form and trial booking submissions: name, email, phone, and the details you provide in the message.",
        "Account information for students, parents, and coaches once authentication is enabled: profile details, chess level, and program enrollment.",
        "Tournament registration details: player information, category selection, and (where applicable) parent/guardian information for minors.",
        "Attendance, progress evaluations, assignments, and certificates associated with a student's training record.",
        "Media such as gallery photos, videos, and uploaded documents connected to academy activities.",
      ],
    },
    {
      heading: "How Information Is Used",
      body: [
        "To respond to enquiries and trial booking requests.",
        "To operate student, parent, and coach accounts and portals.",
        "To manage tournament registrations and results.",
        "To generate internal academy reports (for example, exported to Google Sheets for staff/management use — not shared publicly).",
      ],
    },
    {
      heading: "Where Information Is Stored",
      body: [
        "Structured account and training data is stored in a Supabase-hosted database with access controls restricting who can view each record.",
        "Media such as images, certificates, and documents are stored via Cloudflare R2, with private documents served through access-controlled links rather than public URLs.",
        "Videos are hosted on YouTube and embedded on the site; YouTube's own privacy practices apply to embedded video playback.",
      ],
    },
    {
      heading: "Analytics",
      body: [
        "The site may use analytics tools (such as Google Analytics) to understand aggregate usage. Analytics identifiers are configured through environment variables and are not combined with student training records.",
      ],
    },
    {
      heading: "Your Rights",
      body: [
        "You may contact the academy to request access to, correction of, or deletion of your personal information, subject to legitimate academy record-keeping needs (for example, retaining tournament results).",
      ],
    },
    {
      heading: "Contact",
      body: [
        "Questions about this policy can be directed to the academy using the contact details on the Contact page, where available.",
      ],
    },
  ],
};

export const termsAndConditions: LegalDocument = {
  slug: "terms",
  title: "Terms & Conditions",
  lastUpdated: "2026-07-05",
  intro:
    "This is a draft terms-of-use foundation for the Phoenix Chess Academy website. It has not yet been reviewed by a legal professional and will be finalized before full account, tournament, and payment features go live.",
  sections: [
    {
      heading: "Use of This Website",
      body: [
        "This website provides information about Phoenix Chess Academy's programs, coaches, tournaments, and achievements, and supports trial booking, tournament registration, and (once enabled) student/parent/coach portal accounts.",
      ],
    },
    {
      heading: "Accounts",
      body: [
        "Where account access is provided (student, parent, coach, or administrative), you are responsible for keeping your login credentials confidential and for activity that occurs under your account.",
      ],
    },
    {
      heading: "Tournament Registration",
      body: [
        "Tournament registration is subject to the eligibility, category, and schedule details published on each tournament's page. Specific entry fee, refund, and rescheduling terms for a given tournament will be published on that tournament's page rather than assumed from this general document.",
      ],
    },
    {
      heading: "Content Ownership",
      body: [
        "The Phoenix Chess Academy name, logo, and academy-produced photography/video remain the property of Phoenix Chess Academy.",
      ],
    },
    {
      heading: "Changes to These Terms",
      body: [
        "These terms may be updated as the platform develops. The \"last updated\" date at the top of this page reflects the most recent revision.",
      ],
    },
  ],
};

export const refundPolicy: LegalDocument = {
  slug: "refund-policy",
  title: "Refund Policy",
  lastUpdated: "2026-07-05",
  intro:
    "Phoenix Chess Academy has not yet confirmed final refund terms for programs, trial classes, or tournament entry fees. This page is a structural placeholder — specific refund conditions will be published here once confirmed by the academy, rather than assumed.",
  sections: [
    {
      heading: "Current Status",
      body: [
        "No online payment processing is active on this website yet. Any payments currently handled directly by the academy are subject to terms communicated at the time of enrollment or registration, not this page.",
      ],
    },
    {
      heading: "What Will Be Covered Here",
      body: [
        "Once payment processing is integrated, this page will describe refund eligibility and timelines for program fees, trial bookings, and tournament entry fees.",
      ],
    },
  ],
};

export const cookiePolicy: LegalDocument = {
  slug: "cookie-policy",
  title: "Cookie Policy",
  lastUpdated: "2026-07-05",
  intro:
    "This page describes the cookies and similar technologies used on the Phoenix Chess Academy website. It has not yet been reviewed by a legal professional.",
  sections: [
    {
      heading: "Necessary Cookies",
      body: [
        "Used to support core site functionality, such as keeping you signed in to a student, parent, or coach account once authentication is enabled.",
      ],
    },
    {
      heading: "Analytics Cookies",
      body: [
        "If enabled, analytics tools may set cookies to measure aggregate site usage. These are configured through environment variables and are off by default until an analytics ID is configured.",
      ],
    },
    {
      heading: "Embedded YouTube Content",
      body: [
        "Academy videos are embedded using YouTube's privacy-enhanced (youtube-nocookie.com) mode where possible. Once you choose to play an embedded video, YouTube's own cookie practices apply.",
      ],
    },
    {
      heading: "Managing Cookies",
      body: [
        "You can control or delete cookies through your browser settings. Blocking necessary cookies may affect the ability to stay signed in to portal accounts.",
      ],
    },
  ],
};
