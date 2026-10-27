-- FolioLense 0004: central price feed (Phase 2).
-- The worker refreshes instrument_prices daily from AMFI (funds) and NSE/BSE (stocks/ETFs),
-- keyed by ISIN. A user's holding links to a price by storing that ISIN on its asset.
-- index_prices (0001) holds Nifty 50 / Sensex closes for the rail and the benchmark.

create table if not exists public.instrument_prices (
  isin              text primary key,
  name              text,
  nse_symbol        text,
  bse_code          text,
  amfi_code         text,
  kind              text not null check (kind in ('EQ', 'MF')),   -- equity/ETF vs mutual fund
  close_paise       bigint not null,
  prev_close_paise  bigint,
  price_date        date not null,
  source            text not null,
  updated_at        timestamptz not null default now()
);
create index if not exists instrument_prices_name_idx on public.instrument_prices (lower(name));
create index if not exists instrument_prices_symbol_idx on public.instrument_prices (nse_symbol);
create index if not exists instrument_prices_amfi_idx on public.instrument_prices (amfi_code);

alter table public.instrument_prices enable row level security;
-- every signed-in user may read the feed; only the worker (service key, bypasses RLS) writes it
drop policy if exists instrument_prices_read on public.instrument_prices;
create policy instrument_prices_read on public.instrument_prices for select to authenticated using (true);
revoke all on public.instrument_prices from anon;

-- a feed-run log, so the app can show "prices as of <date>" and flag a failed run
create table if not exists public.price_runs (
  id          bigserial primary key,
  job         text not null,          -- amfi | nse | indices
  price_date  date,
  rows        int not null default 0,
  status      text not null,          -- ok | failed
  detail      text,
  ran_at      timestamptz not null default now()
);
alter table public.price_runs enable row level security;
drop policy if exists price_runs_read on public.price_runs;
create policy price_runs_read on public.price_runs for select to authenticated using (true);
revoke all on public.price_runs from anon;

select 'FolioLense 0004 price feed ready' as result;
