"""Fetch and parse the daily price sources (PRD section 6). Pure parsing, so it is unit-tested
against saved fixtures; the network part is a thin wrapper.

- AMFI NAVAll.txt   -> mutual fund NAV by ISIN
- NSE sec_bhavdata  -> stock/ETF close by symbol  (+ EQUITY_L.csv for symbol -> ISIN)
- NSE ind_close_all -> index closes (Nifty 50, Nifty Bank, ...)
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime

UA = "Mozilla/5.0 (FolioLense price fetcher)"
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def _paise(v: str | float) -> int:
    return round(float(v) * 100)


def _iso(d: str) -> str:
    d = d.strip()
    # 26-Oct-2026
    try:
        p = d.split("-")
        if len(p) == 3 and p[1] in MONTHS:
            return f"{int(p[2]):04d}-{MONTHS[p[1]]:02d}-{int(p[0]):02d}"
    except (ValueError, KeyError):
        pass
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(d, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"unparseable date {d!r}")


@dataclass
class Price:
    isin: str
    name: str
    kind: str  # 'EQ' | 'MF'
    close_paise: int
    prev_close_paise: int | None
    price_date: str
    nse_symbol: str | None = None
    amfi_code: str | None = None
    source: str = ""


# ---------- AMFI mutual fund NAVs ----------
def parse_amfi(text: str) -> list[Price]:
    out: list[Price] = []
    seen: set[str] = set()
    for line in text.splitlines():
        if ";" not in line or line.startswith("Scheme Code"):
            continue
        f = line.split(";")
        if len(f) < 8:
            continue
        code, isin_g, isin_r, name, _plan, _opt, nav, date = f[:8]
        for isin in (isin_g.strip(), isin_r.strip()):
            if not isin or isin == "-" or isin in seen:
                continue
            try:
                nav_p = _paise(nav)
            except ValueError:
                continue
            if nav_p <= 0:
                continue
            seen.add(isin)
            out.append(Price(isin=isin, name=name.strip(), kind="MF", close_paise=nav_p,
                             prev_close_paise=None, price_date=_iso(date), amfi_code=code.strip(), source="amfi"))
    return out


# ---------- NSE equities ----------
def parse_equity_master(text: str) -> dict[str, tuple[str, str]]:
    """symbol -> (isin, company name) from EQUITY_L.csv"""
    out: dict[str, tuple[str, str]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        sym = (row.get("SYMBOL") or "").strip()
        isin = (row.get(" ISIN NUMBER") or row.get("ISIN NUMBER") or "").strip()
        name = (row.get("NAME OF COMPANY") or "").strip()
        if sym and isin:
            out[sym] = (isin, name)
    return out


def parse_nse_bhav(text: str, symbol_to_isin: dict[str, tuple[str, str]]) -> list[Price]:
    """sec_bhavdata_full_<date>.csv -> Price rows, keeping EQ/BE series matched to an ISIN."""
    out: list[Price] = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 9 or row[0].strip() == "SYMBOL":
            continue
        sym = row[0].strip()
        series = row[1].strip()
        if series not in ("EQ", "BE"):
            continue
        hit = symbol_to_isin.get(sym)
        if not hit:
            continue
        isin, name = hit
        try:
            out.append(Price(isin=isin, name=name or sym, kind="EQ",
                             close_paise=_paise(row[8]), prev_close_paise=_paise(row[3]),
                             price_date=_iso(row[2]), nse_symbol=sym, source="nse"))
        except ValueError:
            continue
    return out


# ---------- NSE equities: full daily bar (OHLC + volume + delivery) for the history table ----------
@dataclass
class HistoryBar:
    isin: str
    nse_symbol: str
    price_date: str
    open_paise: int
    high_paise: int
    low_paise: int
    close_paise: int
    volume: int
    deliv_qty: int | None
    deliv_pct: float | None


def _num(v: str) -> float | None:
    v = v.strip()
    if not v or v == "-":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def parse_nse_bhav_history(
    text: str, symbol_to_isin: dict[str, tuple[str, str]], wanted: set[str] | None = None
) -> list[HistoryBar]:
    """sec_bhavdata_full_<date>.csv -> one HistoryBar per EQ/BE row (optionally only `wanted` symbols).

    Columns: 0 SYMBOL 1 SERIES 2 DATE 3 PREV_CLOSE 4 OPEN 5 HIGH 6 LOW 7 LAST 8 CLOSE
             9 AVG 10 TTL_TRD_QNTY 11 TURNOVER 12 NO_OF_TRADES 13 DELIV_QTY 14 DELIV_PER
    """
    out: list[HistoryBar] = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) < 11 or row[0].strip() == "SYMBOL":
            continue
        sym = row[0].strip()
        if row[1].strip() not in ("EQ", "BE"):
            continue
        if wanted is not None and sym not in wanted:
            continue
        hit = symbol_to_isin.get(sym)
        if not hit:
            continue
        isin = hit[0]
        o, h, lo, c = _num(row[4]), _num(row[5]), _num(row[6]), _num(row[8])
        if c is None:
            continue
        dq = _num(row[13]) if len(row) > 13 else None
        dp = _num(row[14]) if len(row) > 14 else None
        out.append(HistoryBar(
            isin=isin, nse_symbol=sym, price_date=_iso(row[2]),
            open_paise=_paise(o) if o is not None else _paise(c),
            high_paise=_paise(h) if h is not None else _paise(c),
            low_paise=_paise(lo) if lo is not None else _paise(c),
            close_paise=_paise(c),
            volume=int(_num(row[10]) or 0),
            deliv_qty=int(dq) if dq is not None else None,
            deliv_pct=dp,
        ))
    return out


# ---------- NSE indices ----------
@dataclass
class IndexClose:
    code: str
    price_date: str
    close: float
    prev_close: float | None


def parse_indices(text: str, wanted: set[str] | None = None) -> list[IndexClose]:
    out: list[IndexClose] = []
    for row in csv.DictReader(io.StringIO(text)):
        name = (row.get("Index Name") or "").strip()
        if wanted and name not in wanted:
            continue
        try:
            close = float(row["Closing Index Value"])
            change = float(row.get("Points Change") or 0)
        except (KeyError, ValueError):
            continue
        out.append(IndexClose(code=name, price_date=_iso(row["Index Date"]), close=close, prev_close=close - change))
    return out
