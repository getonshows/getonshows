-- Booking completion: mutual recording confirmation.
-- ---------------------------------------------------------------------------
-- A "booked" conversation means a booking was claimed or confirmed, not that
-- the recording happened. After the agreed time passes, each participant can
-- confirm the recording took place:
--
--   recording_confirmed_by  profile ids that said yes
--   recording_declined_by   profile ids that said no
--   completed_at            set when BOTH participant profiles confirmed
--
-- Only mutual confirmation counts as a completed recording. Public booking
-- lists use completed_at to distinguish real recordings from claims.

alter table public.conversations
  add column if not exists recording_confirmed_by uuid[] not null default '{}',
  add column if not exists recording_declined_by uuid[] not null default '{}',
  add column if not exists completed_at timestamptz;
