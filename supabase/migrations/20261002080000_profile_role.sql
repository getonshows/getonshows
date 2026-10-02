-- profile_role(pid) — the canonical users.role for a profile owner, so all
-- surfaces (dashboard, one-sheet, public profile) label the role the same
-- way. Only exposed for published profiles; owners already see their own
-- role via the users table RLS policy.
create or replace function public.profile_role(pid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  select u.role into r
  from public.users u
  join public.profiles p on p.user_id = u.id
  where p.id = pid
    and p.state = 'published';
  return r;
end;
$$;

grant execute on function public.profile_role(uuid) to anon, authenticated;
