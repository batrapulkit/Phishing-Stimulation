# Spot the Phish

A phone-first phishing awareness challenge for webinars. Players (optionally) enter their name, email and phone, then judge 10 realistic emails as **Phishing** or **Legit** in a full-screen inbox, and finish on a scorecard with a call-to-action. Results are stored in **Supabase** and shown live on a presenter dashboard.

```
index.html            website + game + scorecard
dashboard.html        live cumulative results for the presenter   (/dashboard)
qr.html               QR code for the site + "Download PNG"         (/qr)
api/submit.js         saves sign-ups and results to Supabase
api/stats.js          aggregates results for the dashboard (never returns emails/phones)
api/_supabase.js      tiny Supabase REST helper (no npm install needed)
supabase/schema.sql   run once in Supabase to create the tables
vercel.json           clean URLs
```

No build step, no dependencies.

## Setup (about 10 minutes)

### 1. Supabase
1. supabase.com → **New project** (any name, e.g. `spot-the-phish`; region: Mumbai for India). Save the DB password somewhere.
2. Left menu **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   You should now see tables `players` and `results` in **Table Editor**.
3. **Project Settings → API Keys** (or **Data API**). Copy:
   - **Project URL** → e.g. `https://abcdxyz.supabase.co`
   - **service_role** secret key (click Reveal). ⚠️ Keep this secret: never put it in the HTML.

### 2. Vercel
1. vercel.com → **Add New → Project** → import this repo. Framework preset: **Other**. Deploy.
   Tip: set the project name to `spot-the-phish` so your link doesn't say "stimulation".
2. **Settings → Environment Variables**, add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the service_role key
   - `DASHBOARD_KEY` = any password for the live dashboard
3. **Deployments → ⋯ → Redeploy** (variables only apply to new deployments).

### 3. Test before the webinar
1. Open your site on a phone (mobile data), play all 10 emails.
2. Supabase **Table Editor** → `players` and `results` should each have a new row.
3. Open `https://YOUR-SITE/dashboard?key=YOUR_DASHBOARD_KEY`: your score should appear.
4. Nothing saved? Vercel → Project → **Logs** shows the exact Supabase error.

## Where are my leads?
Supabase → **Table Editor**:
- `players`: everyone who started (name/email/phone may be empty, all optional)
- `results`: everyone who finished, with score and per-email answers
- `leads` (view): people who left an email or phone, with their latest score → **Export → CSV**

## Security
- Row Level Security is **on** with no public policies, so the public/anon key can't read anything.
- Only the Vercel functions use the service_role key, server-side.
- The dashboard only receives scores and "First L." names, never emails or phone numbers.

## Live dashboard
`https://YOUR-SITE/dashboard?key=YOUR_DASHBOARD_KEY`. The key is removed from the address bar after
loading, so it won't show in screen shares. Refreshes every 10s. Filter: Last hour / Today / All time.

## Set your call-to-action (scorecard)
Edit the `CONFIG` block near the bottom of `index.html` (search for `CONFIG`):
```js
ctaButton: "Book a free security session →",
ctaUrl:    "#",   // <-- your Calendly / WhatsApp / course / form link
```
Commit and push; Vercel redeploys automatically.

## QR code
Open `https://YOUR-SITE/qr` → **Download PNG** → put it on your slide.
Also paste the link in the webinar chat (people watching on their phone can't scan their own screen).

All companies, people and domains in the emails are fictional.
