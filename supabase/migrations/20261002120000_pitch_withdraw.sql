-- Pitch withdrawal: delete policy + quota refund.
-- ---------------------------------------------------------------------------
-- Withdrawing an unanswered pitch deletes the conversation. The delete policy
-- is deliberately narrow: only the pitcher, only while the pitch is still
-- unanswered (state = 'pitched'). Replies, interest, and bookings can never
-- be deleted this way.
--
-- pitch_quota_refund() gives the daily pitch slot back, so withdrawing a
-- mistaken pitch does not punish the sender. Floor of zero; only refunds
-- inside the current 1-day window.

create policy "Pitcher deletes own unanswered pitch"
  on public.conversations for delete to authenticated
  using (
    state = 'pitched'
    and exists (
      select 1
      from public.profiles p
      where p.id = conversations.pitched_by_profile_id
        and p.user_id = auth.uid()
    )
  );

create or replace function public.pitch_quota_refund()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  update public.pitch_quotas
  set sent_count = greatest(sent_count - 1, 0)
  where user_id = uid
    and window_start >= now() - interval '1 day';
end;
$$;

grant execute on function public.pitch_quota_refund() to authenticated;
