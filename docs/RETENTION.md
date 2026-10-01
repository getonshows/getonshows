# GetOnShows — Data retention & deletion policy

Pragmatic, pilot-scale, and honest about what happens where. No legalese
beyond what's needed to operate the deletion path correctly.

## Account deletion (user-initiated, Profile → Delete my account)

Deletion is **immediate and permanent**. The app calls the
`purge_user_data()` database function, which runs as the database owner so it
can touch every row the user owns:

1. **Abuse evidence is snapshotted first** into `retained_reports`
   (reporter ID, reported ID, reason, timestamp — see below).
2. **Profile photos** are deleted from the `profile-photos` storage bucket.
3. **The auth user row is deleted**, which cascades through the whole graph:
   - `users` → `profiles` → host/guest modules, topics links
   - `conversations` → `messages` (threads the user was in — both sides'
     messages in those threads go with it)
   - `reports` (originals), `blocks`, `pitch_quotas`, `conversation_reads`,
     `events`
4. A `deletion_requests` row with `state = 'completed'` is written as the
   audit record.

The user is then signed out. The cascade was verified: the foreign keys
carrying `on delete cascade` were audited in Sprint 4 and the purge path is
covered by `npm run db:validate`.

**Known tradeoff:** deleting an account deletes shared conversation threads
entirely, including the other participant's messages in those threads. This
is the documented cost of a true hard purge; the alternative (orphaned
half-threads) leaks the deleter's words anyway.

## What is retained, and why

| Data | Retained | Why |
|---|---|---|
| Abuse reports (as reporter or target) | Reporter ID, reported ID, reason, timestamp — **12 months**, no message bodies, no report details | Minimum evidence to act on repeat offenders who delete and re-register |
| `deletion_requests` audit row | User ID + timestamp, indefinitely | Proof that a deletion was honored, if ever asked |
| Analytics events | Deleted with the account | They cascade with `users`; no ghost analytics |

`retained_reports` has row-level security enabled with **no policies**: the
app never reads it. Only the database owner can query it (Supabase SQL
editor). Expired skeletons are removed with:

```sql
select public.purge_expired_retained_reports();
```

## Backups

Supabase point-in-time backups age out on Supabase's own retention schedule
(daily backups kept 7 days on paid plans; the pilot runs on the free tier,
whose backups are best-effort). A deleted row can therefore linger in a
backup snapshot until that snapshot ages out — this is inherent to any
hosted Postgres and is disclosed here rather than hidden.

## Data export

Profile → **Download my data** returns a JSON file with the account, profile
+ modules, conversations + messages, pitches, intents, blocks the user made,
and quota state. Excluded on purpose: who blocked the user (block direction
is never revealed) and other users' private data.
