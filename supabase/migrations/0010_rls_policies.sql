-- =============================================================================
-- 0010_rls_policies.sql
-- =============================================================================
-- GENERAL PRINCIPLE: every table already has `ENABLE ROW LEVEL SECURITY`
-- from its own migration. This file adds the actual policies. Where a
-- future role (STAFF/ADMIN/COACH/PARENT scoped access) genuinely needs a
-- table that doesn't exist yet (e.g. a parent-student link table), no
-- policy is written for it — see the deferred-policy comments below
-- instead of a policy referencing a nonexistent relationship.
--
-- No table in this migration gets `FOR SELECT USING (true)` if it can
-- contain PII or an unpublished lead/registration. Public catalog-style
-- tables (locations, programs, tournaments + their public sub-tables)
-- get a narrow, active-only public read policy because their content is
-- meant to be public once populated and contains no personal data.

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
-- A user may read their own profile once Supabase Auth exists (Phase 8+).
-- No INSERT/UPDATE/DELETE policy exists yet — profile creation will go
-- through a trigger on auth.users or a server-authorized RPC in a later
-- phase, exactly so a browser can never set its own `role`. See
-- docs/DATABASE_ARCHITECTURE.md, "Role Security".
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- DEFERRED (documented, not implemented — no policy references a table
-- that doesn't exist yet):
--   - STAFF/ADMIN/SUPER_ADMIN: full profiles access, once a staff-role
--     check helper exists (e.g. a `has_role(uid, role)` function).
--   - COACH: read profiles of students assigned to them, once a
--     coach_students (or similar) relationship table exists.
--   - PARENT: read profiles of their linked children, once a
--     parent_students (or similar) relationship table exists.

-- ---------------------------------------------------------------------------
-- ACADEMY LOCATIONS (public catalog data, no PII)
-- ---------------------------------------------------------------------------
create policy "academy_locations_public_read"
  on public.academy_locations
  for select
  to anon, authenticated
  using (active = true);

-- ---------------------------------------------------------------------------
-- PROGRAMS (public catalog data, no PII — table not yet consumed by the
-- website; policy exists so future consumption doesn't require an RLS
-- change)
-- ---------------------------------------------------------------------------
create policy "programs_public_read"
  on public.programs
  for select
  to anon, authenticated
  using (active = true);

-- ---------------------------------------------------------------------------
-- TOURNAMENTS + PUBLIC SUB-TABLES (public catalog data, no PII)
-- ---------------------------------------------------------------------------
create policy "tournaments_public_read"
  on public.tournaments
  for select
  to anon, authenticated
  using (active = true);

create policy "tournament_categories_public_read"
  on public.tournament_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_categories.tournament_id and t.active = true
    )
  );

create policy "tournament_schedule_items_public_read"
  on public.tournament_schedule_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_schedule_items.tournament_id and t.active = true
    )
  );

create policy "tournament_rule_sections_public_read"
  on public.tournament_rule_sections
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_rule_sections.tournament_id and t.active = true
    )
  );

create policy "tournament_documents_public_read"
  on public.tournament_documents
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_documents.tournament_id and t.active = true
    )
  );

create policy "tournament_faqs_public_read"
  on public.tournament_faqs
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_faqs.tournament_id and t.active = true
    )
  );

create policy "tournament_results_public_read"
  on public.tournament_results
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_results.tournament_id and t.active = true
    )
  );

create policy "tournament_winners_public_read"
  on public.tournament_winners
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_winners.tournament_id and t.active = true
    )
  );

create policy "tournament_media_public_read"
  on public.tournament_media
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_media.tournament_id and t.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- CONTACT ENQUIRIES / TRIAL BOOKINGS / TOURNAMENT REGISTRATIONS
-- ---------------------------------------------------------------------------
-- INTENTIONALLY NO POLICIES for anon or authenticated on any of these
-- three tables. RLS is enabled with zero matching policies, which means
-- anon/authenticated can neither SELECT nor INSERT/UPDATE/DELETE them —
-- the only way in is `submit_contact_enquiry` / `submit_trial_booking` /
-- `submit_tournament_registration` (SECURITY DEFINER, granted narrowly
-- in 0009_submission_functions.sql), and the only way to read them is
-- the service-role client (bypasses RLS entirely — see
-- src/lib/supabase/admin.ts). This is deliberate: these tables hold
-- personal information and unpublished business leads.
--
-- DEFERRED: STAFF/ADMIN read/update access via the Supabase dashboard or
-- a future internal staff UI, once a server-verified staff-role check
-- exists. Not implemented in Phase 7 (no admin dashboard exists yet).

-- ---------------------------------------------------------------------------
-- REPORTING OUTBOX
-- ---------------------------------------------------------------------------
-- INTENTIONALLY NO POLICIES for anon or authenticated. Only the
-- service-role sync worker touches this table.
