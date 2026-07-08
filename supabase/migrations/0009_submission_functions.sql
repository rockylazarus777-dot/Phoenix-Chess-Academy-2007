-- =============================================================================
-- 0009_submission_functions.sql
-- =============================================================================
-- Atomic public submission RPCs. Each function inserts the business
-- record AND its reporting_outbox event in one transaction — either both
-- happen or neither does, so a valid Supabase write can never silently
-- fail to queue a reporting event. See docs/DATABASE_ARCHITECTURE.md,
-- "Database Transactions" and docs/GOOGLE_SHEETS_REPORTING.md, "Why
-- Outbox Architecture".
--
-- These are the ONLY way public form data reaches these tables — there
-- are no anon/authenticated INSERT policies on contact_enquiries,
-- trial_bookings, or tournament_registrations (see
-- 0010_rls_policies.sql). Each function is SECURITY DEFINER (runs with
-- the privileges of the function owner, not the caller) and is granted
-- to `anon`/`authenticated` explicitly and narrowly — the grant is the
-- entire public write surface for these tables.
--
-- Business-rule scope, deliberately kept narrow (per Phase 7
-- instructions: "Do not put the entire application business layer into
-- SQL"): full Zod validation (shape, formats, cross-field rules) already
-- runs in the Server Action before this function is ever called — see
-- src/lib/actions/*.ts. These functions re-check only what is
-- genuinely a data-integrity concern that the database is positioned to
-- verify (tournament/category existence and current status, consent
-- flags actually being true, duplicate detection) — not a second copy
-- of the whole application validation layer.

-- ---------------------------------------------------------------------------
create or replace function public.submit_contact_enquiry(
  p_full_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_enquiry_type text,
  p_subject text,
  p_message text,
  p_source text default 'website'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.contact_enquiries (
    full_name, email, phone, country, enquiry_type, subject, message, source
  ) values (
    p_full_name, p_email, nullif(p_phone, ''), p_country, p_enquiry_type, p_subject, p_message, coalesce(nullif(p_source, ''), 'website')
  )
  returning id into v_id;

  insert into public.reporting_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'contact_enquiry.created',
    'contact_enquiry',
    v_id,
    jsonb_build_object(
      'id', v_id,
      'created_at', now(),
      'full_name', p_full_name,
      'email', p_email,
      'phone', p_phone,
      'country', p_country,
      'enquiry_type', p_enquiry_type,
      'subject', p_subject,
      'message', p_message,
      'status', 'NEW'
    )
  );

  return v_id;
end;
$$;

comment on function public.submit_contact_enquiry(text, text, text, text, text, text, text, text) is
  'Public entry point for Contact Form submissions. Always creates status = NEW; has no status parameter, so a client can never set RESOLVED/etc.';

grant execute on function public.submit_contact_enquiry(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.submit_trial_booking(
  p_student_full_name text,
  p_date_of_birth date,
  p_chess_level text,
  p_fide_id text,
  p_fide_rating integer,
  p_country text,
  p_state text,
  p_city text,
  p_preferred_program text,
  p_training_mode text,
  p_preferred_schedule text,
  p_goals text,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_parent_relationship text,
  p_privacy_acknowledged boolean,
  p_marketing_consent boolean,
  p_source text default 'website'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_fingerprint text;
begin
  if not coalesce(p_privacy_acknowledged, false) then
    raise exception 'PRIVACY_NOT_ACKNOWLEDGED' using errcode = 'P0001';
  end if;

  -- Soft, advisory duplicate-detection hint only — never used to reject
  -- a submission. See docs/DATABASE_ARCHITECTURE.md, "Duplicate
  -- Protection Strategy".
  v_fingerprint := md5(
    lower(trim(p_student_full_name)) || '|' || p_date_of_birth::text || '|' || lower(trim(p_preferred_program))
  );

  insert into public.trial_bookings (
    student_full_name, date_of_birth, chess_level, fide_id, fide_rating,
    country, state, city, preferred_program, training_mode, preferred_schedule, goals,
    parent_name, parent_email, parent_phone, parent_relationship,
    marketing_consent, submission_fingerprint, source
  ) values (
    p_student_full_name, p_date_of_birth, p_chess_level, nullif(p_fide_id, ''), p_fide_rating,
    p_country, p_state, p_city, p_preferred_program, p_training_mode, nullif(p_preferred_schedule, ''), nullif(p_goals, ''),
    nullif(p_parent_name, ''), nullif(p_parent_email, ''), nullif(p_parent_phone, ''), nullif(p_parent_relationship, ''),
    coalesce(p_marketing_consent, false), v_fingerprint, coalesce(nullif(p_source, ''), 'website')
  )
  returning id into v_id;

  insert into public.reporting_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'trial_booking.created',
    'trial_booking',
    v_id,
    jsonb_build_object(
      'id', v_id,
      'created_at', now(),
      'student_full_name', p_student_full_name,
      'date_of_birth', p_date_of_birth,
      'chess_level', p_chess_level,
      'fide_id', p_fide_id,
      'fide_rating', p_fide_rating,
      'country', p_country,
      'state', p_state,
      'city', p_city,
      'preferred_program', p_preferred_program,
      'training_mode', p_training_mode,
      'preferred_schedule', p_preferred_schedule,
      'guardian_name', p_parent_name,
      'guardian_email', p_parent_email,
      'guardian_phone', p_parent_phone,
      'status', 'NEW'
    )
  );

  return v_id;
end;
$$;

comment on function public.submit_trial_booking(text, date, text, text, integer, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, text) is
  'Public entry point for Book a Trial submissions. Guardian requirement for minors is enforced in the Server Action (shared calculateAge logic with the Zod schema) before this function is called; always creates status = NEW.';

grant execute on function public.submit_trial_booking(text, date, text, text, integer, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.submit_tournament_registration(
  p_tournament_slug text,
  p_category_key text,
  p_player_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_fide_id text,
  p_fide_rating integer,
  p_chess_association_id text,
  p_country text,
  p_state text,
  p_city text,
  p_email text,
  p_phone text,
  p_whatsapp text,
  p_parent_name text,
  p_parent_relationship text,
  p_parent_email text,
  p_parent_phone text,
  p_current_chess_level text,
  p_school_or_academy text,
  p_club text,
  p_rules_acknowledged boolean,
  p_privacy_acknowledged boolean,
  p_media_consent boolean,
  p_marketing_consent boolean,
  p_source text default 'website'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_category public.tournament_categories%rowtype;
  v_id uuid;
  v_age integer;
begin
  if not coalesce(p_rules_acknowledged, false) then
    raise exception 'RULES_NOT_ACKNOWLEDGED' using errcode = 'P0001';
  end if;
  if not coalesce(p_privacy_acknowledged, false) then
    raise exception 'PRIVACY_NOT_ACKNOWLEDGED' using errcode = 'P0001';
  end if;

  -- Tournament and category are ALWAYS resolved server-side from slug/key
  -- — a raw tournament_id/category_id is never accepted from the client.
  select * into v_tournament from public.tournaments where slug = p_tournament_slug and active = true;
  if not found then
    raise exception 'TOURNAMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_tournament.status <> 'REGISTRATION_OPEN' then
    raise exception 'REGISTRATION_NOT_OPEN' using errcode = 'P0001';
  end if;

  if not v_tournament.registration_enabled then
    raise exception 'REGISTRATION_NOT_ENABLED' using errcode = 'P0001';
  end if;

  if v_tournament.registration_close_date is not null and now() > v_tournament.registration_close_date then
    raise exception 'REGISTRATION_DEADLINE_PASSED' using errcode = 'P0001';
  end if;

  select * into v_category
    from public.tournament_categories
    where tournament_id = v_tournament.id and category_key = p_category_key;
  if not found then
    raise exception 'INVALID_CATEGORY' using errcode = 'P0001';
  end if;

  -- Coarse, secondary data-integrity check. The primary minor/guardian
  -- rule (identical calculateAge() logic to TrialForm) already ran in
  -- the Server Action's Zod superRefine before this function was ever
  -- called — this is a defense-in-depth backstop, not the source of
  -- truth for the rule.
  v_age := date_part('year', age(current_date, p_date_of_birth));
  if v_age < 18 and (nullif(p_parent_name, '') is null or nullif(p_parent_email, '') is null or nullif(p_parent_phone, '') is null) then
    raise exception 'GUARDIAN_INFO_REQUIRED' using errcode = 'P0001';
  end if;

  begin
    insert into public.tournament_registrations (
      tournament_id, category_id, player_full_name, date_of_birth, gender, fide_id, fide_rating,
      chess_association_id, country, state, city, email, phone, whatsapp,
      guardian_name, guardian_relationship, guardian_email, guardian_phone,
      current_chess_level, school_or_academy, club, media_consent, marketing_consent, source
    ) values (
      v_tournament.id, v_category.id, p_player_full_name, p_date_of_birth, nullif(p_gender, ''), nullif(p_fide_id, ''), p_fide_rating,
      nullif(p_chess_association_id, ''), p_country, p_state, p_city, p_email, p_phone, nullif(p_whatsapp, ''),
      nullif(p_parent_name, ''), nullif(p_parent_relationship, ''), nullif(p_parent_email, ''), nullif(p_parent_phone, ''),
      nullif(p_current_chess_level, ''), nullif(p_school_or_academy, ''), nullif(p_club, ''),
      coalesce(p_media_consent, false), coalesce(p_marketing_consent, false), coalesce(nullif(p_source, ''), 'website')
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_REGISTRATION' using errcode = 'P0001';
  end;

  insert into public.reporting_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'tournament_registration.created',
    'tournament_registration',
    v_id,
    jsonb_build_object(
      'id', v_id,
      'created_at', now(),
      'tournament_id', v_tournament.id,
      'tournament_name', v_tournament.name,
      'category_id', v_category.id,
      'category_name', v_category.name,
      'player_full_name', p_player_full_name,
      'date_of_birth', p_date_of_birth,
      'fide_id', p_fide_id,
      'fide_rating', p_fide_rating,
      'country', p_country,
      'state', p_state,
      'city', p_city,
      'email', p_email,
      'phone', p_phone,
      'whatsapp', p_whatsapp,
      'guardian_name', p_parent_name,
      'guardian_phone', p_parent_phone,
      'status', 'PENDING'
    )
  );

  return v_id;
end;
$$;

comment on function public.submit_tournament_registration(text, text, text, date, text, text, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean, text) is
  'Public entry point for Tournament Registration submissions. Resolves tournament/category from slug + category_key server-side, verifies status/registration_enabled/deadline, and always creates status = PENDING (no payment processing exists).';

grant execute on function public.submit_tournament_registration(text, text, text, date, text, text, integer, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean, text) to anon, authenticated;
