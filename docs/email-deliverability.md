# Email deliverability: Resend SMTP + branded templates

Magic-link drop-off is the leakiest step in signup. These two changes fix the
two biggest causes: emails landing in spam (shared Supabase sender) and the
generic unbranded email body.

## Part 1: Resend custom SMTP (do once)

1. Sign up at resend.com (free tier covers 3,000 emails/month).
2. Add domain `getonshows.com`: Resend → Domains → Add Domain.
3. Add the DNS records Resend shows you (SPF, DKIM, DMARC TXT records) at your
   domain registrar. Wait for Resend to mark the domain "Verified".
4. Create an API key: Resend → API Keys → Create. Name it `supabase-auth`.
   Copy the key (starts with `re_`). Keep it secret, it never goes in chat
   or code.
5. Supabase dashboard → Project Settings → Authentication → SMTP Settings:
   - Enable custom SMTP: ON
   - Sender email: `noreply@getonshows.com`
   - Sender name: `GetOnShows`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the `re_...` API key from step 4
6. Send a test magic link to yourself from the login page and confirm it
   arrives in the inbox (not spam).

## Part 2: Branded magic-link template (do once)

Supabase dashboard → Authentication → Email Templates → "Magic Link".

- Subject: `Your GetOnShows sign-in link`
- Replace the body with the HTML below. `{{ .ConfirmationURL }}` is the
  variable Supabase fills in, keep it exactly as written.

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f2440;">
  <h2 style="margin:0 0 12px;font-size:22px;">Welcome to GetOnShows</h2>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
    Click the button below to sign in. This link expires soon and works only
    once. If you did not request it, you can safely ignore this email.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#FF5A36;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:12px;">
    Sign in to GetOnShows
  </a>
  <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
    Button not working? Copy this link into your browser:<br>
    <span style="word-break:break-all;">{{ .ConfirmationURL }}</span>
  </p>
</div>
```

Do the same branding pass on the "Confirm signup" template (subject:
`Confirm your GetOnShows account`) since password signups use it.

## What already shipped in code (commit: login deliverability batch)

- "Resend link" button with a 60-second cooldown on both the magic-link
  "Check your inbox" screen and the password-signup confirmation screen.
- Google button now carries a "Fastest" badge plus "One tap, no waiting on
  an email." so people pick the path with zero email round-trip.
- Email field hint: "Use an inbox you can open on this device right now."
  (counters the sign-up-on-desktop, inbox-on-phone leak).
