-- Discovery freshness: track which profiles a user has already been shown
-- in Discover, so repeat visits surface new people first.
create table if not exists public.discovery_impressions (
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (viewer_user_id, profile_id)
);

create index if not exists discovery_impressions_viewer_idx
  on public.discovery_impressions (viewer_user_id, viewed_at desc);

alter table public.discovery_impressions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discovery_impressions'
      and policyname = 'Users manage own discovery impressions'
  ) then
    create policy "Users manage own discovery impressions"
      on public.discovery_impressions for all to authenticated
      using (viewer_user_id = auth.uid())
      with check (viewer_user_id = auth.uid());
  end if;
end $$;
