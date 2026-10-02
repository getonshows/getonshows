-- profile_collaborations: include completed_at so public booking lists can
-- distinguish mutually-confirmed recordings from claims.
create or replace function public.profile_collaborations(pid uuid)
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
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'profile_id', other.id,
      'display_name', other.display_name,
      'photo_url', other.photo_url,
      'my_role', case when c.host_profile_id = pid then 'host' else 'guest' end,
      'booked_at', c.state_changed_at,
      'completed_at', c.completed_at
    )
    order by c.state_changed_at desc
  ), '[]'::jsonb)
  into result
  from public.conversations c
  join public.profiles other
    on other.id = case
      when c.host_profile_id = pid then c.guest_profile_id
      else c.host_profile_id
    end
  where c.state = 'booked'
    and (c.host_profile_id = pid or c.guest_profile_id = pid)
    and other.state = 'published';

  return result;
end;
$$;

grant execute on function public.profile_collaborations(uuid) to anon, authenticated;
