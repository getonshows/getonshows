# GetOnShows — Sprint 1

A lean podcast host/guest matchmaking PWA. Sprint 1 delivers identity and
credibility: auth, role onboarding, an autosaving profile builder with a
publish gate, a professional one-sheet, and the installable app shell.

> Built from the GetOnShows build spec + phased build plan (Sprint 1).
> Budget ceiling for the whole 30-day validation: **$500** — this sprint
> targets **$0** on free tiers (Vercel + Supabase).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS 3.4
- Supabase: Postgres + Auth (email magic link, Google OAuth)
- PWA: `manifest.json` + service worker (`public/sw.js`)

## Prerequisites

1. A Supabase project (free tier is fine).
2. The SQL migrations applied, in order:
   - `supabase/migrations/20261001090000_initial_schema.sql`
   - `supabase/migrations/20261001090001_seed_topics.sql`
3. Google OAuth client (for "Continue with Google") — add the client ID /
   secret in Supabase → Authentication → Providers → Google, and add your
   redirect URL (`https://<your-domain>/auth/callback`) to the Google
   console's authorized redirects.

## Local development

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Open http://localhost:3000.

## Validate the database schema (no Supabase needed)

The migrations are validated against real Postgres via PGlite:

```bash
npm run db:validate
```

## Production build

```bash
npm run build
npm start
```

Deploy to Vercel: import this repo, set the two `NEXT_PUBLIC_SUPABASE_*`
env vars, done. The middleware refreshes auth sessions on every request;
no extra server config needed.

## What's in Sprint 1

| Route | What it does |
|---|---|
| `/` | Landing page |
| `/login` | Magic-link email + Google sign-in |
| `/auth/callback` | Supabase code exchange; routes new users to onboarding |
| `/onboarding` | Host / guest / both role choice |
| `/profile` | Profile home: draft/live/paused state, completeness, modules, sign out, deletion request |
| `/profile/builder` | Stepped profile builder — autosaves drafts (PRO-01), publish gate names every missing field (PRO-02), up to 3 custom topics |
| `/profile/view` | Professional one-sheet (identity, topics, host/guest modules, links) |
| `/discover`, `/inbox` | Sprint 2/3 placeholders |

### Data model

`users` (role, status) → `profiles` (draft/published/paused/deleted, completeness)
→ `host_profiles` / `guest_profiles` modules → `topics` taxonomy (20 seeded,
3 custom tags max per profile) → `profile_topics`. Deletion requests land in
`deletion_requests` and the public profile is removed immediately (DATA-01).

## Manual verification checklist (Sprint 1 exit)

1. Sign up via magic link → land on role onboarding → choose a role.
2. Build a profile: leave bio empty, publish → the gate names "Bio (at
   least 40 characters)" and every other missing field.
3. Edit a step, wait ~2s → "Draft saved" appears; reload mid-builder → the
   draft is restored.
4. Add a custom topic; try a 4th → blocked with a clear message.
5. Publish → `/profile` shows "live"; pause → hidden state; resume → live.
6. `/profile/view` renders the one-sheet; links open in new tabs.
7. Request deletion → signed out, profile gone from discovery.
8. DevTools → Application → Manifest + Service Worker registered; Lighthouse
   PWA checks pass on mobile viewport.

## Sprint 2 preview (not built yet)

Discover feed (ranked matches with reasons), filters, profile deep view.
Sprint 3: pitches, inbox, intent states, booking handoff.

## Sprint 2 — Discovery & matching

- **Discover feed** (`/discover`): role-aware ranked matches for hosts
  (browse guests), guests (browse shows), and dual-role users (Guests/Shows
  toggle). Each card shows a 0–100 match score with evidence-based reasons.
- **Filters**: keyword search, topic chips, and (for shows) recording
  medium + session format. State lives in the URL so results are shareable.
- **Profile detail** (`/discover/[id]`): public one-sheet for any published
  profile.
- **Hybrid ranking** (`src/lib/ranking.ts`): 50% topic similarity (pgvector
  cosine when both profiles have embeddings, else shared-tag overlap), 20%
  format fit, 15% language/timezone fit, 10% activity recency, 5% profile
  quality. Deterministic top-20 sort.

### Apply the Sprint 2 migrations

The migrations add `pgvector` + embedding columns to `profiles` and a
`medium` column to `host_profiles`. Run in the Supabase SQL Editor:

```
supabase/migrations/20261001100000_pgvector_embeddings.sql
supabase/migrations/20261001100100_host_medium.sql
```

(A trigger marks newly published profiles `embedding_status='pending'`, which
the worker below picks up.)

### Embedding worker (your GPU box)

```
cd workers/embedder && cat README.md   # full setup guide
```

Outbound-only: polls `profiles` for `embedding_status='pending'`, computes
384-dim embeddings locally with BAAI/bge-small-en-v1.5, writes them back.
Needs `SUPABASE_URL` + the `service_role` key in `workers/embedder/.env`
(never in the app or git). Discovery works without it — it falls back to
tag-based ranking and says so on the results line.

### Demo seed

```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs
```

Seeds 6 published demo profiles (3 hosts, 3 guests, @getonshows.demo emails)
for testing discovery. Remove with `node scripts/seed-demo.mjs --remove`.

## Sprint 3 — Pitching, inbox & booking handoff

- **Pitch composer** (`src/components/PitchButton.tsx`): launched from
  Discover cards and the one-sheet. 4 templates (guest→host ×2, host→guest
  ×2) with profile-derived prefill and `[bracketed]` prompts that block
  sending until filled. 1,500-char limit with live counter. Quota banner
  shows remaining pitches. Idempotent — an existing thread reopens instead
  of duplicating.
- **Inbox** (`/inbox`): threads newest-first with unread counts, last-message
  preview, and intent badges. Badge on the nav Inbox tab (refreshes every
  30s).
- **Thread view** (`/inbox/[id]`): chronological bubbles, 5-second polling
  (deliberate choice over Realtime at pilot scale — simpler, no extra
  socket), mark-read on view, system messages for intent changes.
- **Intent workflow**: single shared `conversations.state` —
  pitched → replied → interested/passed → booked. Either side can set
  Interested/Pass/Booked; transitions are enforced server-side in
  `setIntent`. Pass archives the thread; Booked records the actor and opens
  the other party's booking link in a new tab.
- **Booking handoff**: `booking_url` now on both host and guest modules
  (guests set it in the builder's Story step).
- **Rate limits**: `pitch_quota(consume)` SECURITY DEFINER function —
  3 pitches/week for new accounts, 10/week once any pitch has drawn a reply
  ("raise after replies"). Quota row readable only by its owner.
- **Block & report**: `blocks` table (directional; discovery excludes blocked
  users both ways, messaging is banned both ways, shared threads archive);
  `reports` table with optional `conversation_id`. Report dialog and
  block/Report controls on threads and profile pages.

### Apply the Sprint 3 migration

In the Supabase SQL Editor:

```
supabase/migrations/20261001120000_sprint3_messaging.sql
```

Adds workflow columns to `conversations`, `booking_url` to
`guest_profiles`, `conversation_id` to `reports`, and new tables
`pitch_quotas`, `blocks`, `conversation_reads`, `events` — plus the
`pitch_quota()` function. Validate locally with `npm run db:validate`.
