// Validates supabase/migrations/*.sql against real PostgreSQL (PGlite, WASM).
// Stubs the Supabase-managed `auth` and `storage` schemas so the migrations
// can run outside a Supabase project, then exercises key constraints,
// triggers, and Row Level Security behavior.
//
// Usage: npm run db:validate
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'supabase', 'migrations');

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    console.error(`  FAIL  ${name}`);
    failures += 1;
  }
}

const db = new PGlite();

// --- Stubs for Supabase-managed schemas ------------------------------------
// auth.uid() reads a session setting so RLS tests can impersonate users.
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('app.current_uid', true), '')::uuid
    $$;
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
  create table if not exists storage.objects (bucket_id text, name text);
  create or replace function storage.foldername(text) returns text[]
    language sql immutable as $$ select string_to_array($1, '/') $$;
  do $$ begin
    create role authenticated;
  exception when duplicate_object then null; end $$;
  do $$ begin
    create role anon;
  exception when duplicate_object then null; end $$;
  do $$ begin
    create role authenticated;
  exception when duplicate_object then null; end $$;
`);

// --- Apply migrations in order ----------------------------------------------
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

// pgvector is not available in PGlite. Try the real extension first; if the
// engine rejects it, validate the embedding migration in degraded mode:
// vector(384) becomes text and the HNSW index is skipped. This still exercises
// the new columns, defaults, CHECK constraints, and the pending trigger.
// The vector type and index themselves are validated on the live project.
let pgvectorOk = true;
try {
  await db.exec('create extension vector');
} catch {
  pgvectorOk = false;
  console.log('NOTE  pgvector unavailable in PGlite — degraded validation for the embeddings migration');
}

for (const f of files) {
  let sql = readFileSync(join(migrationsDir, f), 'utf8');
  if (!pgvectorOk && f.includes('pgvector')) {
    sql = sql
      .replace(/create extension if not exists vector;/gi, '-- (stubbed: pgvector unavailable in PGlite)')
      .replace(/vector\(384\)/g, 'text')
      .replace(/create index[\s\S]*?;\s*/gi, (m) =>
        /hnsw|vector_cosine/i.test(m) ? '-- (stubbed: vector index)\n' : m
      );
  }
  try {
    await db.exec(sql);
    console.log(`OK    ${f}${!pgvectorOk && f.includes('pgvector') ? '  (degraded)' : ''}`);
  } catch (e) {
    console.error(`FAIL  ${f}: ${e.message}`);
    failures += 1;
  }
}
if (failures > 0) process.exit(1);

// --- Grants for the RLS test role --------------------------------------------
await db.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

// --- Smoke tests (superuser bypasses RLS) ------------------------------------
console.log('\nSmoke tests:');
await db.exec(`
  insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'host@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'guest@example.com'),
    ('33333333-3333-3333-3333-333333333333', 'seed@example.com'),
    ('44444444-4444-4444-4444-444444444444', 'trigger@example.com');
`);
const provisioned = await db.query(
  `select count(*)::int as n from public.users where id in
   ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')`
);
check('handle_new_user trigger provisions public.users', provisioned.rows[0].n === 2);

await db.exec(`
  insert into public.profiles (id, user_id, display_name, bio, state)
  values ('a0000000-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          'Host One', 'A sufficiently long biography for testing purposes.', 'draft');
  insert into public.host_profiles (profile_id, show_name, format)
  values ('a0000000-0000-0000-0000-000000000001', 'Test Show', 'remote');
  insert into public.profiles (id, user_id, display_name, bio, state)
  values ('a0000000-0000-0000-0000-000000000002',
          '22222222-2222-2222-2222-222222222222',
          'Guest One', 'Another sufficiently long biography for testing.', 'published');
  insert into public.guest_profiles (profile_id, expertise)
  values ('a0000000-0000-0000-0000-000000000002', 'Testing things');
  insert into public.profile_topics (profile_id, topic_id)
  values ('a0000000-0000-0000-0000-000000000001',
          (select id from public.topics where slug = 'podcasting-media'));
`);
check('profile + host module + topics round-trip', true);

const topicCount = await db.query(`select count(*)::int as n from public.topics`);
check('20 curated topics seeded', topicCount.rows[0].n === 20);

let badStateRejected = false;
try {
  await db.exec(`update public.profiles set state = 'bogus'
                 where id = 'a0000000-0000-0000-0000-000000000001'`);
} catch {
  badStateRejected = true;
}
check('profile state CHECK constraint rejects invalid state', badStateRejected);

let selfMatchRejected = false;
try {
  await db.exec(`insert into public.matches (profile_a_id, profile_b_id)
                 values ('a0000000-0000-0000-0000-000000000001',
                         'a0000000-0000-0000-0000-000000000001')`);
} catch {
  selfMatchRejected = true;
}
check('matches CHECK rejects self-pairing', selfMatchRejected);

let badConvRejected = false;
try {
  await db.exec(`insert into public.conversations
                 (host_profile_id, guest_profile_id, state)
                 values ('a0000000-0000-0000-0000-000000000001',
                         'a0000000-0000-0000-0000-000000000002', 'nonsense')`);
} catch {
  badConvRejected = true;
}
check('conversation state CHECK rejects invalid state', badConvRejected);

const bucket = await db.query(
  `select public from storage.buckets where id = 'profile-photos'`
);
check('profile-photos storage bucket created', bucket.rows[0]?.public === true);

// --- Sprint 2: embedding columns, trigger, and host medium -------------------
const embCols = await db.query(
  `select column_name, column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name in ('embedding', 'embedding_status', 'embedding_model', 'embedding_updated_at')`
);
check('profiles has 4 embedding columns', embCols.rows.length === 4);
const statusCol = embCols.rows.find((r) => r.column_name === 'embedding_status');
check(
  "embedding_status defaults to 'pending'",
  !!statusCol && /pending/.test(statusCol.column_default ?? '')
);

let badStatusRejected = false;
try {
  await db.exec(`update public.profiles set embedding_status = 'bogus'
                 where id = 'a0000000-0000-0000-0000-000000000001'`);
} catch {
  badStatusRejected = true;
}
check('embedding_status CHECK rejects invalid value', badStatusRejected);

// Trigger: publishing marks the profile for (re)embedding.
// Uses a dedicated fixture so the RLS draft fixtures stay untouched.
await db.exec(`
  insert into public.profiles (id, user_id, display_name, bio, state)
  values ('a0000000-0000-0000-0000-000000000004',
          '44444444-4444-4444-4444-444444444444',
          'Trigger Host', 'A sufficiently long biography for trigger testing.', 'draft')`);
await db.exec(`update public.profiles set state = 'published'
               where id = 'a0000000-0000-0000-0000-000000000004'`);
const pendingAfterPublish = await db.query(
  `select embedding_status from public.profiles
   where id = 'a0000000-0000-0000-0000-000000000004'`
);
check(
  "publish trigger sets embedding_status='pending'",
  pendingAfterPublish.rows[0].embedding_status === 'pending'
);

// A non-publish edit must NOT reset a completed embedding.
await db.exec(`update public.profiles set embedding_status = 'done'
               where id = 'a0000000-0000-0000-0000-000000000004'`);
await db.exec(`update public.profiles set bio = 'Edited biography for testing purposes, still long enough.'
               where id = 'a0000000-0000-0000-0000-000000000004'`);
const stillDone = await db.query(
  `select embedding_status from public.profiles
   where id = 'a0000000-0000-0000-0000-000000000004'`
);
check(
  "non-publish edit keeps embedding_status='done'",
  stillDone.rows[0].embedding_status === 'done'
);

// Direct insert of a published profile is also picked up.
await db.exec(`
  insert into public.profiles (id, user_id, display_name, bio, state)
  values ('a0000000-0000-0000-0000-000000000003',
          '33333333-3333-3333-3333-333333333333',
          'Seed Host', 'A sufficiently long biography for trigger testing.', 'published')`);
const pendingAfterInsert = await db.query(
  `select embedding_status from public.profiles
   where id = 'a0000000-0000-0000-0000-000000000003'`
);
check(
  "insert-as-published sets embedding_status='pending'",
  pendingAfterInsert.rows[0].embedding_status === 'pending'
);

const mediumCol = await db.query(
  `select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'host_profiles'
     and column_name = 'medium'`
);
check('host_profiles has medium column', mediumCol.rows.length === 1);

let badMediumRejected = false;
try {
  await db.exec(`update public.host_profiles set medium = 'hologram'
                 where profile_id = 'a0000000-0000-0000-0000-000000000001'`);
} catch {
  badMediumRejected = true;
}
check('medium CHECK rejects invalid value', badMediumRejected);

// --- RLS behavior tests (as authenticated, impersonating each account) ------------
console.log('\nRLS tests:');
await db.exec(`set role authenticated;`);

async function asUser(uid, sql) {
  await db.exec(`set app.current_uid = '${uid}';`);
  return db.query(sql);
}

const HOST = '11111111-1111-1111-1111-111111111111';
const GUEST = '22222222-2222-2222-2222-222222222222';

const ownDraft = await asUser(
  HOST,
  `select count(*)::int as n from public.profiles where user_id = '${HOST}'`
);
check('owner can read own draft', ownDraft.rows[0].n === 1);

const crossDraft = await asUser(
  GUEST,
  `select count(*)::int as n from public.profiles where user_id = '${HOST}'`
);
check("non-owner cannot read another user's draft", crossDraft.rows[0].n === 0);

const publishedVisible = await asUser(
  HOST,
  `select count(*)::int as n from public.profiles
   where id = 'a0000000-0000-0000-0000-000000000002'`
);
check('published profile visible to other users', publishedVisible.rows[0].n === 1);

let crossWriteBlocked = false;
try {
  await asUser(
    GUEST,
    `update public.profiles set bio = 'hacked'
     where id = 'a0000000-0000-0000-0000-000000000001'`
  );
  const after = await db.query(
    `select bio from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'`
  );
  crossWriteBlocked = after.rows[0].bio !== 'hacked';
} catch {
  crossWriteBlocked = true;
}
check("non-owner cannot update another user's profile", crossWriteBlocked);

const ownTopics = await asUser(
  HOST,
  `select count(*)::int as n from public.profile_topics
   where profile_id = 'a0000000-0000-0000-0000-000000000001'`
);
check('owner reads own topic assignments', ownTopics.rows[0].n === 1);

const crossTopics = await asUser(
  GUEST,
  `select count(*)::int as n from public.profile_topics
   where profile_id = 'a0000000-0000-0000-0000-000000000001'`
);
check("non-owner cannot read another user's draft topic assignments", crossTopics.rows[0].n === 0);

let crossThreadBlocked = false;
try {
  await asUser(HOST, `
    insert into public.conversations (host_profile_id, guest_profile_id)
    values ('a0000000-0000-0000-0000-000000000001',
            'a0000000-0000-0000-0000-000000000002');
  `);
  const convs = await asUser(
    GUEST,
    `select count(*)::int as n from public.conversations`
  );
  // guest is a participant, so they CAN read it; create a third-party check instead
  crossThreadBlocked = convs.rows[0].n === 1;
} catch {
  crossThreadBlocked = false;
}
check('conversation participant can read own thread', crossThreadBlocked);

// ---------------------------------------------------------------------------
// Sprint 3: pitch quotas, blocks, reads, events
// ---------------------------------------------------------------------------

const quota1 = await asUser(
  HOST,
  `select public.pitch_quota(false) as q`
);
check(
  'quota peek allows fresh account with limit 5',
  quota1.rows[0].q.allowed === true && quota1.rows[0].q.limit === 5
);

const quota2 = await asUser(
  HOST,
  `select public.pitch_quota(true) as q`
);
check(
  'quota consume decrements remaining',
  quota2.rows[0].q.allowed === true && quota2.rows[0].q.remaining === 4
);

let quotaRowVisible = false;
try {
  const r = await asUser(
    HOST,
    `select sent_count from public.pitch_quotas where user_id = '${HOST}'`
  );
  quotaRowVisible = r.rows[0]?.sent_count === 1;
} catch {
  quotaRowVisible = false;
}
check('user can read own quota row', quotaRowVisible);

let quotaCrossHidden = true;
try {
  const r = await asUser(
    GUEST,
    `select count(*)::int as n from public.pitch_quotas where user_id = '${HOST}'`
  );
  quotaCrossHidden = r.rows[0].n === 0;
} catch {
  quotaCrossHidden = true;
}
check("non-owner cannot read another user's quota row", quotaCrossHidden);

await asUser(
  HOST,
  `insert into public.blocks (blocker_user_id, blocked_user_id)
   values ('${HOST}', '${GUEST}')
   on conflict do nothing`
);
const blockOk = await asUser(
  HOST,
  `select count(*)::int as n from public.blocks where blocker_user_id = '${HOST}'`
);
check('user can block another user', blockOk.rows[0].n === 1);

let selfBlockBlocked = false;
try {
  await asUser(
    HOST,
    `insert into public.blocks (blocker_user_id, blocked_user_id)
     values ('${HOST}', '${HOST}')`
  );
} catch {
  selfBlockBlocked = true;
}
check('self-block is rejected by check constraint', selfBlockBlocked);

const blockVisible = await asUser(
  GUEST,
  `select count(*)::int as n from public.blocks where blocker_user_id = '${HOST}'`
);
check('block rows are invisible to other users', blockVisible.rows[0].n === 0);

await asUser(
  HOST,
  `insert into public.conversation_reads (conversation_id, user_id)
   select id, '${HOST}' from public.conversations limit 1
   on conflict (conversation_id, user_id) do nothing`
);
const readOk = await asUser(
  HOST,
  `select count(*)::int as n from public.conversation_reads where user_id = '${HOST}'`
);
check('user can upsert own read watermark', readOk.rows[0].n === 1);

const eventOk = await asUser(
  HOST,
  `insert into public.events (name, user_id, properties)
   values ('pitch_sent', '${HOST}', '{"role":"guest"}')
   returning id`
);
check('user can log own analytics event', eventOk.rows.length === 1);

let badEventBlocked = false;
try {
  await asUser(
    HOST,
    `insert into public.events (name, user_id) values ('message_body_leak', '${HOST}')`
  );
} catch {
  badEventBlocked = true;
}
check('event names are constrained by check', badEventBlocked);

const eventAllowlist = await db.query(`
  select pg_get_constraintdef(oid) as def
  from pg_constraint
  where conname = 'events_name_check'
`);
const allowDef = eventAllowlist.rows[0]?.def ?? "";
for (const name of ["builder_step", "pitch_withdrawn", "recording_completed"]) {
  check(`events allowlist includes ${name}`, allowDef.includes(`'${name}'`));
}

const newCols = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'conversations'
    and column_name in ('pitched_by_profile_id','archived','state_changed_at','state_changed_by_profile_id')
`);
check('conversations carries sprint-3 workflow columns', newCols.rows.length === 4);

const guestCols = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'guest_profiles'
    and column_name = 'booking_url'
`);
check('guest_profiles has booking_url', guestCols.rows.length === 1);

const reportCols = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'reports'
    and column_name = 'conversation_id'
`);
check('reports links to conversations', reportCols.rows.length === 1);

const agreedCols = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'conversations'
    and column_name = 'agreed_at'
`);
check('conversations carries agreed_at for confirmed bookings', agreedCols.rows.length === 1);

const roleFn = await db.query(`
  select routine_name from information_schema.routines
  where routine_schema = 'public' and routine_name = 'profile_role'
`);
check('profile_role() exists for canonical role labels', roleFn.rows.length === 1);

const notifCol = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'users'
    and column_name = 'email_notifications'
`);
check('users carries email_notifications preference', notifCol.rows.length === 1);

const peerFn = await db.query(`
  select routine_name from information_schema.routines
  where routine_schema = 'public' and routine_name = 'conversation_peer_contact'
`);
check('conversation_peer_contact() exists for notification addressing', peerFn.rows.length === 1);

const completionCols = await db.query(`
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'conversations'
    and column_name in ('recording_confirmed_by','recording_declined_by','completed_at')
`);
check('conversations carries recording completion columns', completionCols.rows.length === 3);

const refundFn = await db.query(`
  select routine_name from information_schema.routines
  where routine_schema = 'public' and routine_name = 'pitch_quota_refund'
`);
check('pitch_quota_refund() exists for pitch withdrawal', refundFn.rows.length === 1);

const withdrawPolicy = await db.query(`
  select policyname from pg_policies
  where schemaname = 'public' and tablename = 'conversations'
    and policyname = 'Pitcher deletes own unanswered pitch'
`);
check('conversations has the pitch-withdrawal delete policy', withdrawPolicy.rows.length === 1);

const collabFn = await db.query(`
  select prosrc from pg_proc
  where proname = 'profile_collaborations'
`);
check(
  'profile_collaborations() returns agreed_at for the Confirmed badge',
  collabFn.rows.length === 1 && collabFn.rows[0].prosrc.includes('agreed_at')
);

const statsFn = await db.query(`
  select prosrc from pg_proc
  where proname = 'profile_public_stats'
`);
check(
  'profile_public_stats() splits bookings_upcoming / bookings_completed',
  statsFn.rows.length === 1 &&
    statsFn.rows[0].prosrc.includes('bookings_upcoming') &&
    statsFn.rows[0].prosrc.includes('bookings_completed')
);

const ratingsTable = await db.query(`
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'ratings'
`);
check('ratings table exists', ratingsTable.rows.length === 1);

const ratingsFn = await db.query(`
  select prosrc from pg_proc
  where proname = 'profile_ratings'
`);
check(
  'profile_ratings() returns per-role aggregates',
  ratingsFn.rows.length === 1 &&
    ratingsFn.rows[0].prosrc.includes('as_host') &&
    ratingsFn.rows[0].prosrc.includes('as_guest')
);

await db.exec(`reset role;`);

console.log(failures === 0 ? '\nAll migration checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
