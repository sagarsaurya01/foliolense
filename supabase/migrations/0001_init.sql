-- FolioLense 0001: schema + row-level security (PRD section 5)
-- Run once in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- Money is bigint paise. Quantities are numeric(24,8). Holdings, gains and XIRR are never stored.

create extension if not exists pgcrypto;

-- keeps updated_at current on every update
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

------------------------------------------------------------------------------
-- people and structure
------------------------------------------------------------------------------
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index families_owner_idx on public.families(owner_id);

create table public.family_access (
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('editor','viewer')),
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  type        text not null default 'individual' check (type in ('individual','huf','company','other')),
  book        text not null default 'inv' check (book in ('inv','fno')),
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (family_id, book, name)
);
create index portfolios_family_idx on public.portfolios(family_id);

------------------------------------------------------------------------------
-- what can be held
------------------------------------------------------------------------------
create table public.assets (
  id           uuid primary key default gen_random_uuid(),
  asset_class  text not null check (asset_class in ('EQ','MFE','MFD','SIF','BNK','ULP','INS','PE','FD','CD','PPF','GLD')),
  name         text not null,
  isin         text,
  nse_symbol   text,
  bse_code     text,
  amfi_code    text,
  sub_type     text,
  tax_class    text check (tax_class in ('listed_equity','equity_fund','specified_mf','other_mf','listed_other',
                                         'unlisted','gold_physical','sgb','exempt','slab')),
  meta         jsonb not null default '{}'::jsonb,
  owner_id     uuid references auth.users(id) on delete cascade,  -- null = shared master (stocks, funds)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index assets_shared_isin_uq on public.assets(isin) where owner_id is null and isin is not null;
create index assets_owner_idx on public.assets(owner_id);
create index assets_name_idx on public.assets(lower(name));

create table public.asset_aliases (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_name    text not null,
  asset_id    uuid not null references public.assets(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (owner_id, raw_name)
);

create table public.brokers (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  client_id   text,
  created_at  timestamptz not null default now()
);
create index brokers_owner_idx on public.brokers(owner_id);

------------------------------------------------------------------------------
-- imports (before transactions, which point at them)
------------------------------------------------------------------------------
create table public.imports (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template      text not null,
  file_name     text not null,
  file_sha256   text,
  status        text not null default 'parsing'
                check (status in ('waiting_password','parsing','review','completed','failed','undone')),
  family_id     uuid references public.families(id) on delete set null,
  portfolio_id  uuid references public.portfolios(id) on delete set null,
  broker_id     uuid references public.brokers(id) on delete set null,
  stats         jsonb not null default '{}'::jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index imports_owner_idx on public.imports(owner_id, created_at desc);
create index imports_sha_idx on public.imports(owner_id, file_sha256);

------------------------------------------------------------------------------
-- what happened
------------------------------------------------------------------------------
create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid not null references public.portfolios(id) on delete cascade,
  asset_id       uuid not null references public.assets(id) on delete restrict,
  type           text not null check (type in ('buy','sell','deposit','withdraw','dividend','interest',
                                               'bonus','split','merge_in','merge_out','charges','opening')),
  trade_date     date not null,
  quantity       numeric(24,8) not null default 0,
  price_paise    bigint not null default 0,
  amount_paise   bigint not null default 0,
  charges_paise  bigint not null default 0,
  broker_id      uuid references public.brokers(id) on delete set null,
  import_id      uuid references public.imports(id) on delete set null,
  source_ref     text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (portfolio_id, source_ref)   -- duplicate guard ("Fully Assigned")
);
create index transactions_portfolio_idx on public.transactions(portfolio_id, asset_id, trade_date);
create index transactions_import_idx on public.transactions(import_id);

create table public.import_rows (
  id              uuid primary key default gen_random_uuid(),
  import_id       uuid not null references public.imports(id) on delete cascade,
  row_no          int not null,
  parsed          jsonb not null,
  status          text not null check (status in ('mapped','map','duplicate','skipped')),
  asset_id        uuid references public.assets(id) on delete set null,
  transaction_id  uuid references public.transactions(id) on delete set null
);
create index import_rows_import_idx on public.import_rows(import_id, row_no);

create table public.import_mappings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template      text not null,
  account_key   text not null,   -- folio / client ID / DP ID
  portfolio_id  uuid references public.portfolios(id) on delete cascade,
  broker_id     uuid references public.brokers(id) on delete set null,
  unique (owner_id, template, account_key)
);

------------------------------------------------------------------------------
-- F&O
------------------------------------------------------------------------------
create table public.fno_trades (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  underlying    text not null,
  instrument    text not null check (instrument in ('FUT','CE','PE')),
  expiry        date not null,
  strike_paise  bigint,
  segment       text not null default 'stock' check (segment in ('stock','other')),
  trade_date    date not null,
  side          text not null check (side in ('buy','sell')),
  quantity      int not null check (quantity > 0),
  price_paise   bigint not null,
  import_id     uuid references public.imports(id) on delete set null,
  source_ref    text,
  created_at    timestamptz not null default now(),
  unique (portfolio_id, source_ref)
);
create index fno_trades_portfolio_idx on public.fno_trades(portfolio_id, underlying, expiry);

create table public.fno_charges (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  trade_date    date not null,
  brokerage_paise bigint not null default 0,
  stt_paise       bigint not null default 0,
  exchange_paise  bigint not null default 0,
  sebi_paise      bigint not null default 0,
  stamp_paise     bigint not null default 0,
  gst_paise       bigint not null default 0,
  import_id     uuid references public.imports(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index fno_charges_portfolio_idx on public.fno_charges(portfolio_id, trade_date);

create table public.fno_settlements (
  id                  uuid primary key default gen_random_uuid(),
  portfolio_id        uuid not null references public.portfolios(id) on delete cascade,
  contract_key        text not null,
  expiry              date not null,
  settle_price_paise  bigint not null,
  unique (portfolio_id, contract_key)
);

------------------------------------------------------------------------------
-- prices and reference data (written only by the worker with the service key)
------------------------------------------------------------------------------
create table public.prices (
  asset_id          uuid not null references public.assets(id) on delete cascade,
  price_date        date not null,
  close_paise       bigint not null,
  prev_close_paise  bigint,
  source            text not null,
  primary key (asset_id, price_date)
);

create table public.index_prices (
  index_code  text not null,
  price_date  date not null,
  close       numeric(14,4) not null,
  prev_close  numeric(14,4),
  primary key (index_code, price_date)
);

create table public.grandfather_fmv (
  isin       text primary key,
  fmv_paise  bigint not null
);

create table public.corporate_actions (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.assets(id) on delete cascade,
  type            text not null check (type in ('split','bonus','merger','demerger','rename')),
  ex_date         date not null,
  ratio_from      numeric,
  ratio_to        numeric,
  new_asset_id    uuid references public.assets(id) on delete set null,
  cost_split_pct  numeric,
  created_at      timestamptz not null default now()
);

create table public.corporate_action_applied (
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  action_id     uuid not null references public.corporate_actions(id) on delete cascade,
  applied_at    timestamptz not null default now(),
  primary key (portfolio_id, action_id)
);

------------------------------------------------------------------------------
-- housekeeping
------------------------------------------------------------------------------
create table public.preferences (
  user_id            uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  fy_start           int not null default 4 check (fy_start between 1 and 12),
  landing_portfolio  uuid references public.portfolios(id) on delete set null,
  theme              text not null default 'system' check (theme in ('system','light','dark')),
  updated_at         timestamptz not null default now()
);

create table public.audit_log (
  id         bigserial primary key,
  user_id    uuid default auth.uid() references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

-- updated_at triggers
create trigger families_touch     before update on public.families     for each row execute function public.touch_updated_at();
create trigger portfolios_touch   before update on public.portfolios   for each row execute function public.touch_updated_at();
create trigger assets_touch       before update on public.assets       for each row execute function public.touch_updated_at();
create trigger imports_touch      before update on public.imports      for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();
create trigger preferences_touch  before update on public.preferences  for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------
-- row-level security (PRD 5.1)
------------------------------------------------------------------------------
-- helpers run as definer so policies don't recurse through each other
create or replace function public.can_read_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from families where id = f and owner_id = auth.uid())
      or exists (select 1 from family_access where family_id = f and user_id = auth.uid());
$$;

create or replace function public.can_write_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from families where id = f and owner_id = auth.uid())
      or exists (select 1 from family_access where family_id = f and user_id = auth.uid() and role = 'editor');
$$;

create or replace function public.family_of_portfolio(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from portfolios where id = p;
$$;

alter table public.families                 enable row level security;
alter table public.family_access            enable row level security;
alter table public.portfolios               enable row level security;
alter table public.assets                   enable row level security;
alter table public.asset_aliases            enable row level security;
alter table public.brokers                  enable row level security;
alter table public.imports                  enable row level security;
alter table public.transactions             enable row level security;
alter table public.import_rows              enable row level security;
alter table public.import_mappings          enable row level security;
alter table public.fno_trades               enable row level security;
alter table public.fno_charges              enable row level security;
alter table public.fno_settlements          enable row level security;
alter table public.prices                   enable row level security;
alter table public.index_prices             enable row level security;
alter table public.grandfather_fmv          enable row level security;
alter table public.corporate_actions        enable row level security;
alter table public.corporate_action_applied enable row level security;
alter table public.preferences              enable row level security;
alter table public.audit_log                enable row level security;

-- families
create policy families_select on public.families for select to authenticated using (public.can_read_family(id));
create policy families_insert on public.families for insert to authenticated with check (owner_id = auth.uid());
create policy families_update on public.families for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy families_delete on public.families for delete to authenticated using (owner_id = auth.uid());

-- family_access: the family owner manages it; a member can see their own grant
create policy family_access_select on public.family_access for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.families f where f.id = family_id and f.owner_id = auth.uid()));
create policy family_access_write on public.family_access for all to authenticated
  using (exists (select 1 from public.families f where f.id = family_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.families f where f.id = family_id and f.owner_id = auth.uid()));

-- portfolios
create policy portfolios_select on public.portfolios for select to authenticated using (public.can_read_family(family_id));
create policy portfolios_write  on public.portfolios for all    to authenticated
  using (public.can_write_family(family_id)) with check (public.can_write_family(family_id));

-- everything hanging off a portfolio
create policy transactions_select on public.transactions for select to authenticated
  using (public.can_read_family(public.family_of_portfolio(portfolio_id)));
create policy transactions_write on public.transactions for all to authenticated
  using (public.can_write_family(public.family_of_portfolio(portfolio_id)))
  with check (public.can_write_family(public.family_of_portfolio(portfolio_id)));

create policy fno_trades_select on public.fno_trades for select to authenticated
  using (public.can_read_family(public.family_of_portfolio(portfolio_id)));
create policy fno_trades_write on public.fno_trades for all to authenticated
  using (public.can_write_family(public.family_of_portfolio(portfolio_id)))
  with check (public.can_write_family(public.family_of_portfolio(portfolio_id)));

create policy fno_charges_select on public.fno_charges for select to authenticated
  using (public.can_read_family(public.family_of_portfolio(portfolio_id)));
create policy fno_charges_write on public.fno_charges for all to authenticated
  using (public.can_write_family(public.family_of_portfolio(portfolio_id)))
  with check (public.can_write_family(public.family_of_portfolio(portfolio_id)));

create policy fno_settlements_select on public.fno_settlements for select to authenticated
  using (public.can_read_family(public.family_of_portfolio(portfolio_id)));
create policy fno_settlements_write on public.fno_settlements for all to authenticated
  using (public.can_write_family(public.family_of_portfolio(portfolio_id)))
  with check (public.can_write_family(public.family_of_portfolio(portfolio_id)));

create policy ca_applied_select on public.corporate_action_applied for select to authenticated
  using (public.can_read_family(public.family_of_portfolio(portfolio_id)));
create policy ca_applied_write on public.corporate_action_applied for all to authenticated
  using (public.can_write_family(public.family_of_portfolio(portfolio_id)))
  with check (public.can_write_family(public.family_of_portfolio(portfolio_id)));

-- assets: shared master is readable by everyone signed in; private assets by their owner
-- (and by anyone who can read a transaction that uses them)
create policy assets_select on public.assets for select to authenticated using (
  owner_id is null or owner_id = auth.uid()
  or exists (select 1 from public.transactions t
             where t.asset_id = assets.id and public.can_read_family(public.family_of_portfolio(t.portfolio_id))));
create policy assets_insert on public.assets for insert to authenticated with check (owner_id = auth.uid());
create policy assets_update on public.assets for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy assets_delete on public.assets for delete to authenticated using (owner_id = auth.uid());

-- owner-only tables
create policy asset_aliases_own   on public.asset_aliases   for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy brokers_own         on public.brokers         for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy imports_own         on public.imports         for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy import_mappings_own on public.import_mappings for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy preferences_own     on public.preferences     for all to authenticated using (user_id = auth.uid())  with check (user_id = auth.uid());
create policy import_rows_own on public.import_rows for all to authenticated
  using (exists (select 1 from public.imports i where i.id = import_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.imports i where i.id = import_id and i.owner_id = auth.uid()));
create policy audit_select on public.audit_log for select to authenticated using (user_id = auth.uid());
create policy audit_insert on public.audit_log for insert to authenticated with check (user_id = auth.uid());

-- reference data: read-only for signed-in users; only the worker (service key, bypasses RLS) writes
create policy prices_read            on public.prices            for select to authenticated using (true);
create policy index_prices_read      on public.index_prices      for select to authenticated using (true);
create policy grandfather_fmv_read   on public.grandfather_fmv   for select to authenticated using (true);
create policy corporate_actions_read on public.corporate_actions for select to authenticated using (true);

-- nothing is readable without signing in
revoke all on all tables in schema public from anon;

select 'FolioLense database ready' as result;
