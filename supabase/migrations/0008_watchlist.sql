-- Watchlist ("stocks in hand") + per-stock daily price alerts, and a log of triggers.
-- User-owned (owner_id = auth.uid()); the worker evaluates with the service key (bypasses RLS).

create table public.watchlist (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  isin          text,
  nse_symbol    text not null,
  name          text not null,
  sort          int  not null default 0,
  -- alert config (all null = watch only, no alert)
  alert_dir     text check (alert_dir in ('up','down','both')),
  alert_amount_paise bigint check (alert_amount_paise is null or alert_amount_paise > 0),  -- absolute ₹ move vs prev close
  alert_pct     numeric(8,2) check (alert_pct is null or alert_pct > 0),                    -- or % move vs prev close
  alert_active  boolean not null default true,
  -- trigger de-dup (don't re-alert the same stock the same day)
  last_alert_date   date,
  last_alert_kind   text,
  last_alert_price_paise bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, nse_symbol)
);

create table public.alert_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  nse_symbol  text not null,
  name        text not null,
  kind        text not null check (kind in ('up','down')),
  move_paise  bigint not null,
  move_pct    numeric(8,2),
  price_paise bigint not null,
  prev_paise  bigint,
  price_date  date not null,
  emailed     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index alert_log_owner_created on public.alert_log (owner_id, created_at desc);

-- daily digest email settings live on the existing preferences row
alter table public.preferences
  add column if not exists alerts_email_on boolean not null default false,
  add column if not exists alert_email      text;

alter table public.watchlist enable row level security;
alter table public.alert_log enable row level security;

create policy watchlist_select on public.watchlist for select to authenticated using (owner_id = auth.uid());
create policy watchlist_write  on public.watchlist for all    to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy alert_log_select on public.alert_log for select to authenticated using (owner_id = auth.uid());
create policy alert_log_write  on public.alert_log for all    to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
