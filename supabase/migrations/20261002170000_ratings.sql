-- Ratings: after both sides confirm a recording happened, each side can rate
-- the other (1-5 stars + optional comment). One rating per booking per rater.

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  rater_profile_id uuid not null references public.profiles(id) on delete cascade,
  rated_profile_id uuid not null references public.profiles(id) on delete cascade,
  rated_role text not null check (rated_role in ('host', 'guest')),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, rater_profile_id),
  check (rater_profile_id <> rated_profile_id)
);

alter table public.ratings enable row level security;

-- Read your own ratings (to know whether you already rated a thread).
create policy "Users read own ratings"
  on public.ratings for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = ratings.rater_profile_id
        and p.user_id = auth.uid()
    )
  );

-- Insert: only a conversation participant, only after both sides confirmed the
-- recording, only rating the other participant, with the role they played.
create policy "Participants rate completed bookings"
  on public.ratings for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = ratings.rater_profile_id
        and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.conversations c
      where c.id = ratings.conversation_id
        and c.completed_at is not null
        and (
          (c.host_profile_id = ratings.rater_profile_id and c.guest_profile_id = ratings.rated_profile_id)
          or
          (c.guest_profile_id = ratings.rater_profile_id and c.host_profile_id = ratings.rated_profile_id)
        )
    )
    and (
      (ratings.rated_role = 'host' and exists (
        select 1 from public.conversations c
        where c.id = ratings.conversation_id and c.host_profile_id = ratings.rated_profile_id
      ))
      or
      (ratings.rated_role = 'guest' and exists (
        select 1 from public.conversations c
        where c.id = ratings.conversation_id and c.guest_profile_id = ratings.rated_profile_id
      ))
    )
  );

-- Update your own rating (stars/comment corrections).
create policy "Users update own ratings"
  on public.ratings for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = ratings.rater_profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = ratings.rater_profile_id
        and p.user_id = auth.uid()
    )
  );

-- Public rating summary + recent reviews for a published profile.
-- Returns: { as_host: {avg, count} | null, as_guest: {avg, count} | null,
--            reviews: [{rater_name, rater_photo, stars, comment, rated_role, created_at}] }
create or replace function public.profile_ratings(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_published boolean;
  result jsonb;
begin
  select (p.state = 'published') into is_published
  from public.profiles p
  where p.id = pid;

  if not coalesce(is_published, false) then
    return jsonb_build_object('as_host', null, 'as_guest', null, 'reviews', '[]'::jsonb);
  end if;

  with agg as (
    select
      rated_role,
      round(avg(stars)::numeric, 1) as avg_stars,
      count(*) as cnt
    from public.ratings
    where rated_profile_id = pid
    group by rated_role
  ),
  host_agg as (select * from agg where rated_role = 'host'),
  guest_agg as (select * from agg where rated_role = 'guest')
  select jsonb_build_object(
    'as_host', case when (select cnt from host_agg) is null then null
      else jsonb_build_object('avg', (select avg_stars from host_agg), 'count', (select cnt from host_agg)) end,
    'as_guest', case when (select cnt from guest_agg) is null then null
      else jsonb_build_object('avg', (select avg_stars from guest_agg), 'count', (select cnt from guest_agg)) end,
    'reviews', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select
          rp.display_name as rater_name,
          rp.photo_url as rater_photo,
          rt.stars,
          rt.comment,
          rt.rated_role,
          rt.created_at
        from public.ratings rt
        join public.profiles rp on rp.id = rt.rater_profile_id
        where rt.rated_profile_id = pid
          and rp.state = 'published'
        order by rt.created_at desc
        limit 5
      ) r
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.profile_ratings(uuid) to anon, authenticated;
