"""Evaluate watchlist price alerts against today's close vs the previous close.

Runs after the daily price update. For each active alert, if the day's move clears the user's
₹ or % threshold in their chosen direction, it logs an alert_log row (once per stock per day) and,
when SMTP is configured and the user opted in, emails them a digest.

SMTP env (optional; without it, triggers are only logged for the in-app view):
    SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM (default SMTP_USER)
"""
from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText

import httpx


def _env() -> tuple[str, dict[str, str]]:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return url, {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _inlist(vals: list[str]) -> str:
    return "(" + ",".join('"' + v.replace('"', "") + '"' for v in vals) + ")"


def run_alerts() -> dict:
    url, H = _env()
    with httpx.Client(timeout=60) as c:
        wl = c.get(f"{url}/rest/v1/watchlist?select=*&alert_active=eq.true&alert_dir=not.is.null", headers=H).json()
        if not wl:
            return {"checked": 0, "triggered": 0, "emailed": 0}

        syms = sorted({r["nse_symbol"] for r in wl})
        px = c.get(f"{url}/rest/v1/instrument_prices?select=nse_symbol,close_paise,prev_close_paise,price_date"
                   f"&nse_symbol=in.{_inlist(syms)}", headers=H).json()
        pmap = {p["nse_symbol"]: p for p in px}

        triggered: list[dict] = []
        for r in wl:
            p = pmap.get(r["nse_symbol"])
            if not p or p.get("prev_close_paise") is None:
                continue
            close, prev, pdate = p["close_paise"], p["prev_close_paise"], p["price_date"]
            if r.get("last_alert_date") == pdate:   # already alerted this stock today
                continue
            move = close - prev
            if move == 0:
                continue
            kind = "up" if move > 0 else "down"
            dirn = r["alert_dir"]
            if (dirn == "up" and move < 0) or (dirn == "down" and move > 0):
                continue
            move_pct = (move / prev * 100) if prev else 0.0
            amt, pct = r.get("alert_amount_paise"), r.get("alert_pct")
            fire = (amt is not None and abs(move) >= amt) or (pct is not None and abs(move_pct) >= float(pct))
            if not fire:
                continue

            c.post(f"{url}/rest/v1/alert_log", headers=H, json={
                "owner_id": r["owner_id"], "nse_symbol": r["nse_symbol"], "name": r["name"], "kind": kind,
                "move_paise": move, "move_pct": round(move_pct, 2), "price_paise": close,
                "prev_paise": prev, "price_date": pdate}).raise_for_status()
            c.patch(f"{url}/rest/v1/watchlist?id=eq.{r['id']}", headers=H, json={
                "last_alert_date": pdate, "last_alert_kind": kind, "last_alert_price_paise": close}).raise_for_status()
            triggered.append({"owner": r["owner_id"], "sym": r["nse_symbol"], "name": r["name"],
                              "kind": kind, "move": move, "move_pct": move_pct, "close": close})

        emailed = _email_digests(c, url, H, triggered)
        return {"checked": len(wl), "triggered": len(triggered), "emailed": emailed}


def _email_digests(c: httpx.Client, url: str, H: dict, triggered: list[dict]) -> int:
    host = os.environ.get("SMTP_HOST")
    if not triggered or not host:
        return 0
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER"); pw = os.environ.get("SMTP_PASS")
    frm = os.environ.get("SMTP_FROM") or user or ""
    owners = sorted({t["owner"] for t in triggered})
    prefs = c.get(f"{url}/rest/v1/preferences?select=user_id,alerts_email_on,alert_email"
                  f"&user_id=in.({','.join(owners)})", headers=H).json()
    pmap = {p["user_id"]: p for p in prefs}

    sent = 0
    for owner in owners:
        pr = pmap.get(owner)
        if not pr or not pr.get("alerts_email_on") or not pr.get("alert_email"):
            continue
        rows = [t for t in triggered if t["owner"] == owner]
        lines = [f"  {t['sym']:<14} {'UP  ' if t['kind'] == 'up' else 'DOWN'}  "
                 f"{t['move'] / 100:+.2f}  ({t['move_pct']:+.2f}%)   ->  Rs {t['close'] / 100:,.2f}" for t in rows]
        body = ("FolioLense — price alerts for today's close:\n\n" + "\n".join(lines)
                + "\n\nOpen FolioLense → Watchlist for details. You set these alerts yourself; "
                  "turn them off any time in the app.")
        msg = MIMEText(body)
        msg["Subject"] = f"FolioLense: {len(rows)} price alert{'s' if len(rows) != 1 else ''}"
        msg["From"] = frm; msg["To"] = pr["alert_email"]
        try:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls()
                if user:
                    s.login(user, pw or "")
                s.send_message(msg)
            sent += 1
        except Exception as e:  # noqa: BLE001 - never fail the job over an email
            print("alert email failed:", str(e)[:100])
    return sent
