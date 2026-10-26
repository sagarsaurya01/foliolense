# FolioLense

A personal family portfolio tracker for Indian investors: families, portfolios, 12 asset classes, holdings by purchase lot, XIRR, capital gains, F&O, statement import and export.

## Status

Design approved. The clickable prototype is in [`prototype/index.html`](prototype/index.html). Open it in a browser; it runs on sample data and needs no server.

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
