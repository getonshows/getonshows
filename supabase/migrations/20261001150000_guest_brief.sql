-- Sprint 8: host "guest brief" — the conversations the host wants to have.
-- Feeds matching embeddings and shows on the public host profile.
alter table public.host_profiles
  add column if not exists guest_brief text;
