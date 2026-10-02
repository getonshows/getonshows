-- funnel_counts(): add the profile-builder step breakdown and the
-- recording_completed stage (mutually-confirmed recordings).
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
  builder jsonb;
begin
  with ordered(name, ord) as (
    values
      ('signup', 1),
      ('profile_published', 2),
      ('match_opened', 3),
      ('pitch_sent', 4),
      ('message_replied', 5),
      ('booking_marked', 6),
      ('recording_completed', 7)
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

  -- Builder drop-off: distinct users who viewed each step, in canonical
  -- step order. Note show/story are role-dependent, so a dip at those
  -- steps is expected, not necessarily abandonment.
  with bsteps(step, ord) as (
    values
      ('basics', 1),
      ('topics', 2),
      ('show', 3),
      ('story', 4),
      ('review', 5)
  ),
  bcounts as (
    select o.step, o.ord, count(distinct e.user_id) as users
    from bsteps o
    left join public.events e
      on e.name = 'builder_step'
      and e.properties ->> 'step' = o.step
      and e.created_at >= since
    group by o.step, o.ord
  )
  select jsonb_agg(
    jsonb_build_object('step', step, 'users', users)
    order by ord
  ) into builder from bcounts;

  return jsonb_build_object(
    'since', since,
    'stages', coalesce(stages, '[]'::jsonb),
    'by_source', coalesce(by_source, '[]'::jsonb),
    'builder', coalesce(builder, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.funnel_counts() to authenticated;
