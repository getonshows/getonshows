-- Distinguish a confirmed booking (both sides agreed on a time via an
-- accepted proposal) from a unilateral claim ("Mark Booked" via an external
-- booking link). agreed_at holds the mutually agreed UTC time; it stays
-- null for claimed-but-unconfirmed bookings. booking_confirmed mirrors it
-- for the existing boolean column.

alter table public.conversations
  add column if not exists agreed_at timestamptz null;

-- Backfill from accepted booking requests.
update public.conversations c
set agreed_at = r.accepted_slot,
    booking_confirmed = true
from public.booking_requests r
where r.conversation_id = c.id
  and r.status = 'accepted'
  and r.accepted_slot is not null
  and c.agreed_at is null;
