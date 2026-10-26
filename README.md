# FolioLense

A personal family portfolio tracker for Indian investors: families, portfolios, 12 asset classes, holdings by purchase lot, XIRR, capital gains, F&O, statement import and export.

## Status

Design approved. The clickable prototype is in [`prototype/index.html`](prototype/index.html). Open it in a browser; it runs on sample data and needs no server.

## Run it on your laptop

1. Once: `npm install`, then `npm run setup` (installs the web app and the Python worker).
2. Once: copy `web/.env.example` to `web/.env.local` and fill in the Supabase URL and anon key.
3. Once: run `supabase/migrations/0001_init.sql` in Supabase → SQL Editor.
4. Every time: `npm run dev`, then open http://localhost:3000 (worker health: http://localhost:8000/health).

Checks: `npm test` (web + worker tests), `npm run check` (types + lint).

## Documents

- [`docs/PRD.md`](docs/PRD.md): what FolioLense does, every screen, data model, calculations, imports
- [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md): phases, tasks, exit checks, what Sagar provides

## Folder

| Folder | What | In git |
|---|---|---|
| `prototype/` | Approved clickable prototype | Yes |
| `docs/` | PRD and build plan | Yes |
| `sample-files/` | Real statements for building importers | No |
| `reference/` | MProfit screenshots, old drafts | No |

## Plan

| Phase | What |
|---|---|
| 0 | Next.js + Supabase (free) project, hosted on Railway |
| 1 | Login, families, portfolios, transactions, holdings, XIRR |
| 2 | Daily prices: NSE/BSE closing prices, AMFI NAVs |
| 3 | Imports: CAS (CAMS/KFin), e-CAS (NSDL/CDSL), contract notes, tradebooks |
| 4 | Reports: capital gains (FIFO, 31-Jan-2018 grandfathering), 112A CSV, income |
| 5 | F&O book |
| 6 | Broker sync (Zerodha, Dhan), corporate actions |
| 7 | Importer for MProfit export files |

## Rules

- Money is stored in paise (integers). Derived values are never stored.
- Financial data lives only in Supabase, never in this repository.
