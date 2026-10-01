# GetOnShows — Environments

## Separation

| Environment | Supabase project | Hosting | Purpose |
|---|---|---|---|
| Local dev | `tqrjlqxdrblbcqppkecb` (shared dev project) | `npm run dev` on localhost:3000 | Day-to-day building |
| Preview | **separate Supabase project** (create per deployment) | Vercel preview deployment | Pre-merge checks |
| Production | **separate Supabase project** | Vercel → getonshows.com | Real users |

Rules:

- **Never share a `service_role` key between environments.** Each Supabase
  project has its own. The key lives only in two places: the Supabase
  dashboard, and the embedding worker's `.env` on the GPU box (for the
  project that worker serves). It is **never** in the Next.js app, never in
  `NEXT_PUBLIC_*` vars, never in git.
- **Preview and production are separate Supabase projects** with separate
  anon keys. Vercel environment variables are set per environment
  (Production vs Preview), never copied blindly between them.
- The app needs exactly two public env vars: `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `ADMIN_EMAILS` (comma-separated) gates the owner funnel dashboard
  (`/admin/funnel`). Set it in Vercel for production; leave it empty
  anywhere else and the dashboard 404s for everyone.
- Localhost stays in the Supabase Auth redirect allowlist alongside the
  production URL, so local dev keeps working after launch.

## Auth URL configuration (per project)

- Site URL: the environment's own origin (`http://localhost:3000` locally,
  `https://getonshows.com` in production).
- Redirect URLs: allowlist the environment's `/auth/callback` plus
  `http://localhost:3000/auth/callback` for dev.

## Session cookies

Set server-side with `httpOnly: true`, `SameSite=Lax`, `Secure` in
production (see `SESSION_COOKIE_OPTIONS` in `src/lib/supabase/server.ts`).
Localhost dev runs without `Secure` so plain HTTP keeps working.
