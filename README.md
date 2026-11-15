# Spot the Phish

A phone-first phishing awareness challenge for webinars. Players enter their name, email and phone, then judge 10 realistic emails as **Phishing** or **Legit**. Sign-ups and scores are saved to a Google Sheet.

```
index.html                  website + game
qr.html                     presenter page: QR code for the site + "Download PNG"
api/submit.js               Vercel serverless function -> Google Sheet
google-apps-script/Code.gs  paste into Google Apps Script (the Sheet receiver)
```

No build step, no dependencies.

## Setup (about 10 minutes)

### 1. Google Sheet
1. Create a new Google Sheet (e.g. "Spot the Phish leads").
2. **Extensions → Apps Script**. Delete the default code and paste `google-apps-script/Code.gs`.
3. Change `SECRET` to a long random string. Save.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**.
5. Authorize, then copy the **Web app URL** (ends in `/exec`).

### 2. Vercel
1. vercel.com → **Add New → Project** → import this GitHub repo.
2. Framework preset: **Other**. No build command. Deploy.
3. **Settings → Environment Variables**, add:
   - `SHEET_WEBHOOK_URL` = the Web app URL from step 1
   - `SHEET_SECRET` = the same string you put in `SECRET`
4. **Deployments → ⋯ → Redeploy** (env vars only apply to new deployments).

### 3. Test before the webinar
1. Open your Vercel URL on a phone (mobile data), fill the form, finish the game.
2. The Sheet should now have two tabs: `players` (sign-up) and `results` (score + answers).
3. If nothing appears: Vercel → Project → **Logs** shows the error from `api/submit.js`.

### 4. QR code
Open `https://YOUR-SITE/qr.html` → **Download PNG** → put it on your slide.
Also paste the link in the webinar chat. People watching on their phone can't scan their own screen.

## Notes
- If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version**, or the URL keeps running the old code.
- The game never blocks on the network: if saving fails, the player can still play.
- All companies, people and domains in the emails are fictional.
