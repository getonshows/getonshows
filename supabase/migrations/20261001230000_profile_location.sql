-- Profile location (city/state level, free text, global). Optional.
-- Used for display on the one-sheet and for location filtering in Discover.

alter table public.profiles
  add column if not exists location text;
