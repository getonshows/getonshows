-- Sprint 5: structured weekly availability.
-- availability is a JSON object: { "mon": ["09:00","10:00"], ... }
-- Day keys are mon..sun; values are hourly slot start times (HH:MM, 24h),
-- covering 08:00 (8 AM) through 19:00 (7 PM, i.e. the 7–8 PM hour).

alter table public.profiles
  add column if not exists availability jsonb not null default '{}'::jsonb;

comment on column public.profiles.availability is
  'Weekly availability grid: { "mon": ["09:00", ...], ... }. Slots are hourly, 08:00–19:00.';
