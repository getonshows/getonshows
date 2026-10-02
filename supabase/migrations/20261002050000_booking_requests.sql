-- Native booking: structured time proposals inside a conversation.
-- A booking_request holds up to 3 proposed UTC slots; the other party
-- accepts one (or declines). On accept the conversation flips to booked.

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposed_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  accepted_slot timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.booking_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Participants manage booking requests') then
    create policy "Participants manage booking requests"
      on public.booking_requests for all to authenticated
      using (
        exists (
          select 1
          from public.conversations c
          join public.profiles p
            on p.id in (c.host_profile_id, c.guest_profile_id)
          where c.id = booking_requests.conversation_id
            and p.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.conversations c
          join public.profiles p
            on p.id in (c.host_profile_id, c.guest_profile_id)
          where c.id = booking_requests.conversation_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index if not exists booking_requests_conversation_idx
  on public.booking_requests (conversation_id, created_at desc);
