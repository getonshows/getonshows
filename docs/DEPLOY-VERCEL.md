# GetOnShows — deploy to Vercel + wire getonshows.com

Sprint 1 is verified locally. This is the path to a public link
(you can open it on your phone) and the same pipeline we'll use at launch.

## What you need
- A GitHub account
- A Vercel account (sign up with GitHub — one click)
- Access to wherever getonshows.com was registered (for DNS)

## 1. Push the repo to GitHub
Create a new **empty** repo on github.com named `getonshows` (no README, no .gitignore),
then (the zip ships without git history, so init first):
```bash
cd <unzipped-sprint-folder>
git init -b main
git add .
git commit -m "GetOnShows"
git remote add origin git@github.com:<your-username>/getonshows.git
git push -u origin main
```
(`.env.local` is already gitignored — your keys will not be pushed.)

## 2. Import into Vercel
1. vercel.com → **Add New… → Project** → **Import** the `getonshows` repo.
2. Framework preset is auto-detected as Next.js — leave build settings as-is.
3. Under **Environment Variables**, add all three (apply to Production, Preview, Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://tqrjlqxdrblbcqppkecb.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key (the one starting `sb_publishable_…`)
   - `ADMIN_EMAILS` = your login email (gates the /admin/funnel dashboard)
4. **Deploy.** You'll get a `getonshows-*.vercel.app` link in ~2 minutes.

## 3. Point getonshows.com at Vercel
1. In the Vercel project: **Settings → Domains** → add `getonshows.com` (add `www.getonshows.com` too).
2. Vercel will show the exact DNS records — typically:
   - A record for `@` → Vercel's IP
   - CNAME for `www` → `cname.vercel-dns.com`
3. Add those at your domain registrar. SSL certificate issues automatically (a few minutes).

## 4. Flip Supabase to the live domain
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL** → `https://getonshows.com`
- **Redirect URLs** → add `https://getonshows.com/auth/callback` (the app builds this
  URL dynamically from the domain; keep `http://localhost:3000/auth/callback` too for local dev)
- Without this, magic-link emails still point at localhost.

## 5. Smoke-test the live loop
Open getonshows.com → sign in → pick a role → publish a profile.

## Gotchas
- **Magic-link email doesn't arrive?** Check spam first. Then know: Supabase's
  free tier silently sends only ~2 auth emails/hour — every resend burns one.
  Wait an hour rather than hammering resend. (Later: add custom SMTP via
  Resend for real sending limits.)
- Open the magic-link email on the **same machine** running the app
  (localhost) or on the device matching the deployed domain.
- Each deploy preview gets its own URL; production env vars only apply to
  the production deployment — that's fine for now.
