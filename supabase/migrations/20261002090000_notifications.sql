-- Email notifications: preference column + peer-contact RPC.
-- ---------------------------------------------------------------------------
-- users.email_notifications lets each member opt out of transactional emails
-- (new pitches, replies, booking activity). Defaults on.
--
-- conversation_peer_contact(cid) returns the OTHER participant's contact info
-- for the calling participant only. It is the single narrow path through
-- which a sender can learn a recipient's email address, and it refuses to
-- answer unless the caller is a participant of that conversation.

alter table public.users
  add column if not exists email_notifications boolean not null default true;

create or replace function public.conversation_peer_contact(cid uuid)
returns table (
  peer_user_id uuid,
  peer_email text,
  peer_email_notifications boolean,
  peer_last_read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  h_prof uuid;
  g_prof uuid;
  h_user uuid;
  g_user uuid;
begin
  select c.host_profile_id, c.guest_profile_id
    into h_prof, g_prof
  from public.conversations c
  where c.id = cid;

  if h_prof is null or g_prof is null then
    return;
  end if;

  select p.user_id into h_user from public.profiles p where p.id = h_prof;
  select p.user_id into g_user from public.profiles p where p.id = g_prof;

  -- Only a participant may ask. Everyone else gets zero rows.
  if me is null or (me <> h_user and me <> g_user) then
    return;
  end if;

  if me = h_user then
    return query
      select g_user, u.email, u.email_notifications, r.last_read_at
      from public.users u
      left join public.conversation_reads r
        on r.conversation_id = cid and r.user_id = g_user
      where u.id = g_user;
  else
    return query
      select h_user, u.email, u.email_notifications, r.last_read_at
      from public.users u
      left join public.conversation_reads r
        on r.conversation_id = cid and r.user_id = h_user
      where u.id = h_user;
  end if;
end;
$$;

grant execute on function public.conversation_peer_contact(uuid) to authenticated;
