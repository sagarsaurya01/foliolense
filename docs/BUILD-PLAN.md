# FolioLense: Build Plan

**Version:** 1.0, 26-Oct-2026
**What to build:** [`PRD.md`](PRD.md). **How it should look:** [`../prototype/index.html`](../prototype/index.html).
**Total:** about 9 weeks of build time, in 8 phases. Each phase ends with something you can use and check.

Screen IDs (S01…) and sections (§) refer to the PRD.

---

## 1. Overview

| Phase | Name | Length | You can use it for | Needs from Sagar |
|---|---|---|---|---|
| 0 | Foundation | 2–3 days | Sign in, see the prototype screens live | Supabase URL + anon key, Railway access |
| 1 | Core tracker | 2 weeks | Enter holdings by hand or Excel; correct totals and XIRR | Portfolio list (PRD §12 Q1) |
| 2 | Daily prices | 4 days | Current prices and today's gain fill themselves | Nothing |
| 3 | Statement imports | 2 weeks | Upload CAS / e-CAS / contract notes | Real sample files + passwords |
| 4 | Reports and tax | 1.5 weeks | Capital gains, 112A CSV, income; CA can file | One past capital-gains statement; CA's format |
| 5 | F&O book | 1 week | F&O P&L by year, charges, turnover | F&O contract notes |
| 6 | Broker sync + corporate actions | 1 week | Trades arrive without uploads; splits/bonuses applied | API keys if you choose to pay |
| 7 | MProfit migration + hardening | 4 days | One-step move from MProfit; backups running | One MProfit export |

Phases run in order. Phases 4 and 5 can swap if F&O matters more for the coming tax season.

---

## 2. Phase 0: Foundation (2–3 days)

**Goal:** an empty but real app online, signed in, with the prototype's look.

| # | Task | Done when |
|---|---|---|
| 0.1 | Create the `web/` Next.js + TypeScript app; port the prototype's colour and type tokens into `web/app/tokens.css` (light + dark) | Home page matches the prototype's colours and fonts in both themes |
| 0.2 | Create the `worker/` Python FastAPI app with a `/health` route | `GET /health` returns ok on Railway |
| 0.3 | Supabase: connect the project; write `supabase/migrations/0001_schema.sql` (PRD §5) and `0002_rls.sql` (§5.1) | Tables exist; RLS test: user B cannot read user A's family (automated test) |
| 0.4 | Auth screens (S18): sign up, sign in, reset password, sign out | You can create an account and sign in |
| 0.5 | App shell: S01 top bar, S02 family bar, S03 rail, routing `/family/[id]` and `/portfolio/[id]` | Navigation works with empty data |
| 0.6 | Seed script: loads the prototype's sample "Mehra Family" into a demo account | Demo account shows the same numbers as the prototype |
| 0.7 | Railway: `web` and `worker` services, environment variables, auto-deploy from `main` | A push to GitHub deploys within 5 minutes |
| 0.8 | CI on GitHub Actions: type-check, lint, unit tests on every push | A red ✗ appears on GitHub if a test fails |

**Exit check:** you open `foliolense-web.up.railway.app`, sign in, and see the app shell.

---

## 3. Phase 1: Core tracker (2 weeks)

**Goal:** a fully working tracker with manually entered data.

### 3.1 Calculation library (`web/lib/calc/`), built test-first

| # | Module | Tests must cover |
|---|---|---|
| 1.1 | `fifo.ts`: lots from transactions (PRD §7.1) | Partial sell across 3 lots; sell all; sell more than held (rejected); same-day buy+sell order; bonus 1:1; split 1:10; quantities with 3–4 decimals |
| 1.2 | `figures.ts`: invested, avg, current, today's gain, unrealised (§7.2) | Group subtotals = sum of rows; % never summed |
| 1.3 | `xirr.ts` (§7.3) | 10 cases checked against Excel XIRR to 0.01 pts; all-negative flows; one flow; < 1 year |
| 1.4 | `deposits.ts`: FD cumulative/payout, CD simple, PPF (§7.6) | Bank FD calculator examples for quarterly compounding |
| 1.5 | `money.ts`: paise maths, Indian formatting | 1,61,71,506.43 formatting; no float drift over 10,000 adds |

### 3.2 Screens

| # | Screen | Done when |
|---|---|---|
| 1.6 | Families + portfolios: S14, family dropdown, Show filter, Add Family | Create, rename, delete with guard |
| 1.7 | Holdings: S04 header, S05 summary, S06 tabs, S07 table (sort, group fold, lot expand, Family Group merge, NET WORTH) | Matches the prototype on the seed data, figure for figure |
| 1.8 | Add transaction S08 with per-class fields | All validations in the PRD; sell uses FIFO |
| 1.9 | View All Transactions S12 with filters, edit, delete, CSV export | Editing a past buy updates holdings and XIRR at once |
| 1.10 | XIRR menu, Actions menu, Preferences S17 | |
| 1.11 | Analytics hover S11a + full S11b | Hover shows, leaving hides, click opens full |
| 1.12 | Opening Balances Excel template + importer (simplest S09 path) | You load current holdings for all portfolios from one sheet |
| 1.13 | My Account S15 | Change password, 2-factor on |

**Exit check:** you enter the family's real holdings (by Excel opening balances); net worth and invested match MProfit's last screen to the rupee.

---

## 4. Phase 2: Daily prices (4 days)

| # | Task | Done when |
|---|---|---|
| 2.1 | `jobs/prices_amfi.py`: NAVAll.txt → `prices` by ISIN/AMFI code | All held funds priced; re-run writes nothing new |
| 2.2 | `jobs/prices_nse.py`: NSE bhavcopy → `prices` by ISIN; BSE fallback | All held stocks/ETFs priced, BSE-only scrips too |
| 2.3 | `jobs/indices.py`: Nifty 50, Nifty Bank, Sensex closes | Rail shows real index values |
| 2.4 | Stock master refresh (EQUITY_L + BSE master), weekly | New listings found by search |
| 2.5 | Railway cron: 18:30 and 08:00 IST trading days; 23:30 for NAVs | 5 consecutive trading days loaded with no gaps |
| 2.6 | Stale-price amber dot; "Prices as of" banner on job failure | Simulated failure shows the banner |
| 2.7 | Gold price entry (IBJA, manual fallback) | Physical gold valued |
| 2.8 | One-time load of 31-Jan-2018 FMV for grandfathering | FMV present for every held pre-2018 ISIN |

**Exit check:** for 5 trading days, current prices for 20 random holdings match the exchange/AMFI figure exactly.

---

## 5. Phase 3: Statement imports (2 weeks)

**Goal:** the full S09/S10 wizard working on real files. Parsers are built in this order (most data first):

| # | Task | Done when |
|---|---|---|
| 3.1 | Upload → storage, SHA-256 duplicate-file warning, Import Log S10 | Same file twice warns |
| 3.2 | Wizard shell: password → family & portfolio → broker → review → done, with remembered mappings | Second import from the same folio/client ID skips steps 3–4 |
| 3.3 | Asset matching: ISIN → symbol/AMFI → alias → **Map**; "Create as new asset" | Alias remembered for next time |
| 3.4 | Duplicate rows (`source_ref`) → **Fully Assigned** | Re-importing a CN adds 0 rows |
| 3.5 | Tie-out bar and block (PRD §8.3) | A tampered sample is blocked with the difference shown |
| 3.6 | CAMS + KFintech CAS via `casparser` | Your CAS: every folio's closing units and value tie out |
| 3.7 | NSDL + CDSL e-CAS via `casparser` | Holdings match the e-CAS ISIN by ISIN |
| 3.8 | Zerodha Tradebook CSV + Daily CN PDF | Trades and charges match the CN net amount |
| 3.9 | Anand Rathi Multi CN (EQ) | Same |
| 3.10 | Groww Daily CN | Same |
| 3.11 | ICICI + HDFC bank statements → BNK balance + interest income | Closing balance ties out |
| 3.12 | Undo import | Undo removes exactly that import's rows |
| 3.13 | Reconcile Holdings S20 against latest e-CAS/CAS | Shows matches and differences per portfolio |
| 3.14 | Favourites, All templates search, "How do I request my CAS?" links | As in the prototype |

**Exit check:** import a full year of statements for two members. Reconcile Holdings shows zero differences against the latest e-CAS.

---

## 6. Phase 4: Reports and tax (1.5 weeks)

| # | Task | Done when |
|---|---|---|
| 4.1 | Tax rules table by sale date (PRD §7.5), editable rows | Rules for FY 2024-25, 2025-26, 2026-27 loaded |
| 4.2 | `gains.ts`: realised gains by FY, FIFO, ST/LT per tax class, grandfathering, ₹1.25 lakh 112A exemption shown | 20 hand-worked cases pass; matches your CA/broker statement for one past FY to the rupee |
| 4.3 | Reports modal S13 with all v1 reports, period options, Generate, CSV | Every report in the PRD table generates |
| 4.4 | 112A CSV in the income tax utility's column order | Imports into the ITR utility without errors (tested once with the CA) |
| 4.5 | Schedule CG summary | Totals equal the realised-gains report |
| 4.6 | Income report: dividends and interest by FY with TDS | Matches AIS for one FY (sample) |
| 4.7 | Excel (.xlsx) and PDF export for reports | Opens cleanly in Excel |
| 4.8 | Holdings as on any past date | Date 31-Mar-2026 matches that day's e-CAS |
| 4.9 | Advanced Performance Review (XIRR by class vs benchmark, any period) | |

**Exit check:** the CA reviews FY 2025-26 capital gains from FolioLense and accepts them.

---

## 7. Phase 5: F&O book (1 week)

| # | Task | Done when |
|---|---|---|
| 5.1 | `fno.ts`: contract key, FIFO realised, expiry settlement, unrealised, MTM, turnover (PRD §7.4) | Hand-worked cases pass |
| 5.2 | F&O screens S16: rail, Stock/Other tabs, Period, E/O markers, charges line, Total P/L | Matches prototype layout |
| 5.3 | Zerodha Multi CN (F&O) parser | Ties to CN net amount |
| 5.4 | Anand Rathi Daily CN (F&O) parser | Same |
| 5.5 | Daily F&O settlement prices (NSE F&O bhavcopy) | Open positions marked to market |
| 5.6 | F&O P&L report by FY with turnover | Matches broker's P&L statement for one FY |

**Exit check:** FY 2025-26 F&O P&L and charges match the broker's tax P&L statement.

---

## 8. Phase 6: Broker sync and corporate actions (1 week)

| # | Task | Done when |
|---|---|---|
| 6.1 | API menu → connect Zerodha (Kite Connect) — only if subscribed | Daily tradebook pulled automatically |
| 6.2 | Connect Dhan (DhanHQ) — only if subscribed | Same |
| 6.3 | Corporate actions feed (NSE corporate announcements) → S19 list with Apply | A real split/bonus applies correctly, lots keep their dates |
| 6.4 | Dividend auto-entry from corporate actions × holdings on record date (marked "estimated" until a bank statement confirms) | |

**Exit check:** a split held in a portfolio is applied and the quantity matches the next e-CAS.

---

## 9. Phase 7: MProfit migration and hardening (4 days)

| # | Task | Done when |
|---|---|---|
| 7.1 | MProfit export importer (View All Transactions CSV) | All 8 MProfit portfolios load; totals match MProfit's NET WORTH row |
| 7.2 | Weekly backup job → Google Drive zip, keep 12 | A restore into a scratch Supabase project works |
| 7.3 | Playwright click-through of every screen and flow | Green on CI |
| 7.4 | Security pass: RLS tests for every table, no service key in the browser bundle, headers | Checklist all ✓ |
| 7.5 | Phone-width pass (390 px) and dark-mode pass | No page scrolls sideways |
| 7.6 | Performance pass with 20,000 transactions | Holdings < 2 s |

**Exit check:** you stop using MProfit.

---

## 10. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Calculations | Vitest | Every function in `lib/calc` with hand-worked expected values; Excel-checked XIRR |
| Parsers | pytest | One test per real sample file: parse → tie-out passes → row count and totals equal the printed values. Samples stay in `sample-files/` (git-ignored); CI runs on redacted fixtures |
| Database | SQL tests | RLS: a second user can never read or write the first user's rows |
| Screens | Playwright | Every flow in the prototype: add family, add portfolio, add/sell, import wizard, reports, export, F&O |
| Real-world | Manual, per phase | The exit check of each phase, done with you |

Rule: no phase is "done" until its exit check passes with real data.

---

## 11. Working method

- **One branch per task**, then a pull request into `main`. Each PR says what changed and how it was checked.
- `main` always deploys to Railway and must stay working.
- After every phase: a short demo with you, then the exit check.
- **Decisions** (anything the PRD doesn't settle) are written in `docs/decisions.md` with the date.
- **Nothing personal ever goes into git:** statements, screenshots, passwords, keys. They stay in the git-ignored `sample-files/`, `reference/` and `.env`.

---

## 12. Everything Sagar needs to provide

| When | What | How |
|---|---|---|
| Phase 0 | Supabase **Project URL** + **anon key** | Supabase → Project Settings → API. Never send the service_role key or DB password in chat; paste it into Railway's Variables yourself |
| Phase 0 | Railway | Create a project "foliolense" and connect the GitHub repo, or let me do it via the Railway CLI after you log in |
| Phase 1 | List of portfolios to create | Reply in chat |
| Phase 3 | Sample files into `sample-files/`: CAMS CAS, KFintech CAS, NSDL e-CAS, CDSL e-CAS, Zerodha CN + tradebook, Anand Rathi EQ CN, Groww CN, ICICI + HDFC statements | Copy into the folder |
| Phase 3 | Passwords for those files | Type them yourself when the test runs |
| Phase 4 | One past FY capital-gains statement (CA or broker), the CA's preferred format | Copy into `sample-files/` |
| Phase 5 | F&O contract notes (Zerodha, Anand Rathi) + broker's F&O P&L for one FY | Copy into `sample-files/` |
| Phase 6 | Decision on Kite Connect / DhanHQ subscriptions; API keys if yes | Keys go in Railway Variables |
| Phase 7 | One MProfit export (Actions → View All Transactions → Export to CSV), per portfolio | Copy into `sample-files/` |

---

## 13. Running cost (personal use)

| Item | Cost |
|---|---|
| Supabase | Free plan |
| Railway | Hobby plan, about $5/month (covers web + worker + cron at this size) |
| Domain | Not needed (`*.up.railway.app`) |
| Price data (NSE, BSE, AMFI) | Free |
| Google Drive backups | Free (existing account) |
| Broker APIs | Optional, their own monthly fees |
