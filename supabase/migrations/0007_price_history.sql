-- FolioLense 0007: daily price history for the technical / momentum views (Vivek Bajaj engine).
-- Backfilled and topped up by the worker from NSE sec_bhavdata_full (OHLC, volume, delivery %).
-- One row per instrument per trading day; prices in paise, consistent with the rest of the app.
-- index_prices (0001) already keeps per-date index closes, so Nifty/sector history reuses that.

create table if not exists public.price_history (
  isin         text not null,
  nse_symbol   text,
  price_date   date not null,
  open_paise   bigint,
  high_paise   bigint,
  low_paise    bigint,
  close_paise  bigint not null,
  volume       bigint,
  deliv_qty    bigint,
  deliv_pct    numeric(6,2),
  source       text not null default 'nse',
  updated_at   timestamptz not null default now(),
  primary key (isin, price_date)
);
create index if not exists price_history_symbol_idx on public.price_history (nse_symbol);
create index if not exists price_history_date_idx on public.price_history (price_date);

alter table public.price_history enable row level security;
-- every signed-in user may read it; only the worker (service key, bypasses RLS) writes it
drop policy if exists price_history_read on public.price_history;
create policy price_history_read on public.price_history for select to authenticated using (true);
revoke all on public.price_history from anon;

select 'FolioLense 0007 price history ready' as result;
