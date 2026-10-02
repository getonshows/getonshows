-- Daily pitch quota: 5/day for new accounts, 10/day once any pitch has
-- drawn a reply ("raise after replies"). Replaces the previous 3/week and
-- 10/week windows. Existing pitch_quotas rows roll over naturally: any
-- window_start older than 1 day starts a fresh window on next use.

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
  limit_val int := 5;
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

  -- No row yet, or the 1-day window rolled over: start a fresh window.
  if not found or q.window_start < now() - interval '1 day' then
    if consume then
      insert into public.pitch_quotas (user_id, window_start, sent_count)
      values (uid, now(), 1)
      on conflict (user_id)
      do update set window_start = excluded.window_start, sent_count = 1
      returning * into q;
    else
      resets_at := coalesce(q.window_start, now()) + interval '1 day';
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
      'resets_at', (q.window_start + interval '1 day')::text
    );
  elsif consume then
    update public.pitch_quotas
    set sent_count = sent_count + 1
    where user_id = uid
    returning * into q;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(limit_val - q.sent_count, 0),
    'limit', limit_val,
    'resets_at', (q.window_start + interval '1 day')::text
  );
end;
$$;

grant execute on function public.pitch_quota(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- profile_public_stats — public booking/pitch counts for a published profile.
-- Powers badges on the public one-sheet (QR share destination). Returns
-- zeros for anything not published. SECURITY DEFINER so anon callers get
-- counts without reading conversation rows.
-- ---------------------------------------------------------------------------

create or replace function public.profile_public_stats(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_published boolean;
  booking_count int;
  pitch_count int;
begin
  select (p.state = 'published') into is_published
  from public.profiles p
  where p.id = pid;
  if not coalesce(is_published, false) then
    return jsonb_build_object(
      'published', false, 'bookings', 0, 'pitches', 0
    );
  end if;

  select count(*) into booking_count
  from public.conversations c
  where c.state = 'booked'
    and (c.host_profile_id = pid or c.guest_profile_id = pid);

  select count(*) into pitch_count
  from public.conversations c
  where c.pitched_by_profile_id = pid;

  return jsonb_build_object(
    'published', true, 'bookings', booking_count, 'pitches', pitch_count
  );
end;
$$;

grant execute on function public.profile_public_stats(uuid) to anon, authenticated;
