-- GetOnShows · initial schema (Sprint 1)
-- Covers the spec's 10 core entities, plus deletion_requests (DATA-01)
-- and a public storage bucket for profile photos.
--
-- Conventions
--   * Every mutable record carries created_at / updated_at.
--   * Profile + conversation state machines are CHECK constraints;
--     allowed *transitions* are enforced in application code (server actions).
--   * All access rules from the spec are enforced as Row Level Security.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users — 1:1 with auth.users, provisioned by trigger on signup
-- Spec fields: id, email, role, status
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'undecided'
    check (role in ('undecided', 'host', 'guest', 'dual')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users read own record"
  on public.users for select to authenticated
  using (id = auth.uid());

create policy "Users create own record"
  on public.users for insert to authenticated
  with check (id = auth.uid());

create policy "Users update own record"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- profiles — the base card; exactly one per user
-- Spec fields: name, bio, photo, links. Public when live (published).
-- State machine: draft → published → paused → deleted
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text,
  title text,
  bio text,
  photo_url text,
  links jsonb not null default '[]'::jsonb,
  timezone text,
  availability_notes text,
  state text not null default 'draft'
    check (state in ('draft', 'published', 'paused', 'deleted')),
  completeness smallint not null default 0
    check (completeness between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Published profiles are publicly readable"
  on public.profiles for select
  using (state = 'published');

create policy "Owners read own profile"
  on public.profiles for select to authenticated
  using (user_id = auth.uid());

create policy "Owners insert own profile"
  on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "Owners update own profile"
  on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Owners delete own profile"
  on public.profiles for delete to authenticated
  using (user_id = auth.uid());

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- host_profiles — host module (1:1 with profiles)
-- Spec fields: show, format, cadence, criteria (+ booking handoff)
-- ---------------------------------------------------------------------------

create table public.host_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  show_name text,
  show_url text,
  format text check (format in ('remote', 'in_person', 'both')),
  cadence text,
  episode_length_minutes integer check (episode_length_minutes is null or episode_length_minutes > 0),
  guest_criteria text,
  booking_url text,
  recent_episode_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.host_profiles enable row level security;

create policy "Host modules of published profiles are publicly readable"
  on public.host_profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = host_profiles.profile_id and p.state = 'published'
    )
  );

create policy "Owners read own host module"
  on public.host_profiles for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = host_profiles.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Owners write own host module"
  on public.host_profiles for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = host_profiles.profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = host_profiles.profile_id and p.user_id = auth.uid()
    )
  );

create trigger host_profiles_set_updated_at
  before update on public.host_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- guest_profiles — guest module (1:1 with profiles)
-- Spec fields: expertise, angles (talking points), experience (+ proof links)
-- ---------------------------------------------------------------------------

create table public.guest_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  expertise text,
  talking_points text[] not null default '{}',
  proof_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guest_profiles enable row level security;

create policy "Guest modules of published profiles are publicly readable"
  on public.guest_profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = guest_profiles.profile_id and p.state = 'published'
    )
  );

create policy "Owners read own guest module"
  on public.guest_profiles for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = guest_profiles.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Owners write own guest module"
  on public.guest_profiles for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = guest_profiles.profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = guest_profiles.profile_id and p.user_id = auth.uid()
    )
  );

create trigger guest_profiles_set_updated_at
  before update on public.guest_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- topics — curated taxonomy + limited custom tags
-- Spec fields: label, slug, parent. Public read.
-- ---------------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  slug text not null unique,
  parent_id uuid references public.topics (id) on delete set null,
  is_custom boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;

create policy "Topics are publicly readable"
  on public.topics for select
  using (true);

create policy "Authenticated users can add custom topics"
  on public.topics for insert to authenticated
  with check (is_custom = true and created_by = auth.uid());

create policy "Owners can remove own custom topics"
  on public.topics for delete to authenticated
  using (is_custom = true and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- profile_topics — topic assignments. Public with the profile.
-- Spec fields: profile, topic, weight
-- ---------------------------------------------------------------------------

create table public.profile_topics (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 3),
  primary key (profile_id, topic_id)
);

alter table public.profile_topics enable row level security;

create policy "Topic assignments of published profiles are publicly readable"
  on public.profile_topics for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_topics.profile_id and p.state = 'published'
    )
  );

create policy "Owners read own topic assignments"
  on public.profile_topics for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_topics.profile_id and p.user_id = auth.uid()
    )
  );

create policy "Owners write own topic assignments"
  on public.profile_topics for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_topics.profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = profile_topics.profile_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- matches — ranked pairs (populated in Sprint 2)
-- Spec fields: pair, score, reasons, version. Participant read.
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references public.profiles (id) on delete cascade,
  profile_b_id uuid not null references public.profiles (id) on delete cascade,
  score numeric(5, 4) check (score is null or (score >= 0 and score <= 1)),
  reasons jsonb not null default '[]'::jsonb,
  model_version text not null default 'v1',
  created_at timestamptz not null default now(),
  check (profile_a_id <> profile_b_id)
);

-- One row per unordered pair per model version.
create unique index matches_pair_unique on public.matches (
  model_version,
  (least(profile_a_id, profile_b_id)),
  (greatest(profile_a_id, profile_b_id))
);

alter table public.matches enable row level security;

create policy "Participants read own matches"
  on public.matches for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = matches.profile_a_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = matches.profile_b_id and p.user_id = auth.uid()
    )
  );

-- No insert/update/delete policies: match rows are written by the
-- matching worker (service role) only.

-- ---------------------------------------------------------------------------
-- conversations — pitch threads (Sprint 3)
-- State machine: pitched → replied → interested / passed → booked
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  host_profile_id uuid not null references public.profiles (id) on delete cascade,
  guest_profile_id uuid not null references public.profiles (id) on delete cascade,
  state text not null default 'pitched'
    check (state in ('pitched', 'replied', 'interested', 'passed', 'booked')),
  last_message_at timestamptz,
  booking_claimed_by uuid references public.profiles (id) on delete set null,
  booking_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_profile_id <> guest_profile_id)
);

alter table public.conversations enable row level security;

create policy "Participants manage own conversations"
  on public.conversations for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id in (conversations.host_profile_id, conversations.guest_profile_id)
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id in (conversations.host_profile_id, conversations.guest_profile_id)
        and p.user_id = auth.uid()
    )
  );

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages — thread messages (Sprint 3). Participants only. Immutable.
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  kind text not null default 'text' check (kind in ('text', 'system')),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants read own messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      join public.profiles p
        on p.id in (c.host_profile_id, c.guest_profile_id)
      where c.id = messages.conversation_id
        and p.user_id = auth.uid()
    )
  );

create policy "Participants send messages as own profile"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1
      from public.conversations c
      join public.profiles p
        on p.id in (c.host_profile_id, c.guest_profile_id)
      where c.id = messages.conversation_id
        and p.user_id = auth.uid()
        and messages.sender_profile_id = p.id
    )
  );

-- ---------------------------------------------------------------------------
-- reports — moderation queue. Reporter + admin.
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users (id) on delete cascade,
  target_user_id uuid not null references public.users (id) on delete cascade,
  reason text not null
    check (reason in ('spam', 'harassment', 'fake_profile', 'inappropriate', 'other')),
  details text,
  state text not null default 'open'
    check (state in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  check (reporter_user_id <> target_user_id)
);

alter table public.reports enable row level security;

create policy "Users file own reports"
  on public.reports for insert to authenticated
  with check (reporter_user_id = auth.uid() and created_by = auth.uid());

create policy "Reporters read own reports"
  on public.reports for select to authenticated
  using (reporter_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- deletion_requests — DATA-01: account deletion path
-- Public profile data is removed immediately (profile → deleted);
-- the request itself is queued for the documented private-data purge.
-- ---------------------------------------------------------------------------

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  reason text,
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.deletion_requests enable row level security;

create policy "Users file own deletion requests"
  on public.deletion_requests for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users read own deletion requests"
  on public.deletion_requests for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public bucket for profile photos; users manage only own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Profile photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Users upload to own photo folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
