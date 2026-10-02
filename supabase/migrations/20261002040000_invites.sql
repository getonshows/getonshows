-- Invites: email/SMS/link invitations between users.
-- invite_code: short public code per user, used in invite links (?ref=CODE).
-- invited_by: attribution, set at signup when the invitee arrives via a ref link.
-- invites: ledger of sent/shared invites for rate limiting and stats.

alter table public.users
  add column if not exists invite_code text,
  add column if not exists invited_by uuid references public.users(id) on delete set null;

-- Backfill invite codes for existing users.
update public.users
set invite_code = substr(md5(gen_random_uuid()::text), 1, 8)
where invite_code is null;

alter table public.users
  alter column invite_code set not null,
  alter column invite_code set default substr(md5(gen_random_uuid()::text), 1, 8);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_invite_code_key'
  ) then
    alter table public.users add constraint users_invite_code_key unique (invite_code);
  end if;
end $$;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'link')),
  email text,
  phone text,
  code text not null,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Users manage own invites') then
    create policy "Users manage own invites"
      on public.invites for all to authenticated
      using (inviter_user_id = auth.uid())
      with check (inviter_user_id = auth.uid());
  end if;
end $$;

create index if not exists invites_inviter_created_idx
  on public.invites (inviter_user_id, created_at desc);

-- resolve_invite(code): public display name of the inviter behind an invite
-- code, for the landing-page banner. Only published profiles resolve, so
-- nothing private leaks. SECURITY DEFINER so signed-out visitors can use it.
create or replace function public.resolve_invite(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  name text;
begin
  select p.display_name into name
  from public.users u
  join public.profiles p on p.user_id = u.id
  where u.invite_code = code
    and p.state = 'published'
  limit 1;
  return name;
end;
$$;

grant execute on function public.resolve_invite(text) to anon, authenticated;
