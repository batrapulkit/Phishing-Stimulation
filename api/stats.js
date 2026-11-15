// Vercel serverless function: cumulative stats for /dashboard.
// Reads scores from Supabase and returns aggregates only.
// Emails and phone numbers are never selected, so they never leave the database.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (see api/_supabase.js)
//   DASHBOARD_KEY  - optional. If set, the dashboard must be opened with ?key=<value>
//
// Query: ?since=<ISO date>  only count entries at/after this time (e.g. this webinar)

const { selectAll, count } = require("./_supabase");

const N_EMAILS = 10;

function displayName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Anonymous";
  const first = parts[0].slice(0, 18);
  const last = parts.length > 1 ? " " + parts[parts.length - 1][0].toUpperCase() + "." : "";
  return first.charAt(0).toUpperCase() + first.slice(1) + last;
}

function tierOf(s) {
  if (s === 10) return "phishProof";
  if (s >= 8) return "strong";
  if (s >= 5) return "atRisk";
  return "highRisk";
}

function aggregate(players, results) {
  const completed = results.length;
  const scores = results.map(r => parseInt(String(r.score).split("/")[0], 10)).map(n => (Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0));
  const distribution = Array(11).fill(0);
  const tiers = { phishProof: 0, strong: 0, atRisk: 0, highRisk: 0 };
  scores.forEach(s => { distribution[s]++; tiers[tierOf(s)]++; });

  const sorted = [...scores].sort((a, b) => a - b);
  const median = completed ? (completed % 2 ? sorted[(completed - 1) / 2] : (sorted[completed / 2 - 1] + sorted[completed / 2]) / 2) : 0;
  const avg = completed ? scores.reduce((a, b) => a + b, 0) / completed : 0;

  const perEmail = Array.from({ length: N_EMAILS }, () => ({ correct: 0, n: 0 }));
  results.forEach(r => {
    String(r.answers).split(/\s+/).forEach(tok => {
      const m = tok.match(/^(\d+):(✓|✗)$/);
      if (!m) return;
      const i = Number(m[1]) - 1;
      if (i < 0 || i >= N_EMAILS) return;
      perEmail[i].n++;
      if (m[2] === "✓") perEmail[i].correct++;
    });
  });

  const breached = results.filter(r => Number(r.missed) > 0).length;
  const totalMissed = results.reduce((a, r) => a + (Number(r.missed) || 0), 0);
  const totalFa = results.reduce((a, r) => a + (Number(r.fa) || 0), 0);

  const withScore = results.map((r, i) => ({ name: displayName(r.name), score: scores[i], t: r.t }));
  const leaderboard = [...withScore]
    .sort((a, b) => b.score - a.score || new Date(a.t) - new Date(b.t))
    .slice(0, 10);
  const recent = [...withScore].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);

  return {
    signups: players.length,
    completed,
    completionRate: players.length ? completed / players.length : 0,
    avgScore: avg,
    medianScore: median,
    breachedPct: completed ? breached / completed : 0,
    phishMissRate: completed ? totalMissed / (completed * 6) : 0,
    falseAlarmRate: completed ? totalFa / (completed * 4) : 0,
    distribution,
    tiers,
    perEmail: perEmail.map((p, i) => ({ id: i + 1, n: p.n, correctPct: p.n ? p.correct / p.n : null })),
    leaderboard,
    recent,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.DASHBOARD_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const filter = since && !isNaN(since) ? `created_at=gte.${encodeURIComponent(since.toISOString())}` : "";
    const [signups, rows] = await Promise.all([
      count("players", filter),
      selectAll("results", `select=created_at,name,score,phishing_missed,legit_reported,answers&order=created_at.asc${filter ? "&" + filter : ""}`),
    ]);
    const results = rows.map(r => ({ t: r.created_at, name: r.name || "", score: `${r.score}/10`, missed: r.phishing_missed, fa: r.legit_reported, answers: r.answers || "" }));
    const players = Array.from({ length: signups });
    return res.status(200).json({ ok: true, updatedAt: new Date().toISOString(), ...aggregate(players, results) });
  } catch (err) {
    console.error("stats failed:", err.message);
    return res.status(502).json({ ok: false, error: /not set/.test(err.message) ? err.message : "Could not read from Supabase. Check the Vercel logs." });
  }
};

module.exports.aggregate = aggregate;
