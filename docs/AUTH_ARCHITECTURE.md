# Authentication & Role Security Architecture (Phase 9)

This document describes the authentication and authorization foundation
built in Phase 9: Supabase Auth integration, the role system, protected
routes, password reset, logout, and the security boundaries every future
phase must respect. It does not cover student/parent/coach/admin
dashboard features, attendance, payments, or admin user-management UI —
none of that exists yet; see "Portal Placeholder Rule" below.

## Supabase Auth Is the Source of Truth

Supabase Auth (`auth.users`) is the only credential store. There is no
custom password table, no password hash in `profiles`, no custom JWT
issuance, and no plaintext password logging anywhere in this codebase.
Every login goes through `supabase.auth.signInWithPassword()`
(`src/lib/actions/auth.ts`); every password change goes through
`supabase.auth.updateUser()`; every sign-out goes through
`supabase.auth.signOut()`. Session cookies are managed exclusively by
`@supabase/ssr` (`src/lib/supabase/server.ts`, `src/proxy.ts`) — nothing
in this app manually parses a JWT, copies a token to `localStorage`, or
invents its own auth cookie.

## Profiles Relationship

`public.profiles` (created in Phase 7, `supabase/migrations/0002_profiles_and_roles.sql`)
maps 1:1 to `auth.users.id` and carries `full_name`, `email`, `phone`,
`role`, `active`. A Supabase Auth user and a Phoenix profile are two
different things: authenticating successfully with Supabase only proves
"this is a real credential." It does **not** by itself grant portal
access — see "Profile Requirement" below.

## No Public Signup

There is no `/signup` route, and there never has been one in this
codebase — confirmed by a full-repository search before this phase
started. No visitor can choose "I am a Student / Coach / Admin" and
create that role. Phoenix has 5,000+ students and several operational
roles; accounts are provisioned through a controlled staff/admin
workflow (see "Profile Bootstrap Architecture" below), not
self-registration. The login page (`src/app/(auth)/login/page.tsx`)
deliberately shows no "Create Account" / "Register" link of any kind.

## Role Architecture

The `user_role` Postgres enum (`STUDENT | PARENT | COACH | STAFF | ADMIN
| SUPER_ADMIN`, all upper-case, defined in
`supabase/migrations/0002_profiles_and_roles.sql`) is mirrored exactly by
the TypeScript `Role` union in `src/lib/auth/roles.ts` — same six values,
same casing. This is the only place a role name is spelled out as a
union type; every other file imports `Role` from here. Do not introduce
a second, differently-cased role representation anywhere.

### Role-to-Home Mapping

`src/lib/auth/roles.ts` exports the single authoritative mapping:

```
STUDENT     -> /portal
PARENT      -> /parent
COACH       -> /coach
STAFF       -> /admin
ADMIN       -> /admin
SUPER_ADMIN -> /admin
```

Every place in the app that needs to know "where does this role go"
calls `getRoleHome(role)` — the login action, the auth callback, and
every protected layout's wrong-role redirect. There is no second switch
statement anywhere re-deriving this mapping. STAFF/ADMIN/SUPER_ADMIN
currently share `/admin`; a future phase may split STAFF into its own
area if the academy's permission model diverges, but that split is not
decided or implemented now.

### Auth Profile Type

`src/lib/auth/types.ts` defines `AuthProfile`: `id`, `fullName`, `email`,
`phone`, `role`, `active` — five fields, not the full `profiles` row (no
`created_at`/`updated_at`, no internal audit columns). This is the only
shape passed around server code and, when genuinely needed, down to a
Client Component (e.g. the protected shell showing a name).

## Profile Requirement Enforcement

An authenticated Supabase Auth user **without** a matching `profiles`
row must never receive portal access, and must never be silently
defaulted to STUDENT. `getCurrentProfile()`
(`src/lib/auth/getCurrentProfile.ts`) returns `null` — not a synthesized
profile — when the row doesn't exist, when the stored role doesn't match
the known `Role` union, or when Supabase isn't configured. Every caller
(`requireRole()`, the login action, the auth callback) treats `null` as
"deny access," never as "assume STUDENT." The `profiles.role` column
does have a `DEFAULT 'STUDENT'` in the schema (Phase 7) — that default
only applies if a row is actually inserted; the app-layer code never
inserts a profile on the auth user's behalf.

## Active Profile Enforcement

`profiles.active` is checked everywhere a profile is checked. If
`active` is `false`: the login action denies sign-in and immediately
signs the Supabase Auth session back out (`src/lib/actions/auth.ts`);
the auth callback does the same; `requireRole()` redirects an
already-authenticated request to `/login?error=ACCOUNT_UNAVAILABLE`. The
message shown is always the neutral "Your Phoenix account is currently
unavailable. Please contact Phoenix Chess Academy for assistance." —
internal suspension reasons are never exposed.

## Server Auth Helpers

All in `src/lib/auth/`, all server-only (`import "server-only"`):

- `getCurrentUser.ts` — resolves the raw Supabase Auth user from request
  cookies, or `null` if there is no session or Supabase isn't
  configured. Never throws.
- `getCurrentProfile.ts` — resolves the narrow `AuthProfile`, or `null`
  per "Profile Requirement Enforcement" above.
- `requireAuth.ts` — redirects to `/login` if there's no session at all;
  returns the raw `User` otherwise. Used where only "is someone signed
  in" matters, not role.
- `requireRole.ts` — the authoritative gate for every protected layout;
  see "Protected Layout Architecture" below for its exact behavior.
- `roles.ts` — `Role` type, `ROLES`, `isRole()`, `getRoleHome()`,
  `PORTAL_ALLOWED_ROLES`.
- `safeRedirect.ts` — `resolveSafeInternalPath()`, the open-redirect
  guard used by `/auth/callback`.
- `errors.ts` — safe error codes, safe user-facing messages, and
  `logAuthEvent()` (see "Auth Logging Security" below).

No permission-framework library, auth context provider, Redux, Zustand,
or React Query was installed for any of this — Supabase's own SSR
session cookies plus these plain server functions are sufficient for
Phase 9's role-level authorization.

## Protected Layout Architecture

Each of the four protected segments has a Server Component layout that
calls `requireRole()` once, before rendering any page inside it:

| Route | Layout | Allowed roles |
|---|---|---|
| `/portal/*` | `src/app/portal/layout.tsx` | STUDENT |
| `/parent/*` | `src/app/parent/layout.tsx` | PARENT |
| `/coach/*` | `src/app/coach/layout.tsx` | COACH |
| `/admin/*` | `src/app/admin/layout.tsx` | STAFF, ADMIN, SUPER_ADMIN |

`requireRole(allowedRoles)` (`src/lib/auth/requireRole.ts`), in order:

1. No session at all -> redirect to plain `/login` (the expected,
   non-error case for an anonymous visitor).
2. Session exists but no `profiles` row -> redirect to
   `/login?error=PROFILE_MISSING`.
3. Profile exists but `active` is `false` -> redirect to
   `/login?error=ACCOUNT_UNAVAILABLE`.
4. Profile is valid and active but its role isn't in `allowedRoles` ->
   redirect to **that role's own home** via `getRoleHome()` — e.g. a
   STUDENT hitting `/admin` lands on `/portal`, never an "access denied"
   page stating the required role.
5. Otherwise, the resolved `AuthProfile` is returned to the layout, which
   passes it into the shared `ProtectedShell` component
   (`src/components/portal/ProtectedShell.tsx`).

This means a student cannot reach `/admin`'s architecture, a coach
cannot reach `/parent`'s, and a parent cannot reach `/portal`'s — each
non-matching role is bounced to its own home, never shown the other
segment's layout or page at all (the redirect happens before any child
content renders).

### Security Boundary — This Is Not the Only Layer

**Layout protection guards page rendering only.** It does not
automatically protect a Server Action or Route Handler defined inside
that segment. Any future sensitive Server Action (e.g. a coach marking
attendance, an admin editing a user) **must call `requireRole()` (or
equivalent) itself**, independently of whatever layout happens to wrap
the page that invoked it. This is a explicit, permanent rule, not a
Phase 9-only caveat — see the Next.js proxy documentation's own warning
that a routing change can silently remove coverage, and treat every
Server Action/Route Handler as needing its own authorization check.

## Login Architecture

Single canonical login route: `/login`
(`src/app/(auth)/login/page.tsx`). There is no second, competing login
experience anywhere in the app.

Flow:

1. Server Component checks `getCurrentProfile()` on render; an
   already-authenticated user with a valid, active profile is redirected
   straight to `getRoleHome(profile.role)` rather than shown the form
   again.
2. `LoginForm` (`src/components/forms/LoginForm.tsx`, Client Component)
   does client-side Zod validation (UX only) via `loginSchema`
   (`src/lib/validation/auth.ts`), then calls the `login()` Server
   Action (`src/lib/actions/auth.ts`) inside `useTransition`.
3. `login()`: checks `isSupabaseConfigured()` first (fails safely with
   `AUTH_UNAVAILABLE` if not) -> checks the auth rate limiter -> re-
   validates with `loginSchema` -> calls
   `supabase.auth.signInWithPassword()` -> on success, resolves
   `getCurrentProfile()`; if missing or inactive, **signs the session
   back out** and returns a safe failure message (never leaves a
   lingering session with no portal access); otherwise redirects to
   `getRoleHome(profile.role)`.

### Login Validation

`loginSchema` (`src/lib/validation/auth.ts`) checks only an email shape
and that a password was typed at all — no password-complexity regex on
login. The password already exists under whatever rule applied when it
was created; rejecting a valid existing password against a new frontend
regex would lock someone out of a real account for no security benefit.
Real authentication happens via Supabase, not this schema.

## Session / Proxy Architecture

Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
(confirmed directly from the framework's own bundled docs,
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`,
"Migration to Proxy" — `middleware` is deprecated). `src/proxy.ts`
exports a named `proxy(request)` function and a `matcher` config
excluding static assets, image optimization, and metadata files.

Its **only** job is to refresh the Supabase Auth session cookie (the
standard `@supabase/ssr` pattern: read cookies from the request, create
a server client, call `supabase.auth.getUser()` to trigger a refresh if
needed, write any updated cookies onto the response). If Supabase isn't
configured, it passes the request through unchanged rather than
throwing. **It makes no authorization decision** — no role check, no
path-based access rule. That responsibility belongs entirely to the
protected layouts (`requireRole()`), which remain authoritative even
though the proxy also runs on every matched request.

## Supabase Cookie Handling

`src/lib/supabase/server.ts` (`getServerSupabaseClient()`, from Phase 7,
unchanged in shape) uses `@supabase/ssr`'s `createServerClient` with
`cookies().getAll()` / `cookies().set()` from `next/headers`. The
`setAll` callback is wrapped in try/catch because Server Component
rendering cannot mutate cookies — that's expected and handled by the
proxy's own separate cookie-refresh path. Route Handlers and Server
Actions (which _can_ mutate cookies) rely on this same client, e.g.
`/auth/callback` and every action in `src/lib/actions/auth.ts`. No file
in this codebase manually parses a JWT, stores a token in
`localStorage`, or invents a custom auth cookie name.

## Auth Callback Architecture

`src/app/auth/callback/route.ts` (a Route Handler, `GET`):

1. Reads `code` and `next` from the query string.
2. If Supabase isn't configured: redirect to
   `/login?error=AUTH_UNAVAILABLE`.
3. If there's no `code`: redirect to `/login?error=SESSION_ERROR`.
4. Calls `supabase.auth.exchangeCodeForSession(code)`. On failure:
   redirect to `/login?error=SESSION_ERROR` — never a raw Supabase error
   message, never the code itself echoed into a redirect URL.
5. `next` is passed through `resolveSafeInternalPath()`
   (`src/lib/auth/safeRedirect.ts`) before ever being used — only an
   internal relative path (starts with a single `/`, not `//`, not
   containing `://`, not `javascript:`) is honored. This closes the
   open-redirect path a maliciously crafted callback link could
   otherwise attempt (`/auth/callback?code=...&next=https://evil.example`).
6. If a safe `next` was given (currently only the password-recovery
   flow, `?next=/reset-password`), redirect there directly.
7. Otherwise (normal sign-in callback): resolve the profile exactly like
   `requireRole()` does — missing or inactive profile never grants
   access, and the session is signed back out in either case.

## Forgot Password Architecture

`/forgot-password` (`src/app/(auth)/forgot-password/page.tsx`,
`ForgotPasswordForm`, `requestPasswordReset()` in
`src/lib/actions/auth.ts`) collects only an email. It calls
`supabase.auth.resetPasswordForEmail(email, { redirectTo })`, where
`redirectTo` is built from `getSiteUrl()` (`src/config/site.ts` —
resolves `NEXT_PUBLIC_SITE_URL`, falling back to the production
`https://www.phoenixchessacademy.org`; already existed from Phase 7, reused
as-is rather than duplicated) pointed at
`/auth/callback?next=/reset-password`.

### Account Enumeration Protection

`requestPasswordReset()` returns the **exact same** neutral,
success-shaped result in every case: unknown email, real email,
Supabase not configured, and rate-limited. It never says "email not
found," "no user exists," or anything that would reveal whether an
account — let alone its role — exists. The message shown is: "If an
eligible Phoenix account exists for this email, password reset
instructions will be sent." A validation failure (not an email-shaped
string at all) is the one case surfaced distinctly, since it reveals
nothing about account existence.

## Reset Password Architecture

`/reset-password` (`src/app/(auth)/reset-password/page.tsx`,
`ResetPasswordForm`, `updatePassword()` in `src/lib/actions/auth.ts`)
requires the recovery session already established by `/auth/callback` —
it does not itself accept an email or token. `updatePassword()` checks
for a real session (`supabase.auth.getUser()`); if none exists (a
stale/expired/already-used link visited directly), it returns
`RESET_FAILED` without pretending anything changed. On success, it calls
`supabase.auth.updateUser({ password })`, then **deliberately signs the
session back out** and redirects to `/login?reset=success` rather than
granting immediate portal access — this was the chosen option over
redirecting straight to the role home, so that profile/active checks
always happen fresh through the normal login path rather than being
skipped right after a password change.

### Password Requirements

`resetPasswordSchema` (`src/lib/validation/auth.ts`): minimum 8
characters, plus a confirmation-match check. No emoji, uppercase-count,
or symbol-count rules. This is the one auth schema that enforces a real
requirement, since it's setting a brand-new credential rather than
checking an existing one.

## Accept Invite Architecture

`/accept-invite` (`src/app/(auth)/accept-invite/page.tsx`, `AcceptInviteForm`,
`acceptInvite()` in `src/lib/actions/auth.ts`) is the destination for the
student/parent/coach account-invitation flow built in
`src/lib/actions/admin/accounts.ts` (see
docs/ADMIN_OPERATIONS_ARCHITECTURE.md, "Account Provisioning"). It exists
because `supabase.auth.admin.inviteUserByEmail()` needs an explicit
`redirectTo` — without one, Supabase falls back to the bare Site URL,
which has no code to handle an invite link at all.

Flow:

1. `provisionAccount()` calls `inviteUserByEmail(email, { data, redirectTo:
   getSiteUrl() + "/auth/callback?next=/accept-invite" })` — the same
   `redirectTo`-into-`/auth/callback` pattern `requestPasswordReset()`
   already uses for `/reset-password` — and inserts the `profiles` row
   with **`active: false`** (see "Account Activation Lifecycle" below).
2. The invited user clicks the email link -> `/auth/callback?code=...
   &next=/accept-invite` -> `exchangeCodeForSession(code)` establishes a
   session -> `next` is validated by `resolveSafeInternalPath()` -> redirect
   to `/accept-invite`. If the code is missing or the exchange fails (an
   expired/already-consumed invite — including the common case of an
   email client or security scanner pre-fetching and consuming the
   single-use link before the real click), `/auth/callback` redirects to
   `/accept-invite` itself rather than `/login`, specifically when
   `next=/accept-invite` — that page's own no-session branch (step 3)
   renders the friendly expired message. The password-reset failure path
   (`next=/reset-password`) is untouched: it still redirects to
   `/login?error=SESSION_ERROR`, exactly as before.
3. `AcceptInvitePage` (Server Component) calls `getCurrentUser()` itself
   before rendering: no valid session (an expired, already-used, or never-
   exchanged invite link) shows a friendly "Invitation expired — ask your
   administrator to send a new invitation" message instead of a broken
   form. This is a stricter, page-level check than `/reset-password` uses,
   since an invite is often the very first thing a new user does and
   should never show a confusing form under it.
4. `AcceptInviteForm` collects a new password (same `resetPasswordSchema`
   as `/reset-password` — no separate password-rule schema was
   introduced) and calls `acceptInvite()`.
5. `acceptInvite()` re-checks the session itself (`supabase.auth.getUser()`),
   calls `supabase.auth.updateUser({ password })`, then calls
   `finishAcceptInvite()`, which activates the profile (see below) and —
   **unlike** `updatePassword()` — does **not** sign the session back out
   on success. It resolves `getCurrentProfile()` and redirects straight to
   `getRoleHome(profile.role)`, since accepting an invite should land the
   user directly in their portal. A missing profile still signs the
   session out and denies access, matching every other auth path's
   behavior.

### Account Activation Lifecycle

An invited account must never gain portal access before the invited
user actually creates a password — the Supabase session created by
merely exchanging the invite code is not, by itself, sufficient.
`provisionAccount()` therefore inserts the `profiles` row with
**`active: false`**, not `true`. `requireRole()`'s existing active check
means such a profile is blocked from every protected route exactly like
a deactivated one, until it is explicitly activated:

- `activate_own_profile()` (SECURITY DEFINER RPC,
  `supabase/migrations/0029_profile_activation.sql`) is the **only** path
  that ever flips an invited profile's `active` to `true`. It is
  zero-argument, always scoped to `auth.uid()` internally — never a
  caller-supplied profile id — and its `UPDATE` is conditioned atomically
  on a separate column, `invite_accepted_at is null`, in its own `WHERE`
  clause. This makes activation a strictly **one-time** transition:
  calling it again once `invite_accepted_at` is already set is a
  harmless no-op (`returns false`), and — critically — it can never be
  used to silently reactivate an account an admin has since deactivated
  via `deactivateAccount()`, since that account's `invite_accepted_at` is
  already non-null from its original onboarding.
- `invite_accepted_at` is a separate, one-way lifecycle marker,
  deliberately not folded into `active` — `active` remains the
  admin-togglable "is this account currently allowed in" flag;
  `invite_accepted_at` instead records "has this profile ever completed
  its own first-password-creation step," and is never touched by
  `deactivateAccount()`/`reactivateAccount()`.
- `finishAcceptInvite()` (`src/lib/actions/auth.ts`, shared by
  `acceptInvite()` and `retryProfileActivation()`) calls
  `supabase.rpc("activate_own_profile")` through the ordinary anon-key
  server client — no service-role client is involved, since the RPC's
  own `SECURITY DEFINER` privilege (not a broadened client) is what lets
  it write a row `profiles`' RLS otherwise grants no write policy for at
  all (`profiles_select_own` remains SELECT-only — see "Profile RLS
  Review"). The client can still never reach `profiles.active` directly:
  `Insert`/`Update` are typed `never` in `src/lib/supabase/types.ts`.
- If the password update succeeds but `activate_own_profile()` fails (or
  reports the profile still inactive), `acceptInvite()` returns
  `{ success: false, activationFailed: true }` rather than pretending
  onboarding finished. `AcceptInviteForm` reads that flag and swaps to a
  distinct "Retry Activation" view — no password fields, since the
  password is already set — whose button calls
  `retryProfileActivation()`, which re-verifies the session and re-runs
  `finishAcceptInvite()` alone.

`/accept-invite` is excluded from the sitemap and disallowed in
`robots.ts`, and uses `buildMetadata({ index: false })`, identically to
every other auth route.

## Password UI Security

`PasswordField` (`src/components/forms/PasswordField.tsx`) defaults to
`type="password"`, exposes an accessible show/hide toggle
(`aria-label`/`aria-pressed`, switches to `type="text"` only on explicit
user click), and never persists a password value anywhere outside React
state — no `localStorage`, `sessionStorage`, cookies, URL, or logs. It
does not disable paste and does not block password managers.

## Logout Architecture

`logout()` (`src/lib/actions/auth.ts`): if Supabase is configured, calls
`supabase.auth.signOut()` (clearing the session through the supported
`@supabase/ssr` cookie mechanism — no manually-guessed cookie deletion);
then redirects to `/` (the public homepage), consistently, every time.
`ProtectedShell` (`src/components/portal/ProtectedShell.tsx`) renders
the logout control as a plain `<form action={logout}>` — no client JS
required for this action.

## Auth Error Architecture

`src/lib/auth/errors.ts` defines a closed set of safe, user-facing
categories: `INVALID_CREDENTIALS`, `ACCOUNT_UNAVAILABLE`,
`PROFILE_MISSING`, `AUTH_UNAVAILABLE`, `RATE_LIMITED`,
`VALIDATION_FAILED`, `RESET_REQUEST_ACCEPTED`, `RESET_FAILED`,
`SESSION_ERROR`, `UNKNOWN`. `resolveAuthErrorCode()` maps any
unrecognized string (e.g. a tampered `?error=` query value) to
`UNKNOWN`. No raw Supabase/Postgres error text, no `"relation profiles
does not exist"`, no `"JWT expired"`, no Postgres error code, and no
`"service role"` string is ever shown to a user — every path that could
fail maps through this file first.

## Auth Logging Security

`logAuthEvent()` (`src/lib/auth/errors.ts`) logs only: event category
(`login` | `logout` | `forgot_password` | `reset_password` |
`auth_callback` | `profile_resolution`), the safe error code, an
optional correlation ID, and a timestamp. It never logs passwords,
access tokens, refresh tokens, full session objects, Supabase auth
headers, cookie values, or reset links — and deliberately omits the
email address too, so a production log never becomes a record of who
attempted to log in, only what kind of outcome occurred.

## Auth Rate Limiting Foundation

`getAuthRateLimiter()` (`src/lib/rate-limit/index.ts`) is a separate
`InMemoryRateLimiter` instance (5 attempts / 60s per key) from the
existing form-submission limiter — brute-force login attempts and
public-form spam are different abuse patterns worth tracking
independently, even though the underlying implementation and its
production limitation are identical. `login()` keys on
`login:<email>`; `requestPasswordReset()` keys on
`forgot-password:<email>`; a rate-limited forgot-password request still
returns the same neutral message (see "Account Enumeration Protection").

**Production limitation, carried over from Phase 7 and still true:**
`InMemoryRateLimiter` is **not** production-safe on Vercel/serverless —
each invocation may run in a different, short-lived function instance
with no shared state across instances or cold starts. It only catches
the crudest same-instance abuse. A real distributed limiter (e.g.
Upstash Redis, per Vercel's own guidance) is a future-phase requirement;
Phase 9 does not install a paid service and does not pretend this limiter
is sufficient alone.

## Profile RLS Review

Reviewed `supabase/migrations/0010_rls_policies.sql`: `profiles` has
exactly one policy, `profiles_select_own` (`authenticated`, `auth.uid()
= id`, **SELECT only**). There is no INSERT, UPDATE, or DELETE policy at
all. Under Postgres RLS's default-deny model, this means **no
authenticated user — student, coach, or otherwise — can modify their own
`role` or `active` column, or any other column, of their own `profiles`
row.** This already satisfies Phase 9's RLS review requirement with
**no new migration needed** — see "Database Migration" below.

## Profile Bootstrap Architecture

There is no public signup, and Phase 9 does not build an admin
user-creation UI. The intended future flow (not implemented yet):

1. An authorized staff/admin user, through a controlled admin process
   built in a later phase, creates or invites an account.
2. A server-side process (never a direct client insert, since
   `profiles.Insert`/`Update` are typed as `never` in
   `src/lib/supabase/types.ts` specifically to make an accidental
   `.from("profiles").insert(...)` fail to compile) creates the
   `profiles` row with an explicitly-approved role.
3. No trigger automatically converts every new `auth.users` row into a
   usable STUDENT profile — Phoenix has no public signup, so there is no
   scenario where an arbitrary new auth user should silently become a
   student.

## First SUPER_ADMIN Bootstrap Procedure

No fake admin credentials are seeded anywhere in this codebase — no
`admin@phoenixchessacademy.org`, no placeholder password, nothing
committed. To create the first SUPER_ADMIN once Supabase is live:

1. Create the first user through the **Supabase Auth Dashboard** (or an
   equivalent controlled admin process) — set a real email and a real
   password there directly. Do not do this through the public app (there
   is no signup route to do it through anyway).
2. Copy that user's UUID from `auth.users` (visible in the Supabase
   Dashboard's Authentication > Users list).
3. In the Supabase SQL Editor, run:

   ```sql
   insert into public.profiles (id, full_name, email, phone, role, active)
   values (
     '<AUTH_USER_UUID>',
     '<FULL_NAME>',
     '<EMAIL>',
     null,
     'SUPER_ADMIN',
     true
   )
   on conflict (id) do update
     set role = 'SUPER_ADMIN',
         active = true,
         full_name = excluded.full_name,
         email = excluded.email;
   ```

4. Verify the row: `select id, full_name, email, role, active from
   public.profiles where id = '<AUTH_USER_UUID>';` — confirm `role =
   'SUPER_ADMIN'` and `active = true`.
5. Sign in at `/login` with that email/password — it should land on
   `/admin`.

No real password is ever placed in SQL; the SQL step only assigns the
profile row and role, never a credential.

## Database Migration Created Or Not Required

**No new migration was created in Phase 9.** The existing Phase 7
schema and RLS (`0002_profiles_and_roles.sql`, `0010_rls_policies.sql`)
already satisfy every Phase 9 database requirement:

- `user_role` enum and `profiles` table already exist with the exact
  roles this phase uses.
- `profiles_select_own` already restricts write access to nothing (no
  self-update path exists to close).

The only Phase 9 change to `src/lib/supabase/types.ts` (the hand-written
TypeScript `Database` type, not a SQL migration) was adding a `profiles`
entry alongside the existing `reporting_outbox` entry, with
`Insert`/`Update` typed as `never` (see "Profile Bootstrap Architecture"
above). If a future phase needs to insert/update profiles from the app
layer (e.g. an admin user-management UI), that will require both a real
`Insert`/`Update` type here and a corresponding RLS policy — neither
exists yet, by design.

## Portal Placeholder Rule

`/portal`, `/parent`, `/coach`, `/admin` remain minimal, honest
placeholders. Each shows only: the Phoenix logo, a portal context label
("Student Portal", "Parent Portal", "Coach Portal", "Administration"),
the signed-in user's name if available, a logout control, and a
back-to-website link (all via the shared `ProtectedShell`,
`src/components/portal/ProtectedShell.tsx`) — plus one sentence of page
content stating that role's dashboard features are built in a later
phase. None of them show fake attendance percentages, chess ratings,
upcoming classes, student names, coach assignments, payment records, or
tournament registrations. No sidebar navigation to nonexistent features
was built — there are no dead links to Attendance/Progress/
Certificates/Students/Payments/Reports anywhere in these shells.

## Auth SEO

`/login`, `/forgot-password`, `/reset-password`, and all four protected
portal routes use `buildMetadata({ index: false })`
(`src/lib/seo/metadata.ts`), which sets `robots: { index: false, follow:
false }`. `robots.ts` additionally disallows `/login`,
`/forgot-password`, `/reset-password`, `/auth/callback`, `/admin`,
`/portal`, `/parent`, `/coach`, and `/api/internal` as extra crawler
guidance on top of the per-page metadata — belt-and-suspenders, not a
substitute for it. `sitemap.ts` (Phase 8) never included any auth or
portal route to begin with; re-verified in Phase 9, no change needed.

## Auth Accessibility

Real `<label htmlFor>` elements (not placeholder-only inputs);
`autoComplete="email"` / `"current-password"` / `"new-password"` on the
relevant fields; the password show/hide button has an accessible
`aria-label` that changes with state and `aria-pressed`; every field
wires `aria-describedby` to its hint/error text via `useId()`-generated
ids (`FormField`, `PasswordField`); errors render with `role="alert"`;
the login success/notice banner uses `role="status"`. No custom focus
suppression, no disabled paste, no password-manager blocking.

## Auth Performance Decisions

Every auth page is a Server Component by default; `LoginForm`,
`ForgotPasswordForm`, `ResetPasswordForm`, and `PasswordField` are
Client Components only because they need interactivity
(`useState`/`useTransition`, the show/hide toggle). No Redux, Zustand,
React Query, or auth-context provider was installed — Supabase's own
SSR session cookies, read via the plain server helpers in
`src/lib/auth/`, are sufficient. The profile is resolved once per
request at the layout boundary (`requireRole()`), not re-fetched by
nested child components.

## Known Limitations

- The in-memory rate limiter is not distributed-safe on serverless — see
  "Auth Rate Limiting Foundation."
- Live Supabase configuration is deferred; the exact end-to-end tests
  below have not been executed against a real project.
- No admin UI exists yet to create/invite users or change roles —
  today's only path is the manual SQL bootstrap procedure above.
- `STAFF`, `ADMIN`, and `SUPER_ADMIN` all share `/admin` with identical
  access; no permission distinction between them exists yet.

## Exact Live Supabase Auth Setup Needed Later

1. Create/confirm the Supabase project referenced by
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In Supabase Auth settings, confirm the **Site URL** and **Redirect
   URLs** allow-list includes `https://www.phoenixchessacademy.org/auth/callback`
   (and `http://localhost:3000/auth/callback` for local dev) — Supabase
   rejects a redirect it hasn't been told to trust, independent of this
   app's own `resolveSafeInternalPath()` check.
3. Configure Google Workspace SMTP (not Supabase's default mailer) so
   `inviteUserByEmail`/`resetPasswordForEmail` reliably deliver mail — see
   `docs/EMAIL_SMTP_CONFIGURATION.md` for the exact Dashboard values, DNS
   records, and email template setup.
4. Set `NEXT_PUBLIC_SITE_URL=https://www.phoenixchessacademy.org` in
   production env vars (see `.env.example`).
5. Run the First SUPER_ADMIN Bootstrap Procedure above.
6. Execute the live test plan below.

## Exact First SUPER_ADMIN Creation Steps

See "First SUPER_ADMIN Bootstrap Procedure" above — the two sections are
intentionally the same content; this heading exists to match the
required Phase 9 report structure.

## Exact Live Auth Test Plan

To run once Supabase is actually connected (not executed in this phase):

1. Unauthenticated visits to `/portal`, `/parent`, `/coach`, `/admin`
   each redirect to `/login`.
2. A STUDENT profile logs in -> lands on `/portal`; manually visiting
   `/admin` redirects back to `/portal`; visiting `/coach` redirects back
   to `/portal`.
3. A PARENT profile logs in -> lands on `/parent`; other segments bounce
   back to `/parent`.
4. A COACH profile logs in -> lands on `/coach`; other segments bounce
   back to `/coach`.
5. A STAFF profile logs in -> lands on `/admin`.
6. An ADMIN profile logs in -> lands on `/admin`.
7. A SUPER_ADMIN profile logs in -> lands on `/admin`.
8. An `auth.users` row with **no** matching `profiles` row attempts
   login -> denied, safe `PROFILE_MISSING` message, no portal access.
9. A `profiles` row with `active = false` attempts login -> denied, safe
   `ACCOUNT_UNAVAILABLE` message, no portal access.
10. Full password reset: request at `/forgot-password` -> receive email
    -> follow link to `/auth/callback?...&next=/reset-password` ->
    land on `/reset-password` -> set new password -> redirected to
    `/login?reset=success` -> old password fails, new password succeeds.
11. Logout from any portal -> redirected to `/`; the previously-protected
    route now redirects to `/login` again when revisited.

## Security Risks Deferred To Future Phases

- Distributed rate limiting (current limiter is in-memory only).
- Admin UI for user creation, invitation, and role management.
- Any permission distinction between STAFF/ADMIN/SUPER_ADMIN beyond all
  three sharing `/admin`.
- Auditing/logging of who performed a role change, once a role-change UI
  exists.
- Return-path support after an unauthenticated redirect to `/login`
  (deliberately not built in Phase 9 to avoid open-redirect risk before
  it's genuinely needed — see `resolveSafeInternalPath`, which exists
  today only for `/auth/callback`'s internal `next` parameter).
