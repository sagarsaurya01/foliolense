"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { linkInstrument, unlinkInstrument } from "@/app/tx-actions";
import { rupees } from "@/lib/format";
import type { Holding } from "@/lib/holdings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Modal } from "./Modal";

type Hit = { isin: string; name: string; nse_symbol: string | null; amfi_code: string | null; kind: string; close_paise: number; price_date: string };

// Search the daily feed (instrument_prices) and link a holding to the real instrument,
// so its price updates every day. Equity holdings search stocks, fund holdings search funds.
export function LinkPrice({ h, onClose, onDone, onManual }: { h: Holding; onClose: () => void; onDone: (m: string) => void; onManual: () => void }) {
  const equity = h.cls === "EQ";
  const kind = equity ? "EQ" : "MF";
  const [q, setQ] = useState(h.name);
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      const supabase = supabaseBrowser();
      const { data } = await supabase
        .from("instrument_prices")
        .select("isin, name, nse_symbol, amfi_code, kind, close_paise, price_date")
        .eq("kind", kind)
        .ilike("name", `%${q.trim()}%`)
        .limit(25);
      setHits((data ?? []) as Hit[]);
      setBusy(false);
    }, 300);
  }, [q, kind]);

  const pick = (hit: Hit) =>
    start(async () => {
      const r = await linkInstrument(h.assetId, hit.isin, hit.nse_symbol, hit.amfi_code);
      if (r.error) setError(r.error);
      else onDone(`Linked to ${hit.name} · daily price now applies`);
    });
  const unlink = () =>
    start(async () => {
      const r = await unlinkInstrument(h.assetId);
      if (r.error) setError(r.error);
      else onDone("Unlinked. Type a price instead.");
    });

  return (
    <Modal wide onClose={onClose}>
      <form className="dlg" onSubmit={(e) => e.preventDefault()}>
        <h2>Link to live price</h2>
        <span className="mut" style={{ fontSize: 13 }}>
          {h.name} · find the real {equity ? "stock / ETF" : "mutual fund"}, so its price updates every day.
        </span>
        <label className="field">
          Search {equity ? "NSE stocks and ETFs" : "mutual funds"}
          <input id="linkSearch" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={equity ? "e.g. HDFC Bank" : "e.g. Parag Parikh Flexi Cap Direct Growth"} />
        </label>
        {h.isin && (
          <div className="note">
            Currently linked ({h.isin}). <button type="button" className="link" onClick={unlink} style={{ color: "var(--loss)" }}>Unlink</button>
          </div>
        )}
        <div className="err">{error}</div>
        <div className="tbox" style={{ maxHeight: "48vh" }}>
          {busy ? (
            <div className="empty">Searching…</div>
          ) : hits.length ? (
            <table>
              <thead><tr><th>Name</th><th>{equity ? "Symbol" : "AMFI"}</th><th>Price</th><th>As of</th><th /></tr></thead>
              <tbody>
                {hits.map((hit) => (
                  <tr className="row" key={hit.isin}>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{hit.name}</td>
                    <td>{equity ? hit.nse_symbol : hit.amfi_code}</td>
                    <td className="num">{rupees(hit.close_paise)}</td>
                    <td>{hit.price_date.split("-").reverse().join("-")}</td>
                    <td><button className="btn primary" disabled={pending} onClick={() => pick(hit)}>Link</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">{q.trim().length < 3 ? "Type at least 3 letters." : "No match. Try fewer words (the fund's exact name helps)."}</div>
          )}
        </div>
        <div className="row-end">
          <button type="button" className="btn" onClick={onManual}>Type a price instead</button>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
      </form>
    </Modal>
  );
}
