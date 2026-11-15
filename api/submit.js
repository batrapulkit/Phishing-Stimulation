// Vercel serverless function: receives sign-ups and results from the game
// and forwards them to a Google Sheet via a Google Apps Script web app.
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   SHEET_WEBHOOK_URL  - the Apps Script web app URL (ends in /exec)
//   SHEET_SECRET       - any random string; must match SECRET in Code.gs

const FIELDS = {
  players: ["name", "email", "phone", "consent"],
  results: ["name", "email", "phone", "score", "phishing_missed", "legit_reported", "answers"],
};

const clean = (v, max = 200) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

// Stop spreadsheet formula injection (cells starting with = + - @)
const safeCell = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real people never fill this hidden field
  if (body.website) return res.status(200).json({ ok: true });

  const type = body.type;
  if (!FIELDS[type]) return res.status(400).json({ ok: false, error: "Unknown type" });

  const email = clean(body.email, 120);
  const phoneDigits = clean(body.phone, 30).replace(/\D/g, "");
  if (clean(body.name).length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.status(400).json({ ok: false, error: "Invalid details" });
  }

  const row = { type };
  for (const f of FIELDS[type]) row[f] = safeCell(clean(body[f]));
  row.user_agent = clean(req.headers["user-agent"], 160);

  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) {
    console.error("SHEET_WEBHOOK_URL is not set");
    return res.status(500).json({ ok: false, error: "Not configured" });
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.SHEET_SECRET || "", ...row }),
      redirect: "follow",
    });
    const text = await r.text();
    if (!r.ok || text.includes('"ok":false')) {
      console.error("Sheet error:", r.status, text.slice(0, 300));
      return res.status(502).json({ ok: false, error: "Sheet write failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Sheet request failed:", err);
    return res.status(502).json({ ok: false, error: "Sheet unreachable" });
  }
};
