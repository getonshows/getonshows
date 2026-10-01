-- GetOnShows · Sprint 3: conversation workflow, pitch quotas, blocks, read state
--
-- Adds to the Sprint 1 conversations/messages/reports tables:
--   * conversations: pitcher tracking, archive flag, intent actor/timestamps
--   * guest_profiles: booking_url (hosts already have it)
--   * reports: optional conversation link
--   * pitch_quotas + claim_pitch_slot(): server-side 3/week quota for new
--     accounts, 10/week once someone has replied to a pitch ("raise after
--     replies"). SECURITY DEFINER so the check+increment is atomic and
--     cannot be bypassed from the client.
--   * blocks: directional user blocks (discovery exclusion + messaging ban)
--   * conversation_reads: per-user read watermarks for unread badges
--   * events: minimal analytics trail (pitch_sent / pitch_replied /
--     booking_claimed). No message bodies are ever stored here.

-- ---------------------------------------------------------------------------
-- conversations: workflow columns
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column pitched_by_profile_id uuid references public.profiles (id) on delete set null;

alter table public.conversations
  add column archived boolean not null default false;

alter table public.conversations
  add column state_changed_at timestamptz;

alter table public.conversations
  add column state_changed_by_profile_id uuid references public.profiles (id) on delete set null;

update public.conversations
set state_changed_at = updated_at
where state_changed_at is null;

-- ---------------------------------------------------------------------------
-- guest_profiles: booking handoff link (symmetric with host_profiles)
-- ---------------------------------------------------------------------------

alter table public.guest_profiles
  add column booking_url text;

-- ---------------------------------------------------------------------------
-- reports: link the thread a report came from (optional)
-- ---------------------------------------------------------------------------

alter table public.reports
  add column conversation_id uuid references public.conversations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- pitch_quotas — weekly pitch allowance, enforced server-side
-- ---------------------------------------------------------------------------

create table public.pitch_quotas (
  user_id uuid primary key references public.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  sent_count int not null default 0 check (sent_count >= 0)
);

alter table public.pitch_quotas enable row level security;

-- Users may read their own quota; all writes go through claim_pitch_slot().
create policy "Users read own pitch quota"
  on public.pitch_quotas for select to authenticated
  using (user_id = auth.uid());

-- Shared quota logic: 3/week for new accounts, 10/week once any pitch has
-- drawn a reply (spec: "raise after replies"). Set consume=true to spend a
-- slot, false to peek at the current status.
create or replace function public.pitch_quota(consume boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  q public.pitch_quotas%rowtype;
  limit_val int := 3;
  established boolean := false;
  resets_at timestamptz;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'error', 'Not signed in.');
  end if;

  select p.id into pid from public.profiles p where p.user_id = uid;

  if pid is not null then
    select exists (
      select 1 from public.conversations c
      where c.pitched_by_profile_id = pid
        and c.state in ('replied', 'interested', 'booked')
    ) into established;
  end if;
  if established then
    limit_val := 10;
  end if;

  select * into q from public.pitch_quotas where user_id = uid;

  -- No row yet, or the 7-day window rolled over: start a fresh window.
  if not found or q.window_start < now() - interval '7 days' then
    if consume then
      insert into public.pitch_quotas (user_id, window_start, sent_count)
      values (uid, now(), 1)
      on conflict (user_id)
      do update set window_start = excluded.window_start, sent_count = 1
      returning * into q;
    else
      resets_at := coalesce(q.window_start, now()) + interval '7 days';
      return jsonb_build_object(
        'allowed', true,
        'remaining', limit_val,
        'limit', limit_val,
        'resets_at', resets_at::text
      );
    end if;
  elsif q.sent_count >= limit_val then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'limit', limit_val,
      'resets_at', (q.window_start + interval '7 days')::text
    );
  elsif consume then
    update public.pitch_quotas
    set sent_count = sent_count + 1
    where user_id = uid
    returning * into q;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, limit_val - q.sent_count),
    'limit', limit_val,
    'resets_at', (q.window_start + interval '7 days')::text
  );
end;
$$;

grant execute on function public.pitch_quota(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- blocks — directional user blocks
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_user_id uuid not null references public.users (id) on delete cascade,
  blocked_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

alter table public.blocks enable row level security;

create policy "Users manage own blocks"
  on public.blocks for all to authenticated
  using (blocker_user_id = auth.uid())
  with check (blocker_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- conversation_reads — per-user read watermarks for unread badges
-- ---------------------------------------------------------------------------

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create policy "Users manage own read state"
  on public.conversation_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- events — minimal analytics trail (never stores message bodies)
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (name in ('pitch_sent', 'pitch_replied', 'booking_claimed', 'profile_published')),
  user_id uuid not null references public.users (id) on delete cascade,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Users log own events"
  on public.events for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users read own events"
  on public.events for select to authenticated
  using (user_id = auth.uid());
