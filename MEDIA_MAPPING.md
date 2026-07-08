# PHOENIX CHESS ACADEMY — MEDIA MAPPING

This file tracks every media placeholder in the codebase so real assets can
be dropped in later without touching component code. Replace a file at the
listed path (same filename, same aspect ratio) and the site updates
automatically — no code changes required.

---

## LOGO

### PHOENIX CHESS ACADEMY OFFICIAL LOGO
- **Status: official asset in use.** The real logo is live at
  `/public/images/brand/phoenix-logo.jpg`, rendered exclusively through
  the `Logo` component (`src/components/ui/Logo.tsx`) — every navbar,
  footer, hero, and auth-layout usage goes through that one component.
- Current path: `/public/images/brand/phoenix-logo.jpg`
- Current format: JPEG
- Current dimensions: 638 × 638
- Aspect ratio: 1:1 (circular gold medallion — Phoenix bird, crown,
  "PHOENIX CHESS ACADEMY · CHENNAI" ring text, "I RISE" / "LIKE A PHOENIX
  FROM THE ASHES" accent text)
- Current file size: ~62.6 KB
- Current limitation: white background is baked into the raster image —
  not faked as transparent via any CSS blend-mode/filter.
- Future recommendation: replace with an official transparent PNG or
  vector SVG of the exact same approved logo when available. Do not
  auto-remove the background and do not generate a replacement logo in
  the meantime.
- Known legibility note: as a circular medallion with ring text (not a
  compact wordmark), the academy name is hard to read at small navbar
  heights (~28–36px). Flagged in `Logo.tsx` — no workaround has been
  applied without being asked. Options if this matters: size the navbar
  mark up, or supply a simplified wordmark for small placements.
- Used in: Navbar, Footer, Hero section, `(auth)` layout — all via the
  `Logo` component. Not yet used in Open Graph images or Organization
  structured data (`logo` field is still intentionally omitted from
  JSON-LD in `src/lib/seo/organization.ts` — safe to wire up now that a
  real file exists, will be included from Phase 4 onward).
- Instructions:
  - Do not redesign, recolor, distort, crop, or add glow/shadow to the logo.
  - Preserve the original aspect ratio (1:1 — `Logo.tsx` renders width = height).
  - Do not rename the JPEG to `.png`/`.svg` without an actual format conversion.

---

## PHASE 3 MEDIA AUDIT — HOME PAGE

| Asset | Path | Width × Height | Aspect Ratio | Format | Max Size | Section | Cropping Guidance | Mobile Variant | Priority Load |
|---|---|---|---|---|---|---|---|---|---|
| Hero poster (desktop) | `/public/images/home/hero/hero-desktop.webp` | 1920×1080 | 16:9 | WebP/AVIF | 350 KB | Hero | Subject centered or right-weighted so hero text (left-aligned) doesn't overlap faces | Yes — see mobile row | Yes (`priority`) |
| Hero poster (mobile) | `/public/images/home/hero/hero-mobile.webp` | 828×1472 | 9:16 | WebP/AVIF | 220 KB | Hero | Vertical crop, subject upper-middle | — | Yes (`priority`) |
| Hero video (desktop) | `/public/videos/home/phoenix-hero-desktop.webm` | 1920×1080 | 16:9 | WebM (H.264 MP4 fallback optional) | 6 MB, ≤20s loop | Hero | Calm, cinematic motion — avoid fast cuts that fight the text overlay | Yes — see mobile row | No (lazy after poster) |
| Hero video (mobile) | `/public/videos/home/phoenix-hero-mobile.webm` | 828×1472 or 1080×1920 | 9:16 | WebM | 3 MB, ≤20s loop | Hero | Same as desktop, reframed vertical | — | No |
| About Phoenix image | `/public/images/home/about/about-phoenix.webp` | 1600×1200 | 4:3 | WebP/AVIF | 500 KB | About Phoenix | Training-in-progress shot; avoid busy backgrounds behind copy area | No | No |
| Program image — Beginner Chess | `/public/images/programs/beginner-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Clear single subject, board visible | No | No |
| Program image — Intermediate Chess | `/public/images/programs/intermediate-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Same as above | No | No |
| Program image — Advanced Chess | `/public/images/programs/advanced-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Same as above | No | No |
| Program image — Professional Training | `/public/images/programs/professional-training.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Same as above | No | No |
| Program image — Tournament Preparation | `/public/images/programs/tournament-preparation.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Same as above | No | No |
| Program image — Online Chess Coaching | `/public/images/programs/online-chess-coaching.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Programs | Screen/online session shot | No | No |
| Achievement photo (×3–6) | `/public/images/achievements/achievement-01.webp` … `achievement-06.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB each | Student Achievements | Student clearly visible, name-worthy moment | No | No |
| Champion photo (×1–8, if Hall of Fame is populated) | `/public/images/achievements/champion-01.webp` … | 800×800 | 1:1 | WebP/AVIF | 250 KB each | Hall of Fame | Portrait crop, centered face | No | No |
| Coach photo (×1 per coach) | `/public/images/coaches/coach-01.webp` … | 800×800 | 1:1 | WebP/AVIF | 250 KB each | Meet Our Coaches | Portrait crop, neutral background preferred | No | No |
| Academy video thumbnail | `/public/images/home/video/academy-video-thumbnail.webp` | 1280×720 | 16:9 | WebP/AVIF | 200 KB | Video Experience | Clear, high-contrast frame — this is the clickable facade image | No | No |
| Tournament highlight (×1–6) | `/public/images/tournaments/highlights/highlight-01.webp` … `highlight-06.webp` | 1200×1200 | 1:1 (home grid) | WebP/AVIF | 300 KB each | Tournament Highlights | Action/competition moments, not posed group photos only | No | No |

Video files are placeholders in the codebase (`HeroMedia` component) — until
real, optimized video exists, the hero renders the poster image only,
which is the correct and expected behavior.

---

## PHASE 3 PRIORITY MEDIA CHECKLIST

Provide these first — everything else in the audit table above can follow
once these are in:

1. **Hero poster — desktop and mobile.** Without this the hero currently
   shows only the dark background scrim (no failure, just empty).
2. **About Phoenix image.**
3. **One image per program** (6 total) — beginner through online coaching.
4. **Confirmed trust statistics** beyond the one already in use (5,000+
   students) — coaches count, tournaments conducted, champions produced,
   locations/countries — or explicit confirmation to leave them out for now.

Everything below renders an honest fallback/CTA state (not fake content)
until real data exists, so it is **not blocking** for Phase 3 to look
complete, but provide when ready:

5. Coach roster (photo + name + role, real data — no invented titles/FIDE ratings)
6. Student achievement photos + real names/results
7. Champion photos + names (for Hall of Fame to appear at all)
8. Real testimonial quotes + names (for that section to appear at all)
9. A confirmed academy YouTube video ID + thumbnail
10. Tournament highlight photos
11. A confirmed upcoming tournament (name/date/venue/categories) if one exists

---

## FUTURE ASSET REQUESTS (not needed yet)

Requested in their respective phases, not now:
- Full program detail page media (Phase 5)
- Tournament detail page media per event (Phase 6)
- Full gallery albums (Phase 6+)
- Full YouTube video library with titles/categories (Phase 6+)
- Official social media profile URLs — for `sameAs` structured data (already wired in `src/lib/seo/organization.ts`, populates automatically once `src/config/site.ts` has real URLs)
- Physical address, phone, email — for `LocalBusiness`/Organization structured data (same file, same mechanism)

None of the above will be fabricated. Placeholders and fallback states
remain clearly marked/honest until real values are supplied.

---

## PHASE 4 MEDIA AUDIT — ACADEMY INFORMATION PAGES

| Asset | Path | Width × Height | Aspect Ratio | Format | Max Size | Page | Section | Cropping Guidance | Mobile Variant | Priority Load |
|---|---|---|---|---|---|---|---|---|---|---|
| Academy training image | `/public/images/about/academy-training.webp` | 1600×1200 | 4:3 | WebP/AVIF | 400 KB | /about | Academy Philosophy | Training-in-progress, coach + student both visible if possible | No | No |
| Chess development image | `/public/images/about/chess-development.webp` | 1600×1200 | 4:3 | WebP/AVIF | 400 KB | /about | Chess Development Approach | Close-up board/tactics work | No | No |
| Training culture image | `/public/images/about/training-culture.webp` | 1600×1200 | 4:3 | WebP/AVIF | 400 KB | /about | Training Culture | Group training session, discipline-focused | No | No |
| Competitive chess image | `/public/images/about/competitive-chess.webp` | 1600×1200 | 4:3 | WebP/AVIF | 400 KB | /about | Competitive Chess Focus | Tournament-style setting if available | No | No |
| Leadership photo (×1 per leader, if populated) | `/public/images/leadership/leader-01.webp` … | 800×800 | 1:1 | WebP/AVIF | 250 KB | /about/leadership | Leadership | Portrait crop, professional | No | No |
| Coach photo (×1 per coach, if populated) | `/public/images/coaches/coach-01.webp` … | 800×800 | 1:1 | WebP/AVIF | 250 KB | /coaches | Coach roster | Portrait crop | No | No |

No page hero image is required for Phase 4 — every interior page uses the
text-only `PageHero` component (no background photography), so there is no
`/about-hero.webp` requirement after all; the About page's first visual is
the Academy Philosophy section image above. If a genuine About page hero
photo is supplied later, `PageHero` can be extended to accept one.

---

## PHASE 4 PRIORITY MEDIA CHECKLIST

Not blocking — every Phase 4 page renders a complete, honest fallback
state without these. Provide when ready, roughly in this order:

1. The four About page section images (academy-training, chess-development, training-culture, competitive-chess)
2. Leadership profiles (photo + name + role + bio — real people only)
3. Coach roster (photo + name + role + confirmed chess title/FIDE rating if applicable — real coaches only)
4. Confirmed contact details (email/phone/address) — currently all empty in `src/config/site.ts`, so the Contact page and Footer show no contact info at all
5. Official social media profile URLs, if any

---

## PHASE 5 MEDIA AUDIT — PROGRAM SYSTEM

### Card vs. hero image — sharing decision

Card images render at a fixed 4:3 aspect ratio inside a bounded card
(`ProgramCard`), while the program detail hero (`ProgramHero`) is a
full-bleed background behind page text that needs to hold up across very
wide desktop viewports (1920px+) without an awkward crop or an
over-zoomed subject. A 4:3 card image stretched to fill a wide hero
background would either crop the subject badly or look zoomed-in on
large screens.

**Recommendation: use a separate, wider hero image per program** rather
than reusing the 4:3 card image at hero size. Until real hero-specific
photography exists, the code already falls back to the card image for
the hero (`getProgramHeroImage()` in `src/content/programs.ts` returns
`heroImage ?? cardImage`), so nothing breaks in the meantime — this is a
recommendation for better cropping quality, not a blocker.

| Asset | Path | Width × Height | Aspect Ratio | Format | Max Size | Card Usage | Hero Usage | Cropping Guidance | Object Position | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Beginner Chess (card) | `/public/images/programs/beginner-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes — /programs grid, home preview | Fallback only | Clear single subject, board visible | center | No |
| Beginner Chess (hero, recommended) | `/public/images/programs/heroes/beginner-chess-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes — program detail hero background | Wider scene, subject off-center so hero text (left-aligned) has room | center or "center 30%" | Yes |
| Intermediate Chess (card) | `/public/images/programs/intermediate-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes | Fallback only | Same as above | center | No |
| Intermediate Chess (hero, recommended) | `/public/images/programs/heroes/intermediate-chess-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes | Same as above | center | Yes |
| Advanced Chess (card) | `/public/images/programs/advanced-chess.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes | Fallback only | Same as above | center | No |
| Advanced Chess (hero, recommended) | `/public/images/programs/heroes/advanced-chess-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes | Same as above | center | Yes |
| Professional Training (card) | `/public/images/programs/professional-training.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes | Fallback only | Same as above | center | No |
| Professional Training (hero, recommended) | `/public/images/programs/heroes/professional-training-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes | Competitive/tournament-style setting if available | center | Yes |
| Tournament Preparation (card) | `/public/images/programs/tournament-preparation.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes | Fallback only | Same as above | center | No |
| Tournament Preparation (hero, recommended) | `/public/images/programs/heroes/tournament-preparation-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes | Same as above | center | Yes |
| Online Chess Coaching (card) | `/public/images/programs/online-chess-coaching.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | Yes | Fallback only | Screen/online session shot | center | No |
| Online Chess Coaching (hero, recommended) | `/public/images/programs/heroes/online-chess-coaching-hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | No | Yes | Same as above | center | Yes |

`imagePosition` on a `Program` entry (e.g. `"center"`, `"center top"`,
`"40% center"`) is passed straight to CSS `object-position` per program —
set it only if a specific crop needs adjusting; it's optional and unset
by default.

---

## PHASE 5 PROGRAM MEDIA CHECKLIST

**Only six images are required right now** — the six card images listed
above, at the paths already wired into `src/content/programs.ts`:

1. `/public/images/programs/beginner-chess.webp`
2. `/public/images/programs/intermediate-chess.webp`
3. `/public/images/programs/advanced-chess.webp`
4. `/public/images/programs/professional-training.webp`
5. `/public/images/programs/tournament-preparation.webp`
6. `/public/images/programs/online-chess-coaching.webp`

These six alone make both `/programs` (cards) and every `/programs/[slug]`
detail page (hero, via the automatic card-image fallback) fully
functional — nothing is blocking on the separate hero crops.

**Optional, once you have them:** the six wider hero-specific images in
the `/public/images/programs/heroes/` table above, for better cropping on
large desktop screens. Not required to ship Phase 5.

---

## CONTENT PASS 1 MEDIA ADDITION — FOUNDER / LEADERSHIP PORTRAIT

Dr. N. Krithika (Founder & Director) was added to `src/content/about.ts`
`leadership` during the real-content integration pass. This supersedes
the generic placeholder row in the Phase 4 table above for this specific
person.

| Asset | Path | Width × Height | Aspect Ratio | Format | Max Size | Page | Section | Cropping Guidance | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Dr. N. Krithika — founder portrait | `/public/images/leadership/dr-n-krithika.webp` | 1200×1500 | 4:5 | WebP/AVIF | 350 KB | /about, /about/leadership | Leadership | Professional portrait, centered, plain/neutral background, face clearly visible | No |

Notes:
- Do not extract, screenshot, or crop this image from any existing PDF
  or old-website source — a proper, original image file is expected to
  be supplied directly.
- Until this file exists, `next/image` will 404 on the `<Image>` request
  for this path on `/about` (leadership preview) and `/about/leadership`
  (full profile). Placing a real file at this exact path resolves both
  automatically — no code changes needed.
- This entry uses a taller 4:5 portrait ratio rather than the generic
  1:1 leadership placeholder in the Phase 4 table, to better suit a
  single featured founder portrait. If additional leadership members are
  added later at 1:1, keep this founder entry at 4:5 or update both the
  code (`about/page.tsx`, `about/leadership/page.tsx`) and this entry
  together.

---

## PHASE 6 MEDIA AUDIT — TOURNAMENT SYSTEM

The owner has confirmed real Phoenix tournament photography and video
exist and will be supplied directly — nothing here is stock media, a
PDF screenshot, or an external/placeholder image.

### Per-tournament media architecture

No tournament records exist yet (`src/content/tournaments.ts` →
`tournaments` is an empty array), so no specific file paths are required
right now. Once a real tournament is added, its media follows this
folder convention:

```
/public/images/tournaments/[tournament-slug]/
  hero.webp
  card.webp
  gallery-01.webp
  gallery-02.webp
  gallery-03.webp
  ...
  winner-01.webp
  winner-02.webp
  ...
```

| Asset | Path pattern | Width × Height | Aspect Ratio | Format | Max Size | Used by | Priority |
|---|---|---|---|---|---|---|---|
| Tournament card image | `/public/images/tournaments/[slug]/card.webp` | 800×600 | 4:3 | WebP/AVIF | 250 KB | `TournamentCard`, `/tournaments` grid | No |
| Tournament hero image | `/public/images/tournaments/[slug]/hero.webp` | 1920×1080 | 16:9 | WebP/AVIF | 400 KB | `TournamentHero` on `/tournaments/[slug]` (falls back to `card.webp` via `tournament.heroImage ?? tournament.cardImage` if not supplied) | Yes (above the fold) |
| Gallery image (×N) | `/public/images/tournaments/[slug]/gallery-NN.webp` | 1200×1200 | 1:1 | WebP/AVIF | 300 KB each | `TournamentGallery` | No — always `loading="lazy"` |
| Winner photo (×N, optional) | `/public/images/tournaments/[slug]/winner-NN.webp` | 400×400 | 1:1 | WebP/AVIF | 150 KB each | `TournamentWinners` | No |

**Not all files are required per tournament** — the `Tournament` type
(`heroImage`, `gallery`, `winners[].photo`) makes every one of these
optional except `cardImage`, and every consuming component
(`TournamentGallery`, `TournamentWinners`) renders nothing at all when
its array is empty, rather than showing broken image placeholders.

### Video

No tournament video architecture exists in this phase — Phase 6 only
built the photo-based `TournamentGallery`. If the owner wants embedded
tournament video, that should be scoped as a future addition (likely
reusing the Phase 3 `VideoExperience`/`VideoFacade` pattern already
built for the academy overview video) rather than added ad hoc.

### Priority-loading rule (per Phase 6 instructions)

- Only the tournament detail hero image (`TournamentHero`) uses
  `priority` — it's the only above-the-fold tournament image.
- Tournament cards (`TournamentCard`) never use `priority`.
- Gallery images (`TournamentGallery`) always lazy-load.
- Winner images (`TournamentWinners`) never use `priority`.

---

## PHASE 8 MEDIA AUDIT — ACHIEVEMENTS, CHAMPIONS, GALLERY, VIDEOS, BLOG

The owner has confirmed real Phoenix photos/video exist and will be
supplied directly — nothing in this phase uses stock, AI-generated, or
placeholder imagery. All five content sources
(`src/content/achievements.ts`, `champions.ts`, `gallery.ts`,
`videos.ts`, `blog.ts`) are empty arrays today, so no specific file path
is required yet — the specs below apply once real records are added.

### Achievements

| Asset | Path pattern | Width × Height | Aspect Ratio | Format | Max Size | Used by |
|---|---|---|---|---|---|---|
| Achievement image | `/public/images/achievements/[slug].webp` | 1600×1200 | 4:3 | WebP/AVIF | 350 KB | `/achievements`, `AchievementsShowcase`, `ProgramAchievements` |

### Champions

| Asset | Path pattern | Width × Height | Aspect Ratio | Format | Max Size | Used by |
|---|---|---|---|---|---|---|
| Champion portrait | `/public/images/champions/[slug].webp` | 1200×1500 | 4:5 | WebP/AVIF | 350 KB | `/champions`, `HallOfFame` |

### Gallery

Do not force every gallery image into one crop — use whichever of the
three shapes below actually fits the source photo, keyed by filename
convention `/public/images/gallery/[category]/[descriptive-name].webp`
(category folder = lowercase `GalleryCategory` value, e.g. `tournament`,
`training`, `academy`).

| Asset | Width × Height | Aspect Ratio | Format | Max Size |
|---|---|---|---|---|
| Gallery landscape | 1600×1200 | 4:3 | WebP/AVIF | 350 KB |
| Gallery portrait | 1200×1500 | 4:5 | WebP/AVIF | 350 KB |
| Gallery wide | 1920×1080 | 16:9 | WebP/AVIF | 400 KB |

Note on the `INTERNATIONAL` category: this labels media context only
(e.g. an online session with an international student). Do not caption
or crop any `INTERNATIONAL`-tagged image in a way that implies Phoenix
operates a physical branch outside Chennai.

### Videos

No new image assets are required for `/videos` beyond what's already
optional per `VideoItem.thumbnail` — when unset, `getVideoThumbnail()`
falls back to YouTube's own hosted thumbnail
(`https://i.ytimg.com/vi/[youtubeVideoId]/hqdefault.jpg`) via the
existing Phase 3 `VideoFacade` architecture, so a custom thumbnail is
optional, not blocking. Do not invent a YouTube video ID to unblock this
page — it must stay empty until a real one is supplied.

### Blog

| Asset | Path pattern | Width × Height | Aspect Ratio | Format | Max Size | Used by |
|---|---|---|---|---|---|---|
| Blog cover image | `/public/images/blog/[slug]/cover.webp` | 1600×900 | 16:9 | WebP/AVIF | 400 KB | `/blog`, `/blog/[slug]`, `ResourcesPreview` |

`coverImage` is optional on `BlogPost` — a post without one simply omits
the image block on both the listing card and the article header; this
is not a blocking requirement to publish a post.

### Phase 8 priority checklist

Nothing above is blocking — every one of the five new routes
(`/achievements`, `/champions`, `/gallery`, `/videos`, `/blog`) renders a
complete, honest, non-empty-looking page today via its empty-state
introduction. Provide, in rough priority order once available:

1. Original tournament/training photography for `/gallery` (this also
   powers the home page's `TournamentHighlights` preview once tagged
   `TOURNAMENT`).
2. Confirmed student achievement records + photos for `/achievements`.
3. Confirmed champion/Hall of Fame profiles + portraits for `/champions`.
4. A confirmed academy YouTube video ID (+ optional custom thumbnail) for
   `/videos` (this also powers the home page's `VideoExperience`
   preview).
5. Real, reviewed blog articles for `/blog` — written by/attributed to an
   actual person, never generated solely to fill the page.

