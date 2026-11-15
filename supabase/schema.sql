-- Spot the Phish: database schema
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- Everyone who pressed "Open my inbox" (all contact fields optional)
create table if not exists public.players (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text,
  email       text,
  phone       text,
  consent     boolean not null default false,
  user_agent  text
);

-- Everyone who finished all 10 emails
create table if not exists public.results (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  name             text,
  email            text,
  phone            text,
  score            smallint not null check (score between 0 and 10),
  phishing_missed  smallint not null default 0 check (phishing_missed between 0 and 6),
  legit_reported   smallint not null default 0 check (legit_reported between 0 and 4),
  answers          text,      -- e.g. "1:✓ 2:✗ 3:✓ ..."
  codename         text,      -- random public alias shown on the dashboard, e.g. "Swift Falcon 27"
  user_agent       text
);

-- For databases created before codenames existed
alter table public.results add column if not exists codename text;

create index if not exists players_created_at_idx on public.players (created_at);
create index if not exists results_created_at_idx on public.results (created_at);

-- Lock both tables. With RLS on and no policies, the public "anon" key can neither
-- read nor write. Only the Vercel functions (using the service_role key, server-side)
-- can access the data. Emails and phone numbers are never exposed to the browser.
alter table public.players enable row level security;
alter table public.results enable row level security;

-- Handy view for exporting leads (open it in Table Editor or download as CSV)
create or replace view public.leads
with (security_invoker = true) as
select
  p.created_at as joined_at,
  p.name, p.email, p.phone, p.consent,
  r.score, r.phishing_missed, r.legit_reported, r.created_at as finished_at
from public.players p
left join lateral (
  select * from public.results r
  where (p.email is not null and p.email <> '' and r.email = p.email)
     or (p.phone is not null and p.phone <> '' and r.phone = p.phone)
  order by r.created_at desc
  limit 1
) r on true
where coalesce(p.email, '') <> '' or coalesce(p.phone, '') <> ''
order by p.created_at desc;
