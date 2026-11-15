// Vercel serverless function: saves sign-ups and results from the game to Supabase.
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see api/_supabase.js)

const { insert } = require("./_supabase");

const clean = (v, max = 200) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const orNull = (v) => (v === "" ? null : v);
const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: real people never fill this hidden field
  if (body.website) return res.status(200).json({ ok: true });

  const type = body.type;
  if (type !== "players" && type !== "results") return res.status(400).json({ ok: false, error: "Unknown type" });

  // Name, email and phone are all optional; if given, they must look valid.
  const name = clean(body.name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const phone = clean(body.phone, 30);
  const phoneDigits = phone.replace(/\D/g, "");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "Invalid email" });
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) return res.status(400).json({ ok: false, error: "Invalid phone" });

  const base = {
    name: orNull(name),
    email: orNull(email),
    phone: orNull(phone),
    user_agent: orNull(clean(req.headers["user-agent"], 160)),
  };

  let table, row;
  if (type === "players") {
    table = "players";
    row = { ...base, consent: body.consent === "yes" || body.consent === true };
  } else {
    const score = int(String(body.score || "").split("/")[0], 0, 10);
    if (score === null || !/^\d{1,2}\/10$/.test(clean(body.score))) return res.status(400).json({ ok: false, error: "Invalid score" });
    table = "results";
    row = {
      ...base,
      score,
      phishing_missed: int(body.phishing_missed, 0, 6) ?? 0,
      legit_reported: int(body.legit_reported, 0, 4) ?? 0,
      answers: orNull(clean(body.answers, 120)),
    };
  }

  try {
    await insert(table, row);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err.message);
    return res.status(502).json({ ok: false, error: "Could not save" });
  }
};
