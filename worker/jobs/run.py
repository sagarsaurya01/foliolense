"""Fetch today's prices and load them into Supabase.

Production (Railway cron) writes via the Supabase REST API with the service key:
    SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...  python -m jobs.run all

Without a service key it prints the upsert SQL to a file instead, for loading with the
Supabase CLI (used while building, so the service key never leaves Railway):
    python -m jobs.run all --emit-sql out.sql
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta

import httpx

from . import sources

INDEX_CODES = {"Nifty 50", "Nifty Bank", "Nifty 500"}


def _get(url: str) -> str:
    # NSE's archive host throttles bare clients; a full browser header set + a warm-up cookie get through.
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept": "text/csv,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }
    last: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(headers=headers, timeout=120, follow_redirects=True) as c:
                if "nseindia" in url:
                    try:
                        c.get("https://www.nseindia.com/", timeout=30)
                    except httpx.HTTPError:
                        pass
                r = c.get(url)
                r.raise_for_status()
                return r.text
        except httpx.HTTPError as e:  # noqa: PERF203
            last = e
    raise last if last else RuntimeError("fetch failed")


def fetch_amfi() -> list[sources.Price]:
    return sources.parse_amfi(_get("https://portal.amfiindia.com/spages/NAVAll.txt"))


def fetch_nse(for_date: date) -> list[sources.Price]:
    master = sources.parse_equity_master(_get("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"))
    d = for_date.strftime("%d%m%Y")
    bhav = _get(f"https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d}.csv")
    return sources.parse_nse_bhav(bhav, master)


def fetch_indices(for_date: date) -> list[sources.IndexClose]:
    d = for_date.strftime("%d%m%Y")
    return sources.parse_indices(_get(f"https://nsearchives.nseindia.com/content/indices/ind_close_all_{d}.csv"), INDEX_CODES)


# ---------- sinks ----------
def _sql_str(v: str | None) -> str:
    return "null" if v is None else "'" + v.replace("'", "''") + "'"


def emit_sql(prices: list[sources.Price], indices: list[sources.IndexClose], path: str, batch: int = 500) -> None:
    lines: list[str] = []
    for i in range(0, len(prices), batch):
        vals = ",".join(
            f"({_sql_str(p.isin)},{_sql_str(p.name)},{_sql_str(p.nse_symbol)},{_sql_str(p.amfi_code)},{_sql_str(p.kind)},"
            f"{p.close_paise},{'null' if p.prev_close_paise is None else p.prev_close_paise},{_sql_str(p.price_date)},{_sql_str(p.source)})"
            for p in prices[i:i + batch])
        lines.append(
            "insert into public.instrument_prices (isin,name,nse_symbol,amfi_code,kind,close_paise,prev_close_paise,price_date,source) values "
            + vals
            + " on conflict (isin) do update set name=excluded.name,nse_symbol=excluded.nse_symbol,amfi_code=excluded.amfi_code,"
            "kind=excluded.kind,close_paise=excluded.close_paise,prev_close_paise=excluded.prev_close_paise,"
            "price_date=excluded.price_date,source=excluded.source,updated_at=now();")
    if indices:
        vals = ",".join(f"({_sql_str(i.code)},{_sql_str(i.price_date)},{i.close:.4f},{'null' if i.prev_close is None else f'{i.prev_close:.4f}'})" for i in indices)
        lines.append(
            "insert into public.index_prices (index_code,price_date,close,prev_close) values " + vals
            + " on conflict (index_code,price_date) do update set close=excluded.close,prev_close=excluded.prev_close;")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"wrote {len(prices)} prices + {len(indices)} indices to {path}")


def upsert_rest(prices: list[sources.Price], indices: list[sources.IndexClose]) -> None:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates"}
    with httpx.Client(timeout=120) as c:
        for i in range(0, len(prices), 1000):
            batch = [{"isin": p.isin, "name": p.name, "nse_symbol": p.nse_symbol, "amfi_code": p.amfi_code,
                      "kind": p.kind, "close_paise": p.close_paise, "prev_close_paise": p.prev_close_paise,
                      "price_date": p.price_date, "source": p.source} for p in prices[i:i + 1000]]
            c.post(f"{url}/rest/v1/instrument_prices?on_conflict=isin", json=batch, headers=headers).raise_for_status()
        if indices:
            idx = [{"index_code": x.code, "price_date": x.price_date, "close": x.close, "prev_close": x.prev_close} for x in indices]
            c.post(f"{url}/rest/v1/index_prices?on_conflict=index_code,price_date", json=idx, headers=headers).raise_for_status()
    print(f"upserted {len(prices)} prices + {len(indices)} indices")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("job", choices=["amfi", "nse", "indices", "all"])
    ap.add_argument("--date", help="YYYY-MM-DD for NSE files (default: last weekday)")
    ap.add_argument("--emit-sql", help="write upsert SQL to this file instead of calling Supabase")
    a = ap.parse_args(argv)

    for_date = date.fromisoformat(a.date) if a.date else date.today()
    while a.job in ("nse", "indices", "all") and for_date.weekday() >= 5:  # skip weekend
        for_date -= timedelta(days=1)

    prices: list[sources.Price] = []
    indices: list[sources.IndexClose] = []
    if a.job in ("amfi", "all"):
        prices += fetch_amfi()
    if a.job in ("nse", "all"):
        prices += fetch_nse(for_date)
    if a.job in ("indices", "all"):
        indices += fetch_indices(for_date)

    if a.emit_sql:
        emit_sql(prices, indices, a.emit_sql)
    else:
        upsert_rest(prices, indices)
    return 0


if __name__ == "__main__":
    sys.exit(main())
