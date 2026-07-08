-- =============================================================================
-- 0002_profiles_and_roles.sql
-- =============================================================================
-- Future account/role foundation. NO authentication UI, NO seed accounts,
-- NO fake users are created here — this is schema only, ready for
-- Supabase Auth to be wired up in a later phase (student/parent/coach/
-- staff/admin portals are explicitly out of scope for Phase 7).

create type public.user_role as enum (
  'STUDENT',
  'PARENT',
  'COACH',
  'STAFF',
  'ADMIN',
  'SUPER_ADMIN'
);

-- `profiles.id` is designed to equal `auth.users.id` (a 1:1 extension
-- table), the standard Supabase pattern — NOT a separate identity
-- system. No password/credential columns exist here: Supabase Auth
-- owns all credential storage.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  -- ROLE SECURITY: default is the least-privileged role. Nothing in this
  -- migration lets a browser-supplied value become the initial role —
  -- see 0010_rls_policies.sql, "profiles" section, and
  -- docs/DATABASE_ARCHITECTURE.md, "Role Security", for the enforcement
  -- plan once a profile-creation trigger/RPC is added in a later phase.
  -- A student must never be able to self-assign ADMIN/SUPER_ADMIN.
  role public.user_role not null default 'STUDENT',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Future account/role foundation, 1:1 with auth.users. No auth UI or seed accounts exist yet (Phase 7 is database foundation only).';
comment on column public.profiles.role is
  'Role changes must go through a server-authorized path once role-change UI exists — never accept an arbitrary role value directly from a public insert/update.';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;
-- Policies for this table are defined in 0010_rls_policies.sql, grouped
-- with every other table's RLS policies so the security posture of the
-- whole schema can be reviewed in one place.
