-- profile_public_stats: split the booking count into upcoming vs completed so
-- public profiles never claim a future booking was "completed". A booking is
-- completed only after both sides confirm the recording happened
-- (conversations.completed_at); anything else booked is upcoming.
create or replace function public.profile_public_stats(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_published boolean;
  booking_count int;
  upcoming_count int;
  completed_count int;
  pitch_count int;
begin
  select (p.state = 'published') into is_published
  from public.profiles p
  where p.id = pid;
  if not coalesce(is_published, false) then
    return jsonb_build_object(
      'published', false, 'bookings', 0, 'bookings_upcoming', 0,
      'bookings_completed', 0, 'pitches', 0
    );
  end if;

  select count(*) into booking_count
  from public.conversations c
  where c.state = 'booked'
    and (c.host_profile_id = pid or c.guest_profile_id = pid);

  select count(*) into completed_count
  from public.conversations c
  where c.state = 'booked'
    and c.completed_at is not null
    and (c.host_profile_id = pid or c.guest_profile_id = pid);

  upcoming_count := booking_count - completed_count;

  select count(*) into pitch_count
  from public.conversations c
  where c.pitched_by_profile_id = pid;

  return jsonb_build_object(
    'published', true,
    'bookings', booking_count,
    'bookings_upcoming', upcoming_count,
    'bookings_completed', completed_count,
    'pitches', pitch_count
  );
end;
$$;

grant execute on function public.profile_public_stats(uuid) to anon, authenticated;
