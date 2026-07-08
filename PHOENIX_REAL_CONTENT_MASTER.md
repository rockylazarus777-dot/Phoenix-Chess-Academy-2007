# PHOENIX CHESS ACADEMY — REAL CONTENT MASTER DOCUMENT

**Content Pass 1 — Real Content Integration**
Status: Working reference document. Not a public-facing page. Governs what
source material from the academy's prior website
(`phoenixchessacademychennai.com`) is safe to publish now, in what form,
and what still requires direct owner confirmation before it can appear
anywhere on the new site.

---

## 1. PURPOSE & CLASSIFICATION SYSTEM

Every fact pulled from the old site is placed in exactly one of four
buckets. No fact appears in more than one bucket, and no ambiguous
"probably fine" language is used anywhere in this document.

- **CONFIRMED** — Verified, safe to publish as-is, no further owner
  sign-off needed.
- **SOURCE-SUPPORTED DRAFT** — Present in the old source material,
  reworded/paraphrased (not quoted) for the new site, safe to publish
  as *draft* copy because it makes no claim the academy hasn't already
  made publicly. Marked as draft in code comments so it's easy to
  replace once the academy confirms exact language.
- **OWNER CONFIRMATION REQUIRED** — Present in the old source material,
  but risky, outdated, ambiguous, or unverifiable in its current form.
  **Not published anywhere on the new site.** Listed in Section 22 with
  what needs to be confirmed before it can move to CONFIRMED or
  SOURCE-SUPPORTED DRAFT.
- **HISTORICAL SOURCE REFERENCE** — True of the old site/old business
  presentation at some point in time, but not a claim being made about
  the current business. Recorded here for institutional memory only —
  never rendered on the live site.

---

## 2. EXECUTIVE SUMMARY

The old site (`phoenixchessacademychennai.com`) confirms the academy is
Chennai-based (consistent with the ring text on the official logo:
"PHOENIX CHESS ACADEMY · CHENNAI"), founded/led by **Dr. N. Krithika**,
and has trained **5,000+ students** — the one number already in
confirmed use on the new site. The old site also contains a number of
claims this pass deliberately keeps unpublished: an unverified trainer
credential, an unusual "World Recorder" claim, a "20+ years" experience
figure, international branch claims, tournament-frequency claims, and a
tactical-training rating restriction. These are documented in Section
22 rather than published, per the explicit instruction governing this
pass.

**Note on document history:** an earlier revision of this document
flagged the Vision statement, Mission statement, and the 8-item
training methodology as theme-level only (exact original wording lost
to a context-compaction step). The academy re-supplied the specific
source-supported themes and target draft wording for all three in
Content Pass 2, and they are now fully restored below — still
classified **SOURCE-SUPPORTED DRAFT**, not CONFIRMED, since none of the
three is an owner-signed-off official statement yet. The exact
recommended short description sentence referenced in that earlier
revision remains theme-level only and has not been re-supplied.

**Content Pass 3 — Confirmed Content Lock:** the owner has now directly
confirmed several previously-unpublished facts, which are promoted to
**CONFIRMED** throughout this document: the founder's full credential
set (All India Chess Federation Trainer, the exact phrase "WORLD
RECORDER," and "20+ years of experience in chess"), the official phone
number and WhatsApp number (+91 63696 87328, same number for both), the
official email (**info@phoenixchessacademy.org** — a new confirmed
domain email, explicitly replacing the old
`phoenixchessacademy123@gmail.com`, which is no longer current and must
not be published as the official email), and the current active
business address (73A, 13th St, Ram Nagar, Kuberan Nagar, Madipakkam,
Chennai, Tamil Nadu 600091, India). International branch claims
(Canada/Germany/London/New York) and the under-2000 rating restriction
remain **unconfirmed and unpublished** — this pass did not touch those.

---

## 3. BUSINESS IDENTITY & LOCATION

| Fact | Classification | Notes |
|---|---|---|
| Academy is Chennai-based | CONFIRMED | Consistent with the official logo's ring text. |
| Current active address: 73A, 13th St, Ram Nagar, Kuberan Nagar, Madipakkam, Chennai, Tamil Nadu 600091, India | **CONFIRMED** | Published in `src/config/site.ts` → `siteConfig.contact.address`; renders on the Contact page and Footer via `ContactDetails`, and in Organization JSON-LD as a `PostalAddress`. |
| Official phone: +91 63696 87328 | **CONFIRMED** | Published in `siteConfig.contact.phone`; renders as a `tel:` link via `ContactDetails`; included in Organization JSON-LD as `telephone`. This is the same number that was previously listed only as historical/unconfirmed — the owner has now confirmed it is current. |
| Official WhatsApp: +91 63696 87328 (same number as phone) | **CONFIRMED** | Published in `siteConfig.contact.whatsapp`; renders as a `wa.me` link via `ContactDetails`. |
| Official email: info@phoenixchessacademy.org | **CONFIRMED** | Published in `siteConfig.contact.email`; renders as a `mailto:` link; included in Organization JSON-LD as `email`. This is a new confirmed domain email — see below. |
| Old email: phoenixchessacademy123@gmail.com | HISTORICAL SOURCE REFERENCE | Explicitly **not** the current official email per direct owner instruction. Never published anywhere; kept here only as an audit trail so a future editor doesn't reintroduce it by mistake. |
| Domain phoenixchessacademychennai.com | HISTORICAL SOURCE REFERENCE | Prior site domain, used here only as a source citation, not linked from the new site. |

---

## 4. FOUNDER & LEADERSHIP

| Fact | Classification | Where it lives now |
|---|---|---|
| Founder is Dr. N. Krithika, serving as Founder and Director | CONFIRMED | `src/content/about.ts` → `leadership[0]` |
| General description of founder's work (teaching, coaching, mentoring, academy development) | SOURCE-SUPPORTED DRAFT | Paraphrased into `leadership[0].bio` — not a direct quote from the old site. |
| All India Chess Federation Trainer | **CONFIRMED** | Published as a credential label in `leadership[0].credentials` — rendered as a standalone label, never folded into the bio paragraph. |
| Exact phrase "WORLD RECORDER" | **CONFIRMED — exact wording only** | Published verbatim in `leadership[0].credentials`. Per direct owner instruction, this exact phrase is used as-is — not rewritten to "World Record Holder," "World Record Achiever," "Guinness World Record Holder," or any other variant. No record name, recognizing organization, date, or certificate number is invented or implied — the site does not claim any of those specifics. |
| 20+ years of experience in chess | **CONFIRMED** | Published verbatim in `leadership[0].credentials`. |
| Exact academic/coaching qualifications behind the "Dr." title | OWNER CONFIRMATION REQUIRED | The title itself is used as supplied (part of the founder's name), but no specific degree/qualification claim is made anywhere on the site. See Section 22, item 22. |

No FIDE ID, FIDE rating, or chess title is published for the founder —
none was confirmed, and `LeadershipMember` fields for these are simply
omitted (not filled with placeholder values). No chess title, FIDE ID,
or FIDE rating should be inferred from the three confirmed credentials
above — they remain three separate, specific, confirmed facts and
nothing more.

---

## 5. ACADEMY PHILOSOPHY & CHESS BENEFITS

Source material described chess training benefits in terms of:
concentration, discipline, creative problem-solving, confidence, focus,
and individual student development. These themes are **SOURCE-SUPPORTED
DRAFT** and have been worked into:

- `src/content/home.ts` → `whyPhoenixPoints` (added "Focus & Discipline"
  and "Creative Problem-Solving" points; reworded "Student Progress
  Focus" into "Individual Student Development")
- `src/content/home.ts` → `aboutPreview` (new content object, consumed
  by `AboutPhoenix.tsx` instead of hardcoded JSX)
- `src/content/about.ts` → `philosophyPoints` (added "Individual Student
  Development"; reworded "Training Culture" to "Focus, Discipline &
  Confidence")

None of this copy claims a specific outcome (e.g. "improves grades" or
"proven to boost IQ") — it stays at the level of what training
emphasizes, which is defensible without a citation.

---

## 6. VISION & MISSION (DRAFT)

Restored in Content Pass 2 using the specific source-supported themes
the academy re-supplied: for the Vision — expanding access to chess
education, nurturing young chess talent, integrating chess into school
curriculums, making chess accessible to underprivileged communities,
and academy growth; for the Mission — chess education across different
ages and skill levels, personalized coaching, technology-supported and
interactive learning, concentration, discipline, and competitive
exposure.

`src/content/about.ts` → `visionMissionDraft` now reads:

- **Vision:** "To expand access to structured chess education, nurture
  young talent, and create opportunities for students to develop
  through disciplined, competitive, and meaningful chess learning."
- **Mission:** "To provide structured and accessible chess training
  through focused coaching, practical learning, tactical development,
  and competitive experience, helping students strengthen their chess
  skills, concentration, discipline, and confidence."

**Classification: SOURCE-SUPPORTED DRAFT.** This is drafted from prior
Phoenix source content, not a direct quote from Dr. N. Krithika, and is
explicitly **not** owner-confirmed official wording. It must not be
promoted to CONFIRMED without the academy's explicit sign-off on this
exact phrasing (see Section 22, items 18–19).

---

## 7. TRAINING METHODOLOGY

Restored in Content Pass 2 as the academy's authoritative 8-item
methodology, now living in one typed content module —
`src/content/training.ts` (`trainingMethodology`,
`getTrainingMethodology()`, `getTrainingMethodologyForProgram(slug)`) —
replacing the Phase 5 placeholder 5-step generic model (Concept
Development → Guided Practice → Game Analysis → Practical Application
→ Progress Review), which has been removed from `src/content/programs.ts`.

**Classification: SOURCE-SUPPORTED DRAFT.** The 8 items:

1. **Individual Development** — training considers the student's current chess experience and development needs.
2. **Tactical Development** — pattern recognition, tactical exercises, and practical tactical awareness.
3. **Chess Foundation and Development** — opening principles and preparation, middlegame understanding, and endgame development according to the student's level.
4. **Practical Play** — students apply chess concepts through practical game experience.
5. **Clock Training** — competitive players may develop practical time-management awareness through clock-based play. (Shown only on Intermediate, Advanced, Professional Chess Training, and Tournament Preparation.)
6. **Tournament Experience** — competitive chess experience supports practical decision-making and tournament preparation. (Shown only on Advanced, Professional Chess Training, and Tournament Preparation.)
7. **Focused Coaching** — private and focused training can support individual chess development.
8. **Online Learning** — Phoenix supports technology-enabled and interactive chess learning. (Shown only on Online Chess Coaching.)

Items 1–4 and 7 are universal (no `relevantProgramSlugs`) and appear for
every program's detail page; items 5, 6, and 8 are scoped to the
programs they're actually relevant to, per the "don't force all eight
items onto every page" instruction. The `/programs` listing page shows
the full 8-item methodology (`getTrainingMethodology()`); each
`/programs/[slug]` detail page shows only the relevant subset
(`getTrainingMethodologyForProgram(program.slug)`), via
`TrainingApproach.tsx`'s new optional `programSlug` prop.

---

## 8. "COMBO TRAINING FORMULA" / "PHOENIX COMPETITIVE DEVELOPMENT APPROACH"

Source material referenced a named training concept under two different
labels: "Combo Training Formula" and "Phoenix Competitive Development
Approach." Because it's unclear which (if either) is the academy's
current preferred/official name for this concept, and because
presenting it under the wrong name would be a real brand accuracy
problem, **neither name is published anywhere on the live site in this
pass.** This is classified **SOURCE-SUPPORTED DRAFT — OWNER CONFIRMATION
REQUIRED FOR CURRENT USE.** See Section 22, items 16–17.

---

## 9. PROGRAM-SPECIFIC CONTENT (ALL 6 PROGRAMS)

`src/content/programs.ts` was strengthened per program using
source-supported themes, while preserving the existing architecture
(slugs, routes, `relatedSlugs`, Course JSON-LD, query-param trial
booking) untouched:

| Program | What changed | Classification |
|---|---|---|
| Beginner Chess | Description now references concentration/problem-solving habits alongside foundational rules | SOURCE-SUPPORTED DRAFT |
| Intermediate Chess | Added clock awareness and opening repertoire development to description/skills; added "Time Management" development area | SOURCE-SUPPORTED DRAFT |
| Advanced Chess | Added clock management to description/skills; added "Time Management" development area | SOURCE-SUPPORTED DRAFT |
| Professional Chess Training | Added clock management under tournament conditions; added "Time Management" development area; **name itself flagged for confirmation** (see below) | SOURCE-SUPPORTED DRAFT (content) / OWNER CONFIRMATION REQUIRED (name) |
| Tournament Preparation | Already covered time management/clock training from Phase 5 — no structural change needed, themes already aligned | Unchanged, already source-aligned |
| Online Chess Coaching | Left largely as-is — source material didn't provide online-specific themes beyond what's already there | Unchanged |

**Program name flag:** "Professional Chess Training" is the working
name carried over from Phase 5 architecture. Source material suggests
the academy may use different official naming for this offering. The
program has **not** been renamed, deleted, or hidden — renaming a
public program based on an unconfirmed guess would be worse than
leaving the current, already-published name in place. See Section 22,
item 15.

**Explicitly not added to any program:** exact class duration, weekly
frequency, batch size, pricing, or a minimum/maximum rating requirement
for eligibility (including the under-2000-rating restriction referenced
in source material for tactical training — see Section 22, item 12).

---

## 10. ACHIEVEMENTS & TRUST STATISTICS

| Fact | Classification | Notes |
|---|---|---|
| 5,000+ students trained | CONFIRMED | Already live in `src/content/home.ts` → `trustStats`. Left unchanged by this pass. |
| Specific student achievement names/results/tournament wins | OWNER CONFIRMATION REQUIRED | None were supplied with enough specificity to publish; `achievements` stays an empty array. See Section 22, item 21. |
| Champions / Hall of Fame entries | OWNER CONFIRMATION REQUIRED | Same as above — `champions` stays empty. |

---

## 11. CONTACT INFORMATION (CONFIRMED — NOW PUBLISHED)

`src/config/site.ts` → `siteConfig.contact` is now populated with
owner-confirmed values: phone (+91 63696 87328), WhatsApp (same
number), email (info@phoenixchessacademy.org), and the current active
address (73A, 13th St, Ram Nagar, Kuberan Nagar, Madipakkam, Chennai,
Tamil Nadu 600091, India). All four are **CONFIRMED**.

These render through two consumers, both reading `siteConfig` directly
so there is exactly one source of truth:

- `src/components/ui/ContactDetails.tsx` — shared by the Footer and the
  Contact page. Renders `mailto:`, `tel:`, and a `wa.me/<digits-only>`
  WhatsApp link (no prewritten message appended — none was requested),
  plus the full formatted address.
- `src/lib/seo/organization.ts` → `buildOrganizationSchema()` — already
  conditionally included `telephone`/`email`/`address` whenever
  `siteConfig.contact` has values, so no code change was needed there;
  populating `siteConfig` was sufficient to make Organization JSON-LD
  include the confirmed phone, email, and `PostalAddress`.

The old email (phoenixchessacademy123@gmail.com) is never rendered
anywhere — confirmed via a full grep of the built HTML output.

---

## 12. INTERNATIONAL PRESENCE CLAIMS (HIGH RISK)

Source material claimed physical branches in Canada, Germany, London,
and New York, in addition to Chennai. This is the highest-risk claim in
the source material — presenting unconfirmed foreign business locations
publicly carries real legal/reputational exposure if inaccurate.

**Classification: OWNER CONFIRMATION REQUIRED — none of the four
locations are published anywhere.** Where the site currently touches on
reach beyond Chennai, it uses neutral, defensible wording instead (e.g.
"Online Chess Coaching" copy in `src/content/programs.ts` describing
online delivery for students who "can't attend in-person training" and
"international students outside the academy's home city" — a true,
low-risk statement about online availability, not a claim of physical
branches). See Section 22, items 7–10.

---

## 13. SOCIAL MEDIA PRESENCE

No official social media profile URLs were confirmed in source
material. `siteConfig.social` remains all empty strings — unchanged by
this pass. See Section 22, item 20.

---

## 14. TOURNAMENT FREQUENCY CLAIMS

Source material contains conflicting statements about how often the
academy conducts or participates in tournaments (e.g. a weekly cadence
claim elsewhere contradicted by other source language). Because the
claims conflict with each other, neither is published. `featuredTournament`
remains `null` and no frequency claim appears in `whyPhoenixPoints`,
`philosophyPoints`, or any program description. See Section 22, item 11.

---

## 15. CREDENTIALS & EXPERIENCE CLAIMS (NOW CONFIRMED — EXACT WORDING RULE)

Covered in Section 4 (founder-specific) and repeated here as a
standalone category because of the exact-wording rule attached to it:
the AICF trainer credential, the exact phrase "WORLD RECORDER," and
"20+ years of experience in chess" are now **CONFIRMED** and published
as compact credential labels on `/about` and `/about/leadership` (see
`src/content/about.ts` → `leadership[0].credentials`).

**Exact-wording rule (binding):** "WORLD RECORDER" is rendered exactly
as given — not rewritten to "World Record Holder," "World Record
Achiever," "Guinness World Record Holder," or any other variant, unless
the owner separately confirms a different wording later. The site does
not invent a record name, a recognizing organization, a record date, or
a certificate number to go with this credential — it is published as a
standalone label, nothing more.

---

## 16. SEO — FORBIDDEN SUPERLATIVE CLAIMS

The following claim types are **not used** in any page `<title>`, meta
description, heading, or body copy anywhere on the site (outside the
one exact confirmed credential label described below), because they
are not independently verifiable:

- "Best," "#1," "top-rated," "leading," or "premier" academy claims
- "World record" / "record-holding" language used as new marketing
  copy (e.g. inventing a headline like "World-record-holding academy")
- Specific years-of-experience figures used anywhere other than the
  one confirmed credential label itself
- Specific credential/certification names that aren't confirmed
- Any claim of guaranteed rating, title, or tournament outcome

**Named exception:** the exact confirmed credential label "WORLD
RECORDER" (Section 15) is published verbatim as a founder credential on
`/about` and `/about/leadership` — this is a confirmed fact rendered as
a label, not a superlative claim invented for SEO purposes. It is not
used in page titles, meta descriptions, or repeated elsewhere as
marketing copy (e.g. not turned into "Trained by a world record holder"
in a hero headline) — it appears only where the founder's credentials
are actually listed.

This was checked against every edited file across all three passes
(`home.ts`, `about.ts`, `programs.ts`, `training.ts`, `AboutPhoenix.tsx`,
`about/page.tsx`, `about/leadership/page.tsx`) — no forbidden claim
appears outside the one named exception.

---

## 17. STRUCTURED DATA (JSON-LD) AUDIT

- `src/lib/seo/organization.ts` → `buildOrganizationSchema()`: **code
  unchanged** in Content Pass 3 — it already conditionally included
  `telephone`/`email`/`address` whenever `siteConfig.contact` had real
  values. Populating `siteConfig` with the confirmed phone, email, and
  address in this pass was sufficient for the schema to now include:
  `name`, `url`, `logo`, `description`, `telephone` (+91 63696 87328),
  `email` (info@phoenixchessacademy.org), and `address` as a
  `PostalAddress` (streetAddress/addressLocality/addressRegion/
  postalCode/addressCountry from the confirmed Madipakkam address).
  `sameAs` remains absent — `siteConfig.social` is still all empty, no
  social URL is confirmed. **Not added, per explicit instruction:** any
  international branch, `aggregateRating`, `review`, `award`, or the
  founder's credentials represented as an organization-level award.
- `src/lib/seo/course.ts` → Course schema per program: unchanged. Still
  excludes `price`, `offers`, `duration`, `credentialCategory`, and
  `aggregateRating`/`review`.
- No new structured data type was added to the confirmed-content-lock
  part of this pass. (Phase 6 below adds Event JSON-LD, scoped to real
  tournament records only.)

---

## 18. CONTENT DUPLICATION AUDIT

Checked for repeated paragraphs across Home, About, and Programs after
this pass's edits:

- `aboutPreview.body` (Home) and the About page's `PageHero` description
  are similar in *theme* (both reference structured curriculum and
  discipline) but are written as distinct sentences, not copy-pasted
  duplicates — left as-is since a homepage teaser and an interior page
  hero naturally echo the same positioning.
- `philosophyPoints` (About) and `whyPhoenixPoints` (Home) cover
  overlapping themes (discipline, individual development) by design —
  they serve different pages and use different phrasing per point; no
  identical sentence appears in both arrays.
- No paragraph is copy-pasted verbatim between `home.ts`, `about.ts`,
  and `programs.ts`.

---

## 19. MEDIA REQUIREMENTS ARISING FROM THIS PASS

One new media requirement was added to `MEDIA_MAPPING.md`: a founder
portrait for Dr. N. Krithika at
`/public/images/leadership/dr-n-krithika.webp` (1200×1500, 4:5,
WebP/AVIF, max 350KB). Until this file is supplied, `next/image` will
404 on that path on both `/about` (leadership preview) and
`/about/leadership` (full profile) — this is the expected, honest
placeholder-missing state, same pattern used throughout the site. See
`MEDIA_MAPPING.md` → "CONTENT PASS 1 MEDIA ADDITION" for the full entry,
including a note that the current leadership display components render
photos in a circular/square crop, which will crop a 4:5 portrait — flagged
there for the academy's awareness, not silently changed.

No image was extracted, screenshotted, or cropped from the old site's
PDF — per explicit instruction, this pass treated original image files
as a separate, future deliverable.

---

## 20. FILES CHANGED

**Content Pass 1 (real-content integration):**
- `src/content/home.ts` — added `aboutPreview`; strengthened `whyPhoenixPoints`
- `src/content/about.ts` — strengthened `philosophyPoints`; populated `leadership` with Dr. N. Krithika
- `src/content/programs.ts` — strengthened descriptions/skills/developmentAreas for Beginner, Intermediate, Advanced, and Professional Chess Training; added a name-confirmation code comment on Professional Chess Training
- `src/components/home/AboutPhoenix.tsx` — now consumes `aboutPreview` from the content layer instead of hardcoded JSX text
- `src/app/(public)/about/page.tsx` — updated philosophy-points destructure for the new "Individual Student Development" point; leadership section now renders Dr. N. Krithika's preview instead of the empty-state fallback
- `MEDIA_MAPPING.md` — added the founder portrait requirement
- `PHOENIX_REAL_CONTENT_MASTER.md` — this document (new)

**Content Pass 2 (cleanup + content-lock):**
- Deleted `src/components/home/ProgramCard.tsx` (confirmed-unreferenced orphan from before Phase 5's program-data consolidation)
- `src/content/about.ts` — `visionMissionDraft.vision`/`.mission` replaced with the re-supplied source-supported draft wording
- New `src/content/training.ts` — the single authoritative 8-item training methodology source, with `getTrainingMethodology()`/`getTrainingMethodologyForProgram(slug)` selection helpers
- `src/content/programs.ts` — removed the old placeholder `TrainingApproachStep`/`trainingApproachSteps` (superseded by `training.ts`)
- `src/components/programs/TrainingApproach.tsx` — now reads from `training.ts`; added an optional `programSlug` prop that filters to the relevant subset instead of always showing all 8 items
- `src/app/(public)/programs/[slug]/page.tsx` — passes `programSlug={program.slug}` to `TrainingApproach`
- `PHOENIX_REAL_CONTENT_MASTER.md` — Sections 2, 6, 7, 20, and Owner Confirmation Register items 18/19/23 updated

**Content Pass 3 (confirmed content lock):**
- `src/config/site.ts` — `siteConfig.contact` populated with the confirmed phone, WhatsApp, email, and address
- `src/components/ui/ContactDetails.tsx` — added a WhatsApp `wa.me` link and full address formatting (line2/postalCode now included)
- `src/content/about.ts` — `leadership[0]` gained a `credentials` field with the three confirmed founder credentials; role updated to "Founder and Director"
- `src/app/(public)/about/page.tsx` — leadership teaser now shows credential labels
- `src/app/(public)/about/leadership/page.tsx` — full profile now shows credential labels as a pill list
- `src/lib/seo/organization.ts` — **no code change** (already conditionally includes telephone/email/address; populating `siteConfig` was sufficient)
- `PHOENIX_REAL_CONTENT_MASTER.md` — Sections 2, 3, 4, 11, 15, 16, 17, 20, and the Owner Confirmation Register updated to promote the newly-confirmed facts

**Not touched:** `src/lib/seo/course.ts`, `src/content/coaches.ts` (no
coach data was supplied — founder is leadership, not a coach), any
Supabase/R2/Google Sheets/auth-related code, `siteConfig.social` (still
empty — no social URL confirmed), any international branch content.

---

## 21. WHAT REMAINS UNPUBLISHED / DEFERRED

Everything listed as OWNER CONFIRMATION REQUIRED in Sections 3–15,
consolidated in the register below (Section 22). Nothing in that
register has been published in any form — not as a footnote, not as
"unverified but likely," not as a softened paraphrase.

---

## 22. OWNER CONFIRMATION REGISTER

| # | Item | What's needed from the owner | Current site state |
|---|---|---|---|
| 1 | ~~AICF trainer credential~~ | **RESOLVED** — owner confirmed "All India Chess Federation Trainer" | **Published** in `leadership[0].credentials` |
| 2 | ~~"World Recorder" wording~~ | **RESOLVED** — owner confirmed the exact phrase "WORLD RECORDER" is approved for public use as-is | **Published verbatim** in `leadership[0].credentials`; do not rewrite without separate future confirmation |
| 3 | ~~"20+ years" experience claim~~ | **RESOLVED** — owner confirmed "20+ years of experience in chess" | **Published** in `leadership[0].credentials` |
| 4 | ~~Phone number~~ | **RESOLVED** — owner confirmed +91 63696 87328 is current | **Published** in `siteConfig.contact.phone`, renders as `tel:` link |
| 5 | ~~Official email~~ | **RESOLVED** — owner confirmed info@phoenixchessacademy.org as the current official email; the old Gmail address is explicitly not current | **Published** in `siteConfig.contact.email`, renders as `mailto:` link |
| 6 | ~~Current business address~~ | **RESOLVED** — owner confirmed the Madipakkam address is current | **Published** in `siteConfig.contact.address` |
| 6b | Official WhatsApp number | **RESOLVED** (added, not in the original register) — owner confirmed same number as phone | **Published** in `siteConfig.contact.whatsapp`, renders as `wa.me` link |
| 7 | Canada branch claim | Confirm whether a physical branch currently exists | Not published |
| 8 | Germany branch claim | Confirm whether a physical branch currently exists | Not published |
| 9 | London branch claim | Confirm whether a physical branch currently exists | Not published |
| 10 | New York branch claim | Confirm whether a physical branch currently exists | Not published |
| 11 | Tournament frequency claim | Resolve the conflicting frequency statements from source material | Not published; `featuredTournament` stays `null` |
| 12 | Under-2000 rating restriction for tactical training | Confirm whether this eligibility rule is still in effect | Not published on any program |
| 13 | Exact class/session duration | Confirm real figures if the academy wants duration published | Not published on any program |
| 14 | Academy training frequency (sessions per week) | Confirm real figures if the academy wants this published | Not published |
| 15 | "Professional Chess Training" exact official program name | Confirm the program's real public-facing name | Published under the working name "Professional Chess Training," flagged in code |
| 16 | "Combo Training Formula" — is this the current public name? | Confirm current preferred naming | Not published |
| 17 | "Phoenix Competitive Development Approach" — is this the current public name? | Confirm current preferred naming (mutually exclusive with #16 unless both are used for different things) | Not published |
| 18 | Vision statement — final sign-off | Confirm whether the Content Pass 2 draft wording ("To expand access to structured chess education, nurture young talent, and create opportunities for students to develop through disciplined, competitive, and meaningful chess learning.") can be promoted to CONFIRMED, or provide different official wording | SOURCE-SUPPORTED DRAFT in use, not owner-confirmed |
| 19 | Mission statement — final sign-off | Confirm whether the Content Pass 2 draft wording ("To provide structured and accessible chess training through focused coaching, practical learning, tactical development, and competitive experience, helping students strengthen their chess skills, concentration, discipline, and confidence.") can be promoted to CONFIRMED, or provide different official wording | SOURCE-SUPPORTED DRAFT in use, not owner-confirmed |
| 20 | Official social media profile URLs | Confirm real, active profile links | `siteConfig.social` remains all empty |
| 21 | Specific student achievements / champions | Supply real names, results, tournaments, and photo consent | `achievements`/`champions` remain empty arrays |
| 22 | Founder's academic/coaching qualifications | Confirm what backs the "Dr." title and any coaching certification, if the academy wants it published | Not published beyond the name itself |
| 23 | 8-item training methodology — final sign-off | Confirm whether the restored 8-item methodology in `src/content/training.ts` can be promoted to CONFIRMED, or provide corrections | SOURCE-SUPPORTED DRAFT in use (see Section 7), not owner-confirmed |

**Register status after Content Pass 3:** items 1–6 (plus 6b) are
resolved and now published as CONFIRMED content. Items 7–23 remain
open — none of them appear anywhere on the live site, verified manually
against every changed file plus a full-text search of the built HTML
output (see validation section of the Phase 6 completion report). In
particular, items 7–10 (international branches) and item 12 (the
under-2000 rating restriction) were not part of this confirmed-content
request and remain fully unpublished and unconfirmed.
