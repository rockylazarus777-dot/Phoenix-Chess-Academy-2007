# Email / SMTP Configuration — Google Workspace Migration

This is the single reference for moving Phoenix Chess Academy's transactional
auth email (invite, password reset) off Supabase's default mailer and onto
Google Workspace SMTP (`noreply@phoenixchessacademy.org`).

## Why this is a Dashboard change, not a code change

This app never sends email itself. It only calls two Supabase Auth API
methods — `supabase.auth.admin.inviteUserByEmail()`
(`src/lib/actions/admin/accounts.ts`) and `supabase.auth.resetPasswordForEmail()`
(`src/lib/actions/auth.ts`) — and Supabase's own backend (GoTrue) decides
how the resulting email is actually delivered. That decision is a
**Supabase project setting**, configured in the Dashboard, completely
independent of this repo's code or its `.env.local`. Nothing in
`src/` changes as part of this migration.

## What you need before starting

1. A Google Workspace mailbox at `noreply@phoenixchessacademy.org` (create
   it in the Google Workspace Admin console if it doesn't exist yet).
2. 2-Step Verification **enabled** on that account — required before
   Google will let you generate an App Password.
3. Owner/admin access to the Supabase project's Dashboard.
4. DNS access for `phoenixchessacademy.org` (registrar or wherever DNS is
   hosted) for the SPF/DKIM/DMARC steps below.

## Step 1 — Generate a Google App Password

1. Sign in to `noreply@phoenixchessacademy.org` (or an admin account
   managing it).
2. Google Account -> Security -> 2-Step Verification -> App passwords.
3. Create a new app password (name it something like "Supabase SMTP").
4. Copy the generated 16-character password immediately — Google shows it
   once. **Do not paste it into any file in this repo, any `.env` file,
   Slack, or a commit message.** Paste it directly into the Supabase
   Dashboard field in Step 2, then discard your clipboard/notes.

## Step 2 — Enable Custom SMTP in Supabase

Supabase Dashboard -> your project -> **Authentication -> Emails -> SMTP Settings**.
Toggle **Enable Custom SMTP** and enter exactly:

| Field | Value |
|---|---|
| Sender email | `noreply@phoenixchessacademy.org` |
| Sender name | `Phoenix Chess Academy` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `noreply@phoenixchessacademy.org` |
| Password | *(the App Password from Step 1 — pasted only here)* |
| Minimum interval between emails | Leave at Supabase's default unless you have a specific reason to change it |

Port `465` is SMTP-over-SSL (implicit TLS) — do not also enable a
separate STARTTLS toggle if the Dashboard offers one; 465 already
implies SSL. Save.

**This password is stored encrypted by Supabase and is never re-displayed.**
It does not need to exist in this repo, in `.env.local`, or in any CI/CD
secret store for this app, because this app never reads it — only
Supabase's own backend uses it.

## Step 3 — Verify the Site URL / Redirect URL allow-list

Still in the Dashboard: **Authentication -> URL Configuration**.

- **Site URL**: `https://www.phoenixchessacademy.org`
- **Redirect URLs** must include: `https://www.phoenixchessacademy.org/auth/callback`
  (and, for local development only, `http://localhost:3000/auth/callback`)

This must exactly match `NEXT_PUBLIC_SITE_URL` in the app's production
environment (see `.env.example`) and `src/config/site.ts`'s fallback
constant — both were audited and corrected to the `www` subdomain as part
of this change (see the "Files changed" section of the implementation
report). A mismatch here is what caused the original
`otp_expired`/`access_denied` invite failures, independent of which SMTP
provider sends the mail.

## Step 4 — Update the email templates

Dashboard -> **Authentication -> Emails -> Templates**. Two templates are
actually used by this app (confirmed by grep — there is no magic-link
sign-in and no self-service signup anywhere in the codebase, so the
"Magic Link" and "Confirm signup" templates are not exercised by any
flow and were intentionally left as Supabase's defaults):

| Template | Source file in this repo | Triggered by |
|---|---|---|
| **Invite user** | `supabase/templates/invite.html` | `inviteUserByEmail()` — coach/parent/student provisioning |
| **Reset Password** | `supabase/templates/recovery.html` | `resetPasswordForEmail()` — forgot-password flow |

For each: open the corresponding file in this repo, copy its full HTML
contents, and paste over the existing template body in the Dashboard.
Both use only the `{{ .ConfirmationURL }}` variable — the same one this
app's `redirectTo` values already rely on. Do not add `{{ .Token }}` /
`{{ .TokenHash }}` — this app's `/auth/callback` expects the code-exchange
link `{{ .ConfirmationURL }}` produces, not a raw token.

Branding in both templates is pulled directly from `src/app/globals.css`
(brand gold `#d4a72c`, deep navy `#101828`, ivory background `#f7f4ec`)
and the real logo at `/public/images/brand/phoenix-logo.jpg`, referenced
by its absolute production URL (email clients cannot load relative paths
or localhost).

## Step 5 — DNS: SPF, DKIM, DMARC

These are what make Google Workspace mail from `@phoenixchessacademy.org`
land in inboxes instead of spam, and are unrelated to Supabase — they're
domain-level records Google Workspace itself requires/recommends. Add
these in your DNS provider for `phoenixchessacademy.org`:

- **SPF**: a single `TXT` record on the domain root authorizing Google:
  `v=spf1 include:_spf.google.com ~all`
  (if an SPF record already exists, merge — do not add a second `TXT`
  record with `v=spf1`, which breaks SPF evaluation).
- **DKIM**: Google Workspace Admin console -> Apps -> Google Workspace ->
  Gmail -> Authenticate email -> generate a DKIM key for
  `phoenixchessacademy.org`, then add the exact `TXT` record it gives you
  (host is typically `google._domainkey`). Enable it in the Admin console
  once DNS propagates.
- **DMARC**: a `TXT` record at `_dmarc.phoenixchessacademy.org`, e.g.
  `v=DMARC1; p=quarantine; rua=mailto:info@phoenixchessacademy.org`
  Start with `p=quarantine` (or even `p=none` to only monitor) rather than
  `p=reject` until you've confirmed legitimate mail passes SPF/DKIM
  consistently, then tighten later.

## Step 6 — Remove the old dependency

Once custom SMTP is enabled and verified working (Step 7 below), Supabase
stops using its own default mailer for this project entirely — there is
no separate "disable default mailer" toggle; enabling custom SMTP *is*
the switch. This also resolves the earlier "email rate limit exceeded"
errors, since those were specifically Supabase's default-mailer rate
limit, not a limit this app or Google Workspace imposes.

## Step 7 — Testing sequence

Run these in order against the real Supabase project, after Steps 1-4:

1. **Coach invite**: `/admin/coaches/[id]` -> Invite portal account ->
   confirm email arrives from `Phoenix Chess Academy <noreply@phoenixchessacademy.org>`,
   renders correctly (desktop + mobile mail client), and the button link
   lands on `/accept-invite` after `/auth/callback`.
2. **Parent invite**: same, from `/admin/parents/[id]`.
3. **Student invite**: same, from `/admin/students/[id]`.
4. **Password reset**: `/forgot-password` with a known account email ->
   confirm the reset email arrives, link lands on `/reset-password`.
5. Complete one full invite -> `/accept-invite` -> create password ->
   confirm activation and redirect to the correct role home
   (`/coach` / `/parent` / `/portal`).
6. Confirm no email arrives for an unknown email submitted to
   `/forgot-password` (this is expected — see "Account Enumeration
   Protection" in `docs/AUTH_ARCHITECTURE.md`; the *response* is neutral
   either way, but only a real account should actually receive mail).
7. Check the sending mailbox's Gmail "Sent" folder (Google Workspace SMTP
   sends will appear there) to confirm delivery attempts are actually
   going out, and check Google Workspace's Email Log Search (Admin
   console -> Reporting) for any bounce/defer/reject events.

## Error handling — what changes, what doesn't

Nothing in this app's error handling changes. `getSafeAuthMessage()` /
`getSafeAdminMessage()` (`src/lib/auth/errors.ts`, `src/lib/admin/errors.ts`)
already never surface a raw Supabase error to the browser — including
whatever Supabase returns if the SMTP relay itself is unreachable, rejects
credentials, or times out. This app only ever sees Supabase's own opaque
`{ error }` result from `inviteUserByEmail()` / `resetPasswordForEmail()`,
already mapped to a safe generic message
(`"The invitation could not be sent..."` /
`"If an eligible Phoenix account exists..."`). SMTP-specific failure
detail (invalid credentials, connection timeout, Google-side quota) is
only visible in Supabase's own Auth Logs, not in this app — that's a
monitoring concern for whoever administers the Supabase project, not
something to add speculative try/catch for here.
