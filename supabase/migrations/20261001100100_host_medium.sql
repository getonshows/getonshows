-- GetOnShows · Sprint 2: host recording medium (audio / video / both)
--
-- `format` on host_profiles already captures the session type
-- (remote / in_person / both). `medium` captures how the show is recorded,
-- so guests can filter for audio-only vs video shows in discovery.

alter table public.host_profiles
  add column medium text
    check (medium in ('audio', 'video', 'both'));
