# FolioLense: Product Requirements (PRD)

**Version:** 1.0, 26-Oct-2026
**Owner:** Sagar Pathak
**Design reference:** [`prototype/index.html`](../prototype/index.html) (approved). Open it in a browser; every screen below exists there on sample data.
**Build plan:** [`BUILD-PLAN.md`](BUILD-PLAN.md)

---

## 1. What FolioLense is

A private web app that tracks every investment a family owns, across every member, in one place. It works like MProfit: families, then portfolios, then holdings by asset class, with true returns (XIRR), capital gains for tax, an F&O book, and import of the statements Indian brokers and registrars send.

**Why build it:** the MProfit licence has expired, and the family needs a tracker it controls, with the import accuracy MProfit lacks (every import is checked against the statement's own totals).

**Who uses it:** Sagar and the family. Personal use only in v1. It is built so it could be sold later without a rewrite, but nothing in v1 is spent on selling it.

### 1.1 Goals

1. One screen shows the whole family's net worth, today's gain, unrealised gain and XIRR, and the same for any one member.
2. Statements go in by upload and come out as correct holdings, with no hand typing for supported formats.
3. Capital gains, F&O profit and income reports are good enough for the CA to file returns from.
4. The numbers are right: every importer ties out to the statement's totals, and every calculation has tests.

### 1.2 Not in v1

- Selling it: no payments, pricing plans, marketing site or custom domain.
- A mobile app. The website works on a phone browser.
- Advice, recommendations or trading.
- Real-time (intraday) prices. Prices are end-of-day.
- Auto-import by forwarding email (later; v1 is upload).

### 1.3 Success measures

| Measure | Target |
|---|---|
| Statement import accuracy | 100% tie-out to statement totals on the sample set; any mismatch blocks the import |
| Capital gains vs CA/broker statement | Matches to the rupee on one past year |
| Holdings vs depository (NSDL/CDSL) | Matches unit-for-unit after a full import |
| Daily prices | Loaded by 9:00 am IST every trading day |
| Holdings page load | Under 2 seconds for the whole family |

---

## 2. Words used in this document

| Word | Meaning |
|---|---|
| Family | A group of portfolios shown together, e.g. "Mehra Family". A user can have several families. |
| Portfolio | One owner's book: an individual, an HUF, a company. Two books: **INV** (investments) and **F&O**. |
| Family Group | The combined view of every portfolio in a family. |
| Asset class | One of the 12 tabs (section 4.6). |
| Lot | One purchase: date, quantity, price. Holdings are built from lots. |
| FIFO | First in, first out: a sale uses up the oldest lots first. |
| XIRR | Annualised return that accounts for the date of every cash flow. |
| CN | Contract note, the broker's trade confirmation. |
| CAS / e-CAS | Consolidated Account Statement from CAMS/KFintech (mutual funds) or NSDL/CDSL (demat). |
| Template | A saved import format, e.g. "Zerodha - Daily Email CN". |
| Mapping | Linking a name in a file to a family, portfolio, broker or asset. Done once, then remembered. |
| Paise | All money is stored as whole paise (₹1 = 100 paise) so totals never drift. |

---

## 3. Users and access

| Role (v1) | Can do |
|---|---|
| Owner | Everything: create families and portfolios, import, edit, delete, see all reports. |

Later (designed for, not built in v1): **Viewer** (read only, e.g. the CA) and **Editor** (add and import, cannot delete families), granted per family. The `family_access` table exists from day one so this needs no data migration.

Sign-in: email + password with Supabase Auth, plus optional 2-factor (TOTP). Sessions expire after 30 days of inactivity.

---

## 4. Screens

Each screen is in the prototype. IDs (S01…) are used in the build plan.

### S01 Top bar (every page)
- Logo, then menus: **API**, **Import**, **Analytics** (with a NEW tag), **Tools**, **Help**, user menu.
- **API** menu: Zerodha, Dhan, Upstox, Angel One. Each opens "connect broker" (Phase 6).
- **Tools** menu, in four groups:
  - Global Reports, Dashboard, Client Sharing, Access Control
  - Corporate Actions, Global Asset Search, Auto-transfer of Charges, F&O Auto-settlement
  - Reconcile Holdings, Portfolio Cashflow Tracking, Goal & Strategy Tracking
  - My Tasks, Branding
  v1 builds Global Reports, Corporate Actions, Global Asset Search and Reconcile Holdings. The rest show "coming later".
- **User menu:** My Account (S15), Preferences (S17), Sign out.

### S02 Family bar
- Family name as a dropdown, and a global search box ("Search portfolios and families").
- **Dropdown panel:** Edit Family, Add Family, Search families, and a list of rows "Family | Portfolio" (Family Group first). Clicking a row opens that portfolio.
- Global search matches family and portfolio names as you type.

### S03 Left rail
- **INV / F&O** toggle.
- **Sensex and Nifty 50:** last close, points change, % change. Green or red.
- **Show** filter: All, Individual, HUF, Company.
- **Portfolio list:** Family Group first, then each portfolio with its type and current value (₹ L / Cr). The selected one is yellow.
- **+ Add Portfolio** (S14).
- In F&O mode the list shows the family's F&O portfolios instead.

### S04 Portfolio header
- "Portfolio: <name>", type chip.
- Right side, in this order: search assets, **+** (add transaction), **XIRR** menu, **Actions** menu, **Preferences** menu, **Reports**, analytics icon.
- **XIRR menu:** portfolio XIRR since first investment, XIRR per asset class, Nifty 50 XIRR on the same cash flows.
- **Actions menu:** View All Transactions (S12), Add a transaction, Import transactions, Add portfolio, Rename portfolio, Move holdings, Export to Excel.
- **Preferences menu:** columns to show, cost method (FIFO; average shown alongside), financial year start (April).
- **Analytics icon:** hovering shows the analytics preview (S11a). It hides when the pointer leaves. Clicking opens full Analytics (S11b). On touch screens a tap opens full Analytics.

### S05 Summary strip
Five figures: Invested, Current value, Today's gain (₹ and %), Unrealised gain (₹ and %), XIRR.

### S06 Asset-class tabs
12 tabs, scrollable with ‹ › arrows, each with a code chip and a count:

| Code | Tab | Value is | Taxed as (section 7.5) |
|---|---|---|---|
| EQ | Stocks & ETFs | qty × price | Listed equity |
| MF | Mutual Funds (Equity) | units × NAV | Equity-oriented fund |
| MF | Mutual Funds (Debt) | units × NAV | Specified MF / other |
| SIF | SIF | units × NAV | By scheme type |
| BNK | Banks | balance | Interest at slab |
| ULP | NPS / ULIP | value | Special rules, report only |
| INS | Insurance | surrender value | Report only |
| PE | Private Equity | qty × last valuation | Unlisted shares |
| FD | FDs | accrued value | Interest at slab |
| CD | Deposits / Loans | principal + accrued interest | Interest at slab |
| PPF | PPF / EPF | balance | Exempt |
| GLD | Gold | grams/units × price | Gold rules |

Plus an **All assets** tab. An empty tab shows "Nothing in <tab> yet" and an **Add a transaction** button.

### S07 Holdings table
- Search box ("Search assets").
- **Columns:** Asset · Qty with Avg. pur. price under it · Amt. Invested · Current Price · Today's Gain (₹ above %) · Unrealised Gain (₹ above %) · Current Value.
- Every column header sorts. Default is Current Value, high to low.
- **Grouped by asset class**, with a subtotal row per group. Groups fold away.
- **Row expand (▸):** shows each lot with its date, owner (in Family Group), short or long term with days held, quantity, amount and price. An expanded row turns yellow.
- **Family Group:** the same asset held by several members shows as one row, "· 3 members". Expanding it shows each member's lots.
- For balance-type assets (BNK, ULP, INS, FD, CD, PPF), Qty and Price show "—".
- **Sticky footer: NET WORTH** with totals.
- Gains are green, losses red. Numbers use Indian grouping (1,61,71,506.43).

### S08 Add transaction (modal)
- **Fields:** Portfolio, Asset class, Asset name (suggests existing holdings), Type (Buy/deposit or Sell/withdraw), Date, Quantity, Price (Amount for balance types), Current price/value (optional).
- **Per-class extra fields** (Phase 1):
  - FD/CD: rate, compounding, start date, maturity date, payout or cumulative
  - PPF: yearly contributions
  - GLD: grams or units, purity
  - EQ: exchange and charges (brokerage, STT, stamp, GST)
- **Checks:** name required, quantity > 0, price > 0, date not in the future, can't sell more than held.
- A sell uses lots oldest first (FIFO) and records realised gain.
- Edit and delete transactions from S12.

### S09 Import (modal)
**Left panel: templates**
- Header: **+ Add a new import template** (later), **All templates** / **★ Favourites** toggle, **Import Log** with a count of pending items, **Tools**.
- Columns: Name, Auto import (✈ if it can come in by email, later), Type (EQ, MF, F&O, Bank), Format (PDF, CSV, Excel, API), ☆ favourite.
- Templates in v1 (full list in section 8): Zerodha Daily CN, Zerodha Multi CN (F&O), Zerodha Tradebook, Groww Daily CN, Anand Rathi Daily CN (F&O), Anand Rathi Multi CN (EQ), CAMS CAS, KFintech CAS, NSDL e-CAS, CDSL e-CAS, ICICI Bank statement, HDFC Bank statement, FolioLense Opening Balances (Excel), MProfit export.

**Right panel: new import wizard**
1. **Upload:** drop a file or click Upload File. Shows the chosen template, plus a "How do I request my CAS statement?" link for CAS templates.
2. **Password:** for protected PDFs. A wrong password says so, and the password is never stored.
3. **Family & portfolio:** two dropdowns (F&O templates list F&O portfolios). The answer is remembered per account number or client ID found in the file.
4. **Broker:** for contract notes. A dropdown, with **+** to add a broker. Remembered per client ID.
5. **Review:** every parsed row with a status chip:
   - **Mapped:** matched to an asset by ISIN, symbol or AMFI code, or marked "new asset" if it is new to this portfolio.
   - **Map:** no code found. You pick an existing asset or "Create as new asset". The choice is remembered as an alias.
   - **Fully Assigned:** already imported (same source reference). It's struck through and skipped.

   **Tie-out bar:** "Statement total ₹X · read ₹Y · difference ₹0". Confirm is blocked if the difference is outside tolerance (section 8.3).
6. **Confirm Import**, then **Done:** "N added to <portfolio>. M skipped as already imported." Buttons: View Import Log, Back to Portfolio.

The progress bar at the top shows Password → Family & portfolio → Broker → Review → Done, leaving out any step that doesn't apply.

### S10 Import Log
- List of imports, newest first: file name, template, date and time, result ("3 imported · 1 skipped"), status.
- Statuses: Completed, Failed (with the reason), **Waiting for password** (an **Enter password** button resumes the wizard), Partially imported.
- **View details** opens the review table read-only. **Undo import** deletes exactly the transactions that import added, after a confirm step.

### S11 Analytics
- **S11a hover preview:** three cards. Each opens its report.
  - **Holdings:** half-donut asset allocation and the top 5 classes with %.
  - **Performance:** bars for this portfolio's XIRR vs Nifty 50 on the same cash flows.
  - **Equity Exposure:** donut of direct stocks, ETFs, equity MFs and SIFs.
- **S11b full Analytics** (modal): the three cards plus a table per asset class with Invested, Current value, Share, Gain and XIRR, and a total row.
- Later: exposure to one stock across stocks and funds (look-through), sector split, history chart.

### S12 View All Transactions (Actions menu)
- **Filters:** asset class, from date, to date, asset name search, Clear filters.
- **Columns:** Date, Portfolio, Asset class, Asset, Type, Qty, Price, Amount. Footer shows the count and total.
- **Export to CSV**, and later Excel.
- Clicking a row opens it to edit or delete.

### S13 Reports (modal)
- **Header:** Report Log, Family, Portfolio.
- Three columns: **category**, then **report list** (🔒 on premium items, all unlocked for personal use), then **detail**.
- **Detail pane:** title, any options (period, date), **Generate Report**, description, the output table, **Export to CSV**, and later Excel/PDF.

Reports by category:

| Category | Report | v1 |
|---|---|---|
| Prime | Advanced Performance Review (XIRR by class vs benchmark, any period) | Phase 4 |
| Performance | XIRR by asset class | ✓ |
| Performance | Holdings as on date (any date, not just today) | ✓ |
| Performance | Equity exposure | ✓ |
| Capital Gains | Unrealised gains: short vs long term | ✓ |
| Capital Gains | Realised capital gains, FIFO, by FY, with grandfathering | ✓ |
| Transactions | Stock Transactions (period) | ✓ |
| Transactions | All Transactions | ✓ |
| Income | Dividends & interest by FY, with TDS | ✓ |
| Tax Software Formats | ITR Schedule 112A CSV | ✓ |
| Tax Software Formats | Schedule CG summary | ✓ |
| F&O | F&O P&L by FY with turnover (for tax audit check) | Phase 5 |

### S14 Add family / Add portfolio
- **Add family:** name.
- **Add portfolio:** name, book (Investments or F&O), type (Individual, HUF, Company, Other).
- **Rename and delete:** delete is blocked while the portfolio has transactions, unless you type its name to confirm.

### S15 My Account
Email, display name (editable), plan (Personal), users, portfolio count, Change password, Turn on 2-factor login, Sign out of all devices.

### S16 F&O book
- Rail lists F&O portfolios, plus **+ Add Portfolio**.
- Header: "F&O Portfolio: <name>", **+**, **Actions** (Import contract notes, Settle expired contracts), **Preferences**, **Reports**.
- **Summary:** Unrealised P/L, Realised P/L, Charges (GST, STT, others), Net P/L.
- **Tabs:** **Stock F&O** (index and stock derivatives) and **Other F&O** (currency, commodity).
- **Period** dropdown: All to date, or a financial year.
- **Columns:** Instrument (marked **E** if expired, **O** if open) · Qty with Cost/unit under it · Current Price · Mark to Market · Unrealised P/L · Realised P/L · Total P/L.
- **Footer:** "Less total charges (GST, STT, stamp duty, exchange)", then **Total Profit / Loss**.
- **Instrument display:** `NIFTY 28-OCT-26 25000 CE`, `BANKNIFTY 25-NOV-26 FUT`.

### S17 Preferences
Cost method shown (FIFO is the tax method; average cost shown for reference), FY start, default landing portfolio, number format (₹ L/Cr), theme (light/dark/system).

### S18 Sign in / sign up / reset password
Standard Supabase Auth screens in the FolioLense look.

### S19 Corporate Actions (Tools)
List of splits, bonuses, mergers, demergers and name changes affecting your holdings, each with an **Apply** button that adjusts lots (section 7.7).

### S20 Reconcile Holdings (Tools)
Compares FolioLense holdings with the latest NSDL/CDSL e-CAS or CAMS CAS, per portfolio. Shows matches, quantity differences and assets missing on either side.

---

## 5. Data model (Supabase Postgres)

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` and `updated_at`. Money columns are `bigint` paise. Quantities are `numeric(24,8)`. Dates are `date` (trade dates in IST).

```sql
-- people and structure
families        (owner_id uuid -> auth.users, name text not null)
family_access   (family_id, user_id, role text check (role in ('owner','editor','viewer')))
portfolios      (family_id, name, type text check (type in ('individual','huf','company','other')),
                 book text check (book in ('inv','fno')), sort int)

-- what can be held
assets          (asset_class text,        -- EQ MFE MFD SIF BNK ULP INS PE FD CD PPF GLD
                 name text, isin text, nse_symbol text, bse_code text, amfi_code text,
                 sub_type text,           -- ETF, index fund, SGB...
                 tax_class text,          -- listed_equity, equity_fund, specified_mf, other_mf,
                                          -- listed_other, unlisted, gold_physical, sgb, exempt, slab
                 meta jsonb,              -- FD: rate, compounding, start, maturity; bank a/c last 4
                 owner_id uuid null)      -- null = shared master (stocks, funds); set = user-made (FD, unlisted)
asset_aliases   (owner_id, raw_name text, asset_id)   -- remembered "Map" choices

-- what happened
transactions    (portfolio_id, asset_id,
                 type text check (type in ('buy','sell','deposit','withdraw','dividend','interest',
                                           'bonus','split','merge_in','merge_out','charges','opening')),
                 trade_date date, quantity numeric, price_paise bigint, amount_paise bigint,
                 charges_paise bigint default 0, broker_id uuid null,
                 import_id uuid null,
                 source_ref text null,    -- e.g. CN no + trade no, CAS folio + date + amount
                 notes text,
                 unique (portfolio_id, source_ref))   -- the duplicate ("Fully Assigned") guard
brokers         (owner_id, name, client_id text)

-- F&O
fno_trades      (portfolio_id, underlying text, instrument text check (instrument in ('FUT','CE','PE')),
                 expiry date, strike_paise bigint null, segment text check (segment in ('stock','other')),
                 trade_date date, side text check (side in ('buy','sell')), quantity int,
                 price_paise bigint, import_id, source_ref, unique (portfolio_id, source_ref))
fno_charges     (portfolio_id, trade_date, brokerage, stt, exchange, sebi, stamp, gst, import_id)
fno_settlements (portfolio_id, contract key, expiry, settle_price_paise)

-- prices
prices          (asset_id, price_date date, close_paise bigint, prev_close_paise bigint,
                 source text, primary key (asset_id, price_date))
index_prices    (index_code text, price_date, close numeric, primary key (index_code, price_date))
grandfather_fmv (isin text primary key, fmv_paise bigint)   -- 31-Jan-2018 FMV

-- imports
imports         (owner_id, template text, file_name text, file_sha256 text, status text
                 check (status in ('waiting_password','parsing','review','completed','failed','undone')),
                 family_id, portfolio_id, broker_id, stats jsonb, error text)
import_rows     (import_id, row_no int, parsed jsonb,
                 status text check (status in ('mapped','map','duplicate','skipped')),
                 asset_id uuid null, transaction_id uuid null)
import_mappings (owner_id, template text, account_key text,   -- folio / client ID / DP ID
                 portfolio_id, broker_id)                       -- remembered step 3 + 4

-- corporate actions
corporate_actions (asset_id, type text, ex_date date, ratio_from numeric, ratio_to numeric,
                   new_asset_id uuid null, cost_split_pct numeric null, applied_by jsonb)

-- housekeeping
preferences     (user_id primary key, fy_start int default 4, landing_portfolio uuid, theme text)
audit_log       (user_id, action text, entity text, entity_id uuid, before jsonb, after jsonb)
```

**Never stored:** holdings, lots after FIFO, gains, XIRR, totals. They're all computed from `transactions` and `prices`. A `holdings_cache` materialised view can be added if the page gets slow; it's rebuilt on every write and is never the source of truth.

**Never stored at all:** full PAN, Aadhaar, passwords to statements, bank account numbers beyond the last 4 digits.

### 5.1 Row-level security
- RLS is on for every table.
- **Rule:** a row is visible if its family is one the user owns or has `family_access` to. Tables without `family_id` reach it through `portfolio_id`.
- Write access needs owner or editor.
- `assets` with `owner_id is null` (the shared stock and fund master) are readable by every signed-in user. Only the price job can write them, using the service key on the server and never in the browser.
- The browser only ever has the **anon key**. The service key lives in Railway's secret settings, used by the worker.

---

## 6. Prices and reference data

| Data | Source | When | Notes |
|---|---|---|---|
| NSE closing prices | `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_DDMMYYYY.csv` | Daily, 6:30 pm and again at 8:00 am IST | Needs a browser user-agent. Columns padded with spaces. Use the EQ/BE series. Key: ISIN. |
| BSE closing prices | BSE equity bhavcopy (UDiFF CSV) | Daily | For BSE-only stocks. Key: ISIN. |
| Mutual fund NAVs | `https://portal.amfiindia.com/spages/NAVAll.txt` | Daily, 11:30 pm and 8:00 am | Semicolon-separated, ~18k schemes. Use `portal.`, not `www.`. Key: ISIN, then AMFI code. |
| Index closes | NSE `ind_close_all_DDMMYYYY.csv` | Daily | Nifty 50, Nifty Bank, Sensex (from BSE). Used for the rail and benchmark XIRR. |
| F&O settlement prices | NSE F&O UDiFF bhavcopy | Daily | Mark to market of open positions. |
| Stock master | NSE `EQUITY_L.csv` + BSE scrip master | Weekly | ISIN, symbol, name. |
| 31-Jan-2018 FMV | NSE/BSE closing prices of 31-Jan-2018 (one-time load) + AMFI NAV of that date | Once | For grandfathering. |
| Gold price | IBJA daily rate (manual entry fallback) | Daily | Physical gold. SGBs and gold ETFs use exchange prices. |
| FD / CD / PPF | Calculated | On page load | Accrued value from rate and compounding (section 7.6). |

**Rules:**
- A missing price on a holiday uses the last available close and shows "as of <date>".
- Prices older than 5 trading days get an amber dot.
- The price job is idempotent: running it twice for one date writes nothing new.

---

## 7. Calculations

Every formula here gets unit tests with hand-worked expected values (BUILD-PLAN section 6).

### 7.1 Holdings from transactions (FIFO)
- Process a portfolio's transactions per asset in date order. Same-day order: opening → buy → bonus/split → sell.
- **Buy, deposit, opening:** add a lot {date, qty, cost = qty × price + charges}.
- **Sell:** take quantity from the oldest lots first. Realised gain per consumed piece = sale value share − cost share. The holding period of each piece decides short or long term.
- **Bonus** (ratio a:b): add a lot of `qty × a / b` at zero cost, dated on the ex-date. Its holding period starts on the ex-date (Indian rule).
- **Split** (ratio a:b): multiply every lot's quantity by `b/a` (and divide price by the same). Lot dates and total cost don't change.
- **Merger/demerger:** move lots to the new asset by `cost_split_pct`, keeping original dates.
- **Quantity check:** a sell that exceeds holdings is rejected on manual entry, and flagged as **Map** with a reason on import.

### 7.2 Display figures
- **Invested** = Σ remaining lot cost
- **Avg. pur. price** = Invested ÷ quantity
- **Current value** = quantity × latest price (balance types: computed or entered value)
- **Today's gain** = quantity × (price − previous close); % = today ÷ (current − today)
- **Unrealised gain** = current − invested; % = unrealised ÷ invested
- Group subtotals and NET WORTH are sums of the above, never sums of percentages.

### 7.3 XIRR
- **Cash flows:** each buy/deposit as negative (amount + charges), each sell/withdraw/dividend/interest received as positive, plus today's current value as a final positive flow.
- **Solver:** Newton–Raphson from 10%, falling back to bisection on −99%…1000%. Result matches Excel's XIRR within 0.01 percentage points on the test set.
- **Benchmark XIRR:** the same cash flows, but each flow buys or sells Nifty 50 index units at that day's close. The final value is the units held × today's close.
- With less than one year of history, show the absolute return and mark the XIRR "annualised".

### 7.4 F&O
- **Contract key:** underlying + instrument + expiry + strike.
- **Realised P/L:** FIFO matching of buys and sells within a contract. Expired open quantity settles at the exchange settlement price (options expiring worthless settle at 0).
- **Unrealised P/L:** (latest settlement price − cost) × open quantity, with sign by side.
- **Mark to market** = open quantity × latest price.
- **Charges:** taken from contract notes and kept per day. Shown as a separate line and deducted in Total P/L.
- **Turnover** (for the tax audit check), per FY: Σ |realised P/L per contract|. Option premium on sale is not added (current ICAI guidance note).

### 7.5 Capital gains tax classes
Rules live in a table by **sale date**, so future budgets mean a new row, not new code. Default rows, to be confirmed with the CA before Phase 4 sign-off:

| Tax class | Long term if held more than | Rate on sales from 23-Jul-2024 | Notes |
|---|---|---|---|
| Listed equity, equity-oriented MF, equity ETF | 12 months | STCG 20% (111A); LTCG 12.5% (112A) on gains above ₹1.25 lakh per FY | Grandfathering (7.5.1) for buys before 1-Feb-2018 |
| Specified MF (debt-oriented) bought on/after 1-Apr-2023 | Never | Slab rate (50AA) | Always short term |
| Other MF (debt bought before 1-Apr-2023, gold FoF, international FoF) | 24 months | STCG slab; LTCG 12.5%, no indexation | |
| Listed bonds, debentures, gold ETF, REIT/InvIT units | 12 months | STCG slab (REIT/InvIT 20%); LTCG 12.5% | |
| Unlisted shares (PE tab), physical gold | 24 months | STCG slab; LTCG 12.5%, no indexation | |
| SGB | 12 months on the exchange | 12.5% LTCG; **redemption by RBI at maturity is exempt** | |
| FD, CD, bank, PPF interest | n/a | Interest at slab; PPF exempt | Income report, not capital gains |

**7.5.1 Grandfathering** (listed equity and equity funds bought before 1-Feb-2018 and sold long term):
- cost = max(actual cost, min(FMV on 31-Jan-2018, sale value))
- FMV comes from `grandfather_fmv`.

**7.5.2 112A schedule CSV:** one row per sale: ISIN, name, units, sale price per unit, full value of consideration, cost of acquisition without indexation, FMV on 31-Jan-2018, total FMV, expenditure on transfer, deductions, balance. Columns follow the income tax utility's 112A template for the chosen AY.

### 7.6 Deposits
- **FD (cumulative):** value = principal × (1 + r/n)^(n × years elapsed), with n from compounding (quarterly is the default for Indian banks).
- **FD (payout):** value = principal. Interest is posted as income on payout dates.
- **CD (loans given):** simple interest unless set otherwise.
- **PPF:** the balance is user-entered from the passbook yearly. Interest is optional to estimate at the current notified rate.

### 7.7 Rounding
- Store paise; compute in decimal (`decimal.js` / Python `Decimal`).
- Round only for display: ₹ to 2 decimals, MF units to 3, percentages to 2.

---

## 8. Imports

### 8.1 Pipeline (every template)
1. **Upload** to a private Supabase Storage bucket `imports/<user>/<sha256>.pdf`. If the same SHA-256 was already imported, warn "This file was imported on <date>" and continue only on confirm.
2. **Unlock** with the password, in memory only. The password is never written anywhere.
3. **Parse** to the common row shape: `{date, type, isin?, symbol?, amfi_code?, raw_name, qty, price, amount, charges, source_ref, account_key}`.
4. **Tie-out** (8.3).
5. **Map:** account_key gives the portfolio (from `import_mappings`, else ask). Then the broker. Then each row's asset by ISIN, then symbol/AMFI code, then alias, else **Map**.
6. **Duplicate check:** `source_ref` already exists in the portfolio → **Fully Assigned**.
7. **Review**, then **Confirm**. Rows are written in one database transaction, tagged with `import_id`.
8. **Log** the counts. The stored file is deleted after 90 days.

### 8.2 Templates in v1

| Template | Format | Parser | Phase |
|---|---|---|---|
| FolioLense Opening Balances | Excel (our template) | own | 1 |
| CAMS CAS (detailed) | PDF, password | `casparser` (MIT) | 3 |
| KFintech CAS (detailed) | PDF, password | `casparser` | 3 |
| NSDL e-CAS | PDF, password | `casparser` | 3 |
| CDSL e-CAS | PDF, password | `casparser` | 3 |
| Zerodha Tradebook (EQ) | CSV | own | 3 |
| Zerodha Daily Email CN (EQ) | PDF, password | own | 3 |
| Zerodha Multi CN (F&O) | PDF | own | 5 |
| Groww Daily CN | PDF | own | 3 |
| Anand Rathi Multi CN (EQ) | PDF | own | 3 |
| Anand Rathi Daily CN (F&O) | PDF | own | 5 |
| ICICI Bank statement | PDF/CSV | own | 3 |
| HDFC Bank statement | PDF/CSV | own | 3 |
| MProfit export | CSV (View All Transactions export) | own | 7 |
| Zerodha EQ API / Dhan API | API | Kite Connect / DhanHQ | 6 |

Each parser is built from a **real sample file** in `sample-files/` (never committed) and has a test that parses it and matches the totals.

### 8.3 Tie-out rules
- **CAS:** per folio, closing units read = closing units printed; total market value read = printed value.
- **e-CAS:** per ISIN, quantity = printed; portfolio value = printed total.
- **Contract note:** Σ trade values ± charges = net amount payable/receivable printed.
- **Tolerance:** within ₹1 or 0.01% (whichever is larger) per statement total. Unit counts must match exactly to 3 decimals.
- A failed tie-out shows the difference in the review screen and blocks Confirm. "Import anyway" is available only with a typed reason, which is saved in the log.

### 8.4 Export
- View All Transactions → CSV (and Excel in Phase 4).
- Every report → CSV (and Excel/PDF in Phase 4).
- **Full backup:** weekly job exports all tables to JSON + CSV in a zip, saved to Google Drive `FolioLense Backups/` (the free Supabase plan has no backups).
- **CSV rules:** UTF-8 with BOM (opens correctly in Excel), dates as `YYYY-MM-DD`, amounts as plain numbers without commas.

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | RLS on all tables; anon key only in the browser; service key only in the worker; statement passwords never stored; uploads in a private bucket; HTTPS only; 2-factor optional |
| Privacy | No PAN, Aadhaar or full account numbers; no analytics or tracking scripts; data never sent to third parties except the broker APIs the user connects |
| Performance | Holdings page < 2 s for 500 holdings / 20,000 transactions; import of a 12-month CAS < 15 s |
| Reliability | Price jobs retry 3 times; a failed job shows a banner "Prices as of <date>" |
| Backups | Weekly full export to Google Drive; keep 12 weeks |
| Browsers | Latest Chrome, Edge, Safari; phone width 390 px works (tables scroll sideways inside their box) |
| Accessibility | Keyboard reachable, visible focus, contrast AA, works in dark mode |
| Formats | Indian number grouping, ₹, dates DD-Mon-YYYY on screen |

---

## 10. Tech stack

| Part | Choice | Why |
|---|---|---|
| Web app | Next.js (App Router) + TypeScript | One codebase for pages and server routes |
| Styling | CSS variables from the prototype (`--brand`, `--accent`, …) + CSS modules | The approved look carries over exactly, light and dark |
| Database + login + file storage | Supabase free plan (Postgres, Auth, Storage) | Free, RLS built in |
| Worker | Python 3.12 + FastAPI | Statement parsing (`casparser`, `pdfplumber`), price jobs |
| Hosting | Laptop during the build (localhost); Railway at go-live (Phase 7): `web` + `worker` + cron | Sagar already has Railway; nothing to pay until it's finished |
| Tests | Vitest (calculations), pytest (parsers, with tie-out), Playwright (click-through) | |
| Money maths | `decimal.js` (web), `Decimal` (worker) | No floating-point drift |

**Repository layout** (monorepo):

```
foliolense/
  prototype/        approved clickable prototype (design reference)
  docs/             PRD.md, BUILD-PLAN.md, decisions
  web/              Next.js app
    app/            routes: (auth)/, family/[id]/, portfolio/[id]/, fno/[id]/, api/
    components/     TopBar, FamilyBar, Rail, Holdings, Tabs, ImportWizard, Reports, Analytics...
    lib/calc/       fifo.ts, xirr.ts, gains.ts, fno.ts, deposits.ts  (pure, fully tested)
    lib/db/         Supabase queries
  worker/           Python service
    parsers/        cas.py, zerodha_cn.py, zerodha_tradebook.py, anandrathi.py, groww.py, banks/
    jobs/           prices_nse.py, prices_amfi.py, indices.py, backup.py
    tests/
  supabase/
    migrations/     SQL schema + RLS policies
    seed/           sample family (same data as the prototype)
  sample-files/     real statements (git-ignored)
  reference/        MProfit screenshots, old drafts (git-ignored)
```

---

## 11. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| NSE blocks scripted downloads | No equity prices | Browser user-agent + retry; BSE as second source; manual price entry |
| Broker changes CN layout | Parser breaks | Tie-out blocks bad imports; parser tests with dated samples; fix in hours |
| `casparser` stops being maintained | CAS import breaks | MIT licence: vendor it into `worker/` if needed |
| Supabase free project pauses after 7 idle days | App down | Daily price job keeps it active |
| Free plan has no backups | Data loss | Weekly export to Google Drive |
| Tax rule changes in a budget | Wrong gains | Rules in a dated table; CA reviews each year |
| Wrong number shown | Bad decisions, wrong tax | Tests on every formula, tie-out on every import, reconcile against e-CAS |

---

## 12. Open questions (answer before the phase that needs them)

1. **(Phase 1)** Which portfolios to create first? Suggested from MProfit: AM Mobile, Ajkl, AjklHUF, Anjali, Devang, Mridula, plus F&O "Ajkl F&O AR".
2. **(Phase 3)** Which brokers and banks do you actually use today? This decides parser order.
3. **(Phase 4)** Will the CA accept our 112A CSV, or do they need a specific software format (e.g. Winman, Computax)?
4. **(Phase 6)** Kite Connect and DhanHQ API subscriptions: are they worth their monthly fee for personal use, or is uploading contract notes enough?
5. **(Phase 7)** Can you get one MProfit export (View All Transactions → CSV) from Ajay sir's account?
