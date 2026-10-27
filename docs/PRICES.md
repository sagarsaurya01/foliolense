# Daily price feed (Phase 2)

The worker fills `instrument_prices` (by ISIN) and `index_prices` each trading evening.
A holding gets live prices once it is **linked** to an instrument in the app
(the price cell → "Link price" → search → Link). Until then its price is typed in.

## Sources (all free, no key)
| Job | Source | Gives |
|---|---|---|
| `amfi` | portal.amfiindia.com/spages/NAVAll.txt | every mutual fund NAV, by ISIN |
| `nse` | NSE `sec_bhavdata_full` + `EQUITY_L` | stock/ETF close, matched to ISIN |
| `indices` | NSE `ind_close_all` | Nifty 50, Nifty Bank, Nifty 500 |

## Run it
- Locally (writes via the Supabase CLI session, no service key needed):
  `cd worker && .venv/Scripts/python -m jobs.run all --emit-sql out.sql`, then load `out.sql` with `supabase db query -f out.sql`.
- Production (Railway cron): set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service_role, server-only), then
  `python -m jobs.run all`. Schedule: 18:30 and 08:00 IST on trading days; 23:30 for NAVs.

## Notes
- NSE throttles bare clients, so the worker sends full browser headers and a warm-up request, with 3 retries.
- Prices are stored to paise (2 dp). Stock prices are exact; fund NAVs are rounded from 4 dp, a sub-₹1/unit difference.
- Sensex (a BSE index) is not in the NSE feed; the rail shows Nifty 50 and Nifty Bank. BSE indices can be added later.
