-- Fix purge_user_data(): Supabase forbids direct DML on storage.objects
-- ("Direct deletion from storage tables is not allowed. Use the Storage API
-- instead."), so the delete-from-storage.objects step made the whole purge
-- fail for every user. Profile-photo cleanup moves to the app, which deletes
-- the user's folder via the Storage API (allowed by the "Users delete own
-- photos" policy) before calling this RPC.

create or replace function public.purge_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in.';
  end if;

  -- 1. Snapshot abuse evidence (IDs + reason + timestamp only).
  insert into public.retained_reports
    (reporter_user_id, target_user_id, reason, reported_at)
  select reporter_user_id, target_user_id, reason, created_at
  from public.reports
  where reporter_user_id = uid or target_user_id = uid;

  -- 2. The auth.users row. Cascades: public.users -> profiles ->
  --    host/guest modules, profile_topics, conversations (+messages),
  --    reports, blocks, pitch_quotas, conversation_reads, events.
  --    (Profile photos are removed by the app via the Storage API first.)
  delete from auth.users where id = uid;

  -- 3. Audit row (FK to users dropped in the sprint-4 migration so it
  --    survives the purge).
  insert into public.deletion_requests (user_id, state)
  values (uid, 'completed');
end;
$$;

grant execute on function public.purge_user_data() to authenticated;
