// Minimal Supabase REST helper (no npm dependencies needed).
// Env vars (Vercel > Settings > Environment Variables):
//   SUPABASE_URL         e.g. https://abcdxyz.supabase.co   (NEXT_PUBLIC_SUPABASE_URL also works)
//   SUPABASE_SECRET_KEY  Supabase > Project Settings > API Keys > Secret key "sb_secret_..."
//                        (or the legacy service_role JWT in SUPABASE_SERVICE_ROLE_KEY)
// The publishable key is NOT enough: tables have RLS on, so only a secret key can read/write.

function config() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url) throw new Error("SUPABASE_URL is not set on Vercel");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set on Vercel");
  if (key.startsWith("sb_publishable_")) throw new Error("SUPABASE_SECRET_KEY is set to the publishable key. Use the sb_secret_ key instead");
  return { url, key };
}

function headers(key, extra = {}) {
  const h = { apikey: key, "Content-Type": "application/json", ...extra };
  // Legacy service_role keys are JWTs and go in Authorization too.
  // New sb_secret_ keys are not JWTs: send them only as apikey.
  if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`;
  return h;
}

async function insert(table, row) {
  const { url, key } = config();
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(key, { Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase insert into ${table} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// Fetch all rows matching a query, paging past Supabase's 1000-row limit.
async function selectAll(table, query) {
  const { url, key } = config();
  const pageSize = 1000;
  const out = [];
  for (let from = 0; from < 100000; from += pageSize) {
    const r = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: headers(key, { Range: `${from}-${from + pageSize - 1}`, "Range-Unit": "items" }),
    });
    if (!r.ok && r.status !== 206) throw new Error(`Supabase read of ${table} failed: ${r.status} ${(await r.text()).slice(0, 300)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

// Count rows without downloading them.
async function count(table, query) {
  const { url, key } = config();
  const r = await fetch(`${url}/rest/v1/${table}?select=id${query ? "&" + query : ""}`, {
    method: "HEAD",
    headers: headers(key, { Prefer: "count=exact", Range: "0-0" }),
  });
  if (!r.ok && r.status !== 206) throw new Error(`Supabase count of ${table} failed: ${r.status}`);
  const range = r.headers.get("content-range") || "*/0"; // e.g. "0-0/46"
  return Number(range.split("/")[1]) || 0;
}

module.exports = { insert, selectAll, count };
