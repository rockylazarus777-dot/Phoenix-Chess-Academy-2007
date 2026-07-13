-- =============================================================================
-- 0029_profile_activation.sql
-- =============================================================================
-- Changes the invited-account lifecycle so a student/parent/coach never
-- gets portal access before creating a password. Previously
-- provisionAccount() (src/lib/actions/admin/accounts.ts) inserted
-- profiles.active = true at invite time — meaning the Supabase session
-- created by simply exchanging the invite code already satisfied
-- requireRole()'s active check, before the invited user ever submitted a
-- password on /accept-invite. See docs/AUTH_ARCHITECTURE.md, "Accept
-- Invite Architecture".
--
-- `invite_accepted_at` is a new, separate, one-way lifecycle marker —
-- deliberately NOT reusing `active` for two different meanings. `active`
-- remains the admin-togglable "is this account currently allowed in"
-- flag (deactivateAccount()/reactivateAccount()). `invite_accepted_at`
-- instead records "has this profile ever completed its own
-- first-password-creation step" and, once set, never changes again.
-- The activation RPC below only succeeds while it is still null — so an
-- admin who later deactivates a coach (active -> false) can never have
-- that coach silently reactivate themselves through this RPC: their
-- invite_accepted_at is already non-null from original onboarding, and
-- the RPC's own WHERE condition will never match again.
alter table public.profiles
  add column invite_accepted_at timestamptz;

comment on column public.profiles.invite_accepted_at is
  'Set exactly once, by activate_own_profile(), the moment an invited user successfully creates their first password. Never touched by deactivateAccount()/reactivateAccount(). Distinct from `active`: an onboarding-completion fact, not a togglable admin flag.';

-- ---------------------------------------------------------------------------
-- activate_own_profile — the ONLY path that flips profiles.active from
-- false to true as part of invite acceptance.
-- ---------------------------------------------------------------------------
-- Zero arguments: always scoped to auth.uid() internally, never a
-- caller-supplied profile id. SECURITY DEFINER so it can update a row
-- that `profiles`' own RLS grants no UPDATE policy for at all (see
-- 0010_rls_policies.sql, "profiles" — SELECT-own only, by design) —
-- the same pattern already used by every other write-RPC in this schema
-- (e.g. transition_class_session_status(), mark_session_attendance()).
--
-- The UPDATE is conditioned atomically on `invite_accepted_at is null`
-- in its own WHERE clause — not just checked earlier in the function —
-- so this can only ever fire once per profile, no matter how many times
-- or from how many concurrent requests it is called, and can never be
-- used to reactivate a profile an admin has since deactivated (whose
-- invite_accepted_at is already non-null from its original onboarding).
-- Returns true only when this call was the one that actually activated
-- the profile; false for an already-activated profile (a harmless no-op
-- retry) or a caller with no matching profiles row at all — never an
-- error for either of those two ordinary cases.
create or replace function public.activate_own_profile()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_id uuid;
begin
  update public.profiles
  set
    active = true,
    invite_accepted_at = now()
  where id = auth.uid()
    and invite_accepted_at is null
  returning id into v_updated_id;

  return v_updated_id is not null;
end;
$$;

comment on function public.activate_own_profile() is
  'The only path that flips profiles.active true as part of invite acceptance, called by acceptInvite()/retryProfileActivation() (src/lib/actions/auth.ts) after supabase.auth.updateUser({ password }) succeeds. Self-scoped to auth.uid(); the WHERE invite_accepted_at is null condition makes this a strictly one-time transition, never usable to reactivate a profile an admin has since deactivated. See docs/AUTH_ARCHITECTURE.md, "Accept Invite Architecture".';

revoke all on function public.activate_own_profile() from public;
grant execute on function public.activate_own_profile() to authenticated;
