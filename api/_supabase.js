// Minimal Supabase REST helper (no npm dependencies needed).
// Env vars (Vercel > Settings > Environment Variables):
//   SUPABASE_URL               e.g. https://abcdxyz.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API Keys > service_role (secret!)

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set on Vercel");
  return { url, key };
}

function headers(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
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
