"""Turn investment statements into FolioLense transaction rows (PRD section 8).

The pure transforms here (``cas_to_rows``, ``ecas_to_holdings``, ``tradebook_to_rows``) take
already-parsed data, so they are unit-tested without any real PDF. The thin wrappers
(``read_cas``) call casparser, which needs the real encrypted file + password.

A "row" is the common shape the app's review screen and importer expect:
  {date, type, isin, amfi_code, symbol, name, units, nav_paise, amount_paise, charges_paise,
   account_key, source_ref}
"""

from __future__ import annotations

import csv
import hashlib
import io
from decimal import Decimal
from typing import Any

# casparser mutual-fund transaction type -> our transaction type (None = skip, e.g. a tax line)
CAS_TYPE = {
    "PURCHASE": "buy", "PURCHASE_SIP": "buy", "SWITCH_IN": "buy", "SWITCH_IN_MERGER": "merge_in",
    "REDEMPTION": "sell", "SWITCH_OUT": "sell", "SWITCH_OUT_MERGER": "merge_out",
    "DIVIDEND_PAYOUT": "dividend", "DIVIDEND_REINVEST": "buy",
    "GIFT_IN": "buy", "GIFT_OUT": "sell",
    "STT_TAX": None, "STAMP_DUTY_TAX": None, "TDS_TAX": None, "SEGREGATION": None,
    "MISC": None, "UNKNOWN": None, "REVERSAL": None,
}


def _paise(v: Any) -> int:
    return int((Decimal(str(v)) * 100).quantize(Decimal("1")))


def _ref(*parts: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def cas_to_rows(data: dict) -> dict:
    """CAMS/KFin CAS (casparser .model_dump()) -> {rows, tieouts, account}.

    tieouts lets the importer confirm it read the statement right: per scheme, the closing
    units and value printed in the CAS must equal what our rows rebuild.
    """
    rows: list[dict] = []
    tieouts: list[dict] = []
    for folio in data.get("folios", []):
        folio_no = (folio.get("folio") or "").strip()
        for sch in folio.get("schemes", []):
            isin = (sch.get("isin") or "").strip() or None
            amfi = str(sch.get("amfi") or "").strip() or None
            name = (sch.get("scheme") or "").strip()
            account_key = folio_no or isin or name
            built_units = 0.0
            for i, t in enumerate(sch.get("transactions", [])):
                # the type may be a plain string or a TransactionType enum (PURCHASE_SIP / "TransactionType.PURCHASE_SIP")
                raw = t.get("type")
                tname = getattr(raw, "name", None) or str(raw or "").split(".")[-1]
                kind = CAS_TYPE.get(tname.upper())
                units = t.get("units")
                if kind is None:
                    continue
                if kind != "dividend" and units in (None, 0):
                    continue
                amount = t.get("amount") or 0
                nav = t.get("nav") or 0
                u = abs(float(units or 0))
                if kind in ("buy", "merge_in"):
                    built_units += u
                elif kind in ("sell", "merge_out"):
                    built_units -= u
                rows.append({
                    "date": str(t.get("date")),
                    "type": kind,
                    "isin": isin, "amfi_code": amfi, "symbol": None, "name": name,
                    "units": u if kind != "dividend" else 0,
                    "nav_paise": _paise(nav) if nav else 0,
                    "amount_paise": abs(_paise(amount)),
                    "charges_paise": 0,
                    "account_key": account_key,
                    # include the scheme-local index so two identical transactions don't collide
                    "source_ref": _ref("cas", folio_no, isin or name, t.get("date"), units, amount, i),
                })
            # tie-out on UNITS: the closing balance printed in the CAS vs units rebuilt from its transactions.
            # They match only when the CAS covers full history; a part-period CAS legitimately shows fewer.
            close_units = float(sch.get("close") or 0)
            if close_units or built_units:
                tieouts.append({
                    "name": name, "isin": isin,
                    "close_units": close_units, "built_units": round(built_units, 3),
                    "close_value_paise": _paise((sch.get("valuation") or {}).get("value") or 0),
                })
    investor = (data.get("investor_info") or {}).get("name")
    return {"rows": rows, "tieouts": tieouts, "account": investor}


def ecas_to_holdings(data: dict) -> dict:
    """NSDL/CDSL e-CAS (casparser demat) -> holdings snapshot for reconciliation / opening.

    e-CAS shows what is held and its current value, not the purchase history, so these are
    'opening' rows valued at the statement's current price (cost basis is only exact from a CAS
    or a contract note).
    """
    holdings: list[dict] = []
    for dmt in data.get("demat_accounts", []) or []:
        acct = (dmt.get("client_id") or dmt.get("dp_id") or "").strip()
        for eq in dmt.get("equities", []) or []:
            qty = float(eq.get("num_shares") or 0)
            if qty <= 0:
                continue
            holdings.append({
                "cls": "EQ", "isin": (eq.get("isin") or "").strip() or None,
                "symbol": (eq.get("symbol") or "").strip() or None,
                "name": (eq.get("name") or "").strip(),
                "qty": qty, "price_paise": _paise(eq.get("price") or 0),
                "value_paise": _paise(eq.get("value") or 0), "account_key": acct,
            })
        for mf in dmt.get("mutual_funds", []) or []:
            qty = float(mf.get("num_shares") or mf.get("units") or 0)
            if qty <= 0:
                continue
            holdings.append({
                "cls": "MFE", "isin": (mf.get("isin") or "").strip() or None, "symbol": None,
                "name": (mf.get("name") or "").strip(), "qty": qty,
                "price_paise": _paise(mf.get("price") or mf.get("nav") or 0),
                "value_paise": _paise(mf.get("value") or 0), "account_key": acct,
            })
    return {"holdings": holdings}


# ---------- Zerodha tradebook (CSV, from Console) ----------
def tradebook_to_rows(text: str) -> dict:
    """Zerodha equity tradebook CSV -> buy/sell rows. Columns vary slightly; we read by header name."""
    reader = csv.DictReader(io.StringIO(text))
    cols = {(c or "").strip().lower(): c for c in (reader.fieldnames or [])}

    def col(*names: str) -> str | None:
        for n in names:
            if n in cols:
                return cols[n]
        return None

    c_sym = col("symbol", "tradingsymbol")
    c_isin = col("isin")
    c_date = col("trade_date", "order_execution_time", "date")
    c_type = col("trade_type", "transaction_type", "buy/sell")
    c_qty = col("quantity", "qty")
    c_price = col("price", "trade_price", "average_price")
    rows: list[dict] = []
    if not (c_sym and c_date and c_type and c_qty and c_price):
        return {"rows": [], "error": "Not a recognised tradebook (missing symbol/date/type/qty/price columns)."}
    for i, r in enumerate(csv.DictReader(io.StringIO(text))):
        try:
            qty = abs(float(r[c_qty]))
            price = float(r[c_price])
        except (ValueError, KeyError, TypeError):
            continue
        if qty <= 0:
            continue
        t = (r[c_type] or "").strip().lower()
        kind = "buy" if t in ("buy", "b") else "sell" if t in ("sell", "s") else None
        if kind is None:
            continue
        date = (r[c_date] or "")[:10]
        sym = (r[c_sym] or "").strip()
        rows.append({
            "date": date, "type": kind, "isin": (r.get(c_isin) or "").strip() or None if c_isin else None,
            "amfi_code": None, "symbol": sym, "name": sym, "cls": "EQ",
            "units": qty, "nav_paise": _paise(price), "amount_paise": _paise(qty * price),
            "charges_paise": 0, "account_key": "zerodha",
            "source_ref": _ref("tradebook", sym, date, t, qty, price, i),
        })
    return {"rows": rows}
