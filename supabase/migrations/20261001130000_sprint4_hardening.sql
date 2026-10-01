-- GetOnShows · Sprint 4: pilot hardening
--
--   * users.source — acquisition source captured at signup (utm_source /
--     referrer). Stamped onto every event by the events_stamp_source trigger.
--   * events: rename pitch_replied -> message_replied and
--     booking_claimed -> booking_marked (clearer funnel names); widen the
--     name check to cover the full funnel: signup, profile_published,
--     match_opened, pitch_sent, message_replied, booking_marked, plus
--     role_switched and admin_view. Old rows are renamed in place.
--   * retained_reports — abuse-evidence skeletons kept 12 months after
--     account deletion (reporter/reported IDs + reason + timestamp only;
--     never message bodies, never report details).
--   * purge_user_data() — SECURITY DEFINER hard delete for account
--     deletion: snapshots abuse reports first, deletes profile photos from
--     storage, deletes the auth.users row (cascades through public.users ->
--     profiles -> conversations/messages, events, blocks, quotas, reads),
--     and writes the completed deletion_requests audit row.
--   * funnel_counts() — SECURITY DEFINER aggregate for the owner-only
--     funnel dashboard. Returns counts only, never row-level data.
--   * deletion_requests.user_id loses its FK so the audit row survives the
--     purge of the user it describes.

-- ---------------------------------------------------------------------------
-- users.source — acquisition source tag
-- ---------------------------------------------------------------------------

alter table public.users add column if not exists source text;

-- ---------------------------------------------------------------------------
-- events — funnel names + source stamping
-- ---------------------------------------------------------------------------

update public.events set name = 'message_replied' where name = 'pitch_replied';
update public.events set name = 'booking_marked' where name = 'booking_claimed';

alter table public.events drop constraint if exists events_name_check;

alter table public.events
  add constraint events_name_check check (name in (
    'signup',
    'profile_published',
    'match_opened',
    'pitch_sent',
    'message_replied',
    'booking_marked',
    'role_switched',
    'admin_view'
  ));

-- Stamp every event with the actor's acquisition source at insert time, so
-- no call site can forget it. Never touches message bodies (there are none
-- in this table by design).
create or replace function public.events_stamp_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  src text;
begin
  select u.source into src from public.users u where u.id = new.user_id;
  if src is not null and src <> '' then
    new.properties := coalesce(new.properties, '{}'::jsonb)
      || jsonb_build_object('source', src);
  end if;
  return new;
end;
$$;

drop trigger if exists events_stamp_source on public.events;
create trigger events_stamp_source
  before insert on public.events
  for each row execute function public.events_stamp_source();

-- ---------------------------------------------------------------------------
-- retained_reports — 12-month abuse-evidence skeletons
-- ---------------------------------------------------------------------------

create table if not exists public.retained_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null,
  target_user_id uuid not null,
  reason text not null,
  reported_at timestamptz not null,
  retain_until timestamptz not null default now() + interval '12 months',
  created_at timestamptz not null default now()
);

alter table public.retained_reports enable row level security;
-- No policies: only the database owner / service_role can read these.
-- The app never queries this table.

-- Owner-run cleanup for expired skeletons.
create or replace function public.purge_expired_retained_reports()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.retained_reports where retain_until < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- purge_user_data() — immediate hard delete on account-deletion request
-- ---------------------------------------------------------------------------

create or replace function public.purge_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in.';
  end if;

  -- 1. Snapshot abuse evidence (IDs + reason + timestamp only).
  insert into public.retained_reports
    (reporter_user_id, target_user_id, reason, reported_at)
  select reporter_user_id, target_user_id, reason, created_at
  from public.reports
  where reporter_user_id = uid or target_user_id = uid;

  -- 2. Profile photos from storage.
  delete from storage.objects
  where bucket_id = 'profile-photos'
    and name like uid::text || '/%';

  -- 3. The auth.users row. Cascades: public.users -> profiles ->
  --    host/guest modules, profile_topics, conversations (+messages),
  --    reports, blocks, pitch_quotas, conversation_reads, events.
  delete from auth.users where id = uid;

  -- 4. Audit row (FK to users dropped below so it survives the purge).
  insert into public.deletion_requests (user_id, state)
  values (uid, 'completed');
end;
$$;

-- deletion_requests keeps describing deleted users after the purge.
alter table public.deletion_requests
  drop constraint if exists deletion_requests_user_id_fkey;
alter table public.deletion_requests
  alter column user_id drop not null;

-- ---------------------------------------------------------------------------
-- funnel_counts() — owner-only funnel aggregates (counts, never rows)
-- ---------------------------------------------------------------------------

create or replace function public.funnel_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  since timestamptz := now() - interval '30 days';
  stages jsonb;
  by_source jsonb;
begin
  with ordered(name, ord) as (
    values
      ('signup', 1),
      ('profile_published', 2),
      ('match_opened', 3),
      ('pitch_sent', 4),
      ('message_replied', 5),
      ('booking_marked', 6)
  ),
  counts as (
    select o.name, o.ord, count(distinct e.user_id) as users
    from ordered o
    left join public.events e
      on e.name = o.name and e.created_at >= since
    group by o.name, o.ord
  )
  select jsonb_agg(
    jsonb_build_object('stage', name, 'users', users)
    order by ord
  ) into stages from counts;

  select jsonb_agg(
    jsonb_build_object('source', s.source, 'signups', s.signups)
    order by s.signups desc
  )
  into by_source
  from (
    select coalesce(properties ->> 'source', 'direct') as source,
           count(distinct user_id)::int as signups
    from public.events
    where name = 'signup' and created_at >= since
    group by 1
  ) s;

  return jsonb_build_object(
    'since', since,
    'stages', coalesce(stages, '[]'::jsonb),
    'by_source', coalesce(by_source, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.funnel_counts() to authenticated;
grant execute on function public.purge_user_data() to authenticated;
