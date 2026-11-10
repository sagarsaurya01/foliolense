"""Backfill and top up price_history from NSE sec_bhavdata_full (OHLC + volume + delivery).

Only stocks the app actually holds are kept (the EQ assets with an NSE symbol), so the table
stays small and works for every user's portfolio. Nifty/sector history reuses index_prices.

Run with SUPABASE_URL + SUPABASE_SERVICE_KEY (service key bypasses RLS):
    python -m jobs.history backfill --months 18     # one-time history load
    python -m jobs.history append                   # last trading day (daily cron)
    python -m jobs.history append --date 2026-11-07
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, timedelta

import httpx

from . import run, sources

EQUITY_L = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"


def _env() -> tuple[str, dict[str, str]]:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return url, {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates"}


def held_symbols() -> set[str]:
    """NSE symbols of the equities/ETFs held anywhere in the app."""
    url, headers = _env()
    with httpx.Client(timeout=60) as c:
        r = c.get(f"{url}/rest/v1/assets?select=nse_symbol&asset_class=eq.EQ&nse_symbol=not.is.null",
                  headers={k: v for k, v in headers.items() if k != "Content-Type"})
        r.raise_for_status()
        return {row["nse_symbol"].strip() for row in r.json() if (row.get("nse_symbol") or "").strip()}


def upsert_history(bars: list[sources.HistoryBar]) -> None:
    url, headers = _env()
    with httpx.Client(timeout=120) as c:
        for i in range(0, len(bars), 1000):
            payload = [{"isin": b.isin, "nse_symbol": b.nse_symbol, "price_date": b.price_date,
                        "open_paise": b.open_paise, "high_paise": b.high_paise, "low_paise": b.low_paise,
                        "close_paise": b.close_paise, "volume": b.volume,
                        "deliv_qty": b.deliv_qty, "deliv_pct": b.deliv_pct, "source": "nse"}
                       for b in bars[i:i + 1000]]
            c.post(f"{url}/rest/v1/price_history?on_conflict=isin,price_date", json=payload,
                   headers=headers).raise_for_status()


def _bhav_url(d: date) -> str:
    return f"https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d.strftime('%d%m%Y')}.csv"


def one_day(d: date, master: dict[str, tuple[str, str]], wanted: set[str]) -> int:
    """Load one trading day's bars for the held stocks; also top up index_prices. Returns bar count."""
    bars = sources.parse_nse_bhav_history(run._get(_bhav_url(d)), master, wanted)
    if bars:
        upsert_history(bars)
    try:
        run.upsert_rest([], run.fetch_indices(d))   # Nifty 50 / Bank / 500 for the same date
    except Exception:  # noqa: BLE001 - index file may be missing for a day; price bars still load
        pass
    return len(bars)


def backfill(months: int) -> None:
    wanted = held_symbols()
    if not wanted:
        print("no held NSE equities found; nothing to backfill")
        return
    master = sources.parse_equity_master(run._get(EQUITY_L))
    end = date.today()
    cur = end - timedelta(days=int(months * 30.5))
    total = days = holidays = 0
    print(f"backfilling {months} months for {len(wanted)} held symbols ({cur} .. {end})")
    while cur <= end:
        if cur.weekday() < 5:  # Mon-Fri
            try:
                n = one_day(cur, master, wanted)
                total += n
                days += 1
                if days % 20 == 0:
                    print(f"  {cur}: {days} days, {total} bars so far")
            except Exception:  # noqa: BLE001 - NSE holiday (404) or transient; skip the day
                holidays += 1
            time.sleep(0.4)  # be polite to NSE's archive host
        cur += timedelta(days=1)
    print(f"done: {total} bars across {days} trading days ({holidays} days skipped/holiday)")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["backfill", "append"])
    ap.add_argument("--months", type=int, default=18)
    ap.add_argument("--date", help="YYYY-MM-DD (append only; default: last weekday)")
    a = ap.parse_args(argv)

    if a.cmd == "backfill":
        backfill(a.months)
        return 0

    d = date.fromisoformat(a.date) if a.date else date.today()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    master = sources.parse_equity_master(run._get(EQUITY_L))
    n = one_day(d, master, held_symbols())
    print(f"appended {n} bars for {d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
