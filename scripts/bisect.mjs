import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

// Split SQL on semicolons, respecting dollar-quoted strings, single-quoted
// strings, line comments, and block comments.
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  let dollarTag = null;
  const n = sql.length;
  while (i < n) {
    if (dollarTag) {
      const end = sql.indexOf(dollarTag, i);
      if (end === -1) { cur += sql.slice(i); break; }
      cur += sql.slice(i, end + dollarTag.length);
      i = end + dollarTag.length;
      dollarTag = null;
      continue;
    }
    const ch = sql[i];
    const two = sql.slice(i, i + 2);
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      cur += sql.slice(i, nl === -1 ? n : nl);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      cur += sql.slice(i, end === -1 ? n : end + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === "'") {
      const end = sql.indexOf("'", i + 1);
      cur += sql.slice(i, end === -1 ? n : end + 1);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const dm = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
    if (dm) {
      dollarTag = dm[0];
      cur += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === ';') {
      cur += ch;
      if (cur.trim()) stmts.push(cur.trim());
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

const sql = readFileSync(
  new URL('../supabase/migrations/20261001090000_initial_schema.sql', import.meta.url),
  'utf8'
);
const stmts = splitStatements(sql);
console.log(`Found ${stmts.length} statements`);

const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key, email text);
  create or replace function auth.uid() returns uuid language sql stable as $fn$ select null::uuid $fn$;
  create schema if not exists storage;
  create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
  create table if not exists storage.objects (bucket_id text, name text);
  create or replace function storage.foldername(text) returns text[] language sql immutable as $fn$ select string_to_array($1, '/') $fn$;
`);
await db.exec(`do $b$ begin create role authenticated; exception when duplicate_object then null; end $b$;`);
await db.exec(`do $b$ begin create role anon; exception when duplicate_object then null; end $b$;`);

for (let i = 0; i < stmts.length; i++) {
  // skip pure comments
  if (/^--/.test(stmts[i]) && !/create|insert|alter|drop/i.test(stmts[i])) continue;
  try {
    await db.exec(stmts[i]);
  } catch (e) {
    console.log(`STATEMENT ${i} FAILED: ${e.message}`);
    console.log('---');
    console.log(stmts[i].slice(0, 600));
    process.exit(1);
  }
}
console.log(`All ${stmts.length} statements applied OK`);
