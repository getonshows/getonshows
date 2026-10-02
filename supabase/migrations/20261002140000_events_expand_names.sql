-- Expand the events name allowlist for the new analytics events logged by
-- this batch (builder_step, pitch_withdrawn, recording_completed). Without
-- this, the check constraint would reject those inserts and the analytics
-- would silently never record.
alter table public.events drop constraint if exists events_name_check;

alter table public.events
  add constraint events_name_check check (name in (
    'signup',
    'profile_published',
    'match_opened',
    'pitch_sent',
    'message_replied',
    'booking_marked',
    'role_switched',
    'admin_view',
    'builder_step',
    'pitch_withdrawn',
    'recording_completed'
  ));
