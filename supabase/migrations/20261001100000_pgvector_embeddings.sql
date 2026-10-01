-- GetOnShows · Sprint 2: pgvector embeddings for hybrid ranked discovery
--
-- The local-GPU embedding worker (workers/embedder/) polls for profiles with
-- embedding_status = 'pending', computes a 384-dim embedding with
-- BAAI/bge-small-en-v1.5, and writes it back. Discovery blends cosine
-- similarity with explicit topic/format/recency signals, and falls back to
-- pure tag ranking when no embedding exists yet.
--
-- NOTE: this migration requires the pgvector extension, available on
-- Supabase out of the box. It is NOT available in the PGlite harness used
-- by `npm run db:validate`; see scripts/validate-migrations.mjs for how the
-- vector column/index are stubbed there.

create extension if not exists vector;

alter table public.profiles
  add column embedding vector(384),
  add column embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'done', 'error')),
  add column embedding_model text,
  add column embedding_updated_at timestamptz;

-- HNSW needs no training data (unlike ivfflat), so it works from the first
-- row. Cosine distance matches bge's normalized embeddings.
create index profiles_embedding_hnsw_idx
  on public.profiles using hnsw (embedding vector_cosine_ops);

-- Whenever a profile becomes published (insert or state change), mark it for
-- (re)embedding. The worker picks up 'pending' rows; the app never embeds.
create or replace function public.mark_embedding_pending()
returns trigger
language plpgsql
as $$
begin
  if new.state = 'published'
     and (tg_op = 'INSERT' or old.state is distinct from 'published') then
    new.embedding_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_mark_embedding_pending on public.profiles;
create trigger profiles_mark_embedding_pending
  before insert or update on public.profiles
  for each row execute function public.mark_embedding_pending();
