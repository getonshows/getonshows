# GetOnShows embedding worker

Computes 384-dim embeddings for published profiles on **your own hardware**
(local GPU server). Discovery blends these with topic/format signals for
ranked matches; when no embedding exists, discovery falls back to tag-based
ranking automatically.

## Architecture (important)

```
Your GPU box                          Supabase (cloud)
─────────────                         ────────────────
embedder.py ──GET /profiles?embedding_status=pending──▶
            ◀──────── profile rows ────────────────────
  sentence-transformers (local, bge-small-en-v1.5)
embedder.py ──PATCH /profiles {embedding, status}─────▶
```

- The worker initiates **all** connections outbound. The Next.js app never
  calls into your server — nothing to expose, no firewall holes, no dynamic
  DNS. This is what keeps it working when the app is hosted on Vercel.
- A Postgres trigger (`profiles_mark_embedding_pending`) marks a profile
  `pending` whenever it becomes published, so the worker picks it up.
- The `service_role` key bypasses row-level security. It lives **only** in
  this worker's `.env` on your server — never in the Next.js app, never in
  git (`.env` is gitignored).

## Install

```bash
cd workers/embedder
python3 -m venv venv
source venv/bin/activate
# CPU-only (fine for the pilot — embeddings run once per profile save):
pip install -r requirements.txt
# ...or NVIDIA GPU:
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt

cp .env.example .env
# edit .env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# (Supabase dashboard → Project Settings → API → service_role)
```

## Run

```bash
source venv/bin/activate
python embedder.py --once            # single pass, then exit (good first test)
python embedder.py --loop           # poll every POLL_INTERVAL_SECONDS
python embedder.py --loop --interval 120
```

First run downloads the ~130 MB model from Hugging Face, then it's cached
locally. Expect a few seconds per profile on CPU, well under a second on GPU.

## Run as a daemon (systemd)

```bash
sudo cp embedder.service.example /etc/systemd/system/getonshows-embedder.service
# edit paths/user inside the unit file first
sudo systemctl daemon-reload
sudo systemctl enable --now getonshows-embedder.service
sudo journalctl -u getonshows-embedder.service -f   # watch the logs
```

## Choosing a different embedding model

1. Pick a sentence-transformers model and note its output dimension `N`.
2. Update the migration: `supabase/migrations/20261001100000_pgvector_embeddings.sql`
   → change `vector(384)` to `vector(N)`, apply to Supabase.
3. Set `EMBEDDING_MODEL=<model-id>` in `.env`.
4. Reset existing embeddings so they recompute with the new model:
   ```sql
   update public.profiles
   set embedding_status = 'pending', embedding = null
   where state = 'published';
   ```

BAAI/bge-small-en-v1.5 was chosen because it's small, fast, runs on CPU in a
pinch, and its 384-dim output keeps the database lean at pilot scale.

## Failure handling

- A profile that fails 3 consecutive times is parked as
  `embedding_status='error'` so one bad row can't stall the queue.
- To retry parked rows: `update public.profiles set embedding_status='pending'
  where embedding_status='error';`
- Discovery never breaks when the worker is down — it falls back to
  topic/format ranking and says so on the results count line.
