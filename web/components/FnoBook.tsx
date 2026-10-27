"use client";

import { useMemo, useState } from "react";
import { computeFno, contractLabel, unrealisedPnl, type FnoTrade } from "@/lib/calc/fno";
import { rupees } from "@/lib/format";

export interface FnoTradeRow {
  underlying: string;
  instrument: "FUT" | "CE" | "PE";
  expiry: string;
  strike_paise: number | null;
  segment: "stock" | "other";
  trade_date: string;
  side: "buy" | "sell";
  quantity: number;
  price_paise: number;
}

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const pnlCell = (p: number) => <span className={`num ${p >= 0 ? "gain" : "loss"}`}>{rupees(p)}</span>;

export function FnoBook({ name, trades }: { name: string; trades: FnoTradeRow[] }) {
  const [seg, setSeg] = useState<"stock" | "other">("stock");
  const [period, setPeriod] = useState("All");

  const fnoTrades: FnoTrade[] = useMemo(
    () => trades.map((t) => ({
      underlying: t.underlying, instrument: t.instrument, expiry: t.expiry,
      strikePaise: t.strike_paise ?? undefined, segment: t.segment,
      date: t.trade_date, side: t.side, quantity: t.quantity, pricePaise: t.price_paise,
    })),
    [trades],
  );
  const result = useMemo(() => computeFno(fnoTrades), [fnoTrades]);
  const fys = useMemo(() => ["All", ...Object.keys(result.turnoverPaiseByFy).sort().reverse()], [result]);

  const inPeriod = (fy: string) => period === "All" || fy === period;
  const fyOf = (d: string) => { const [y, m] = d.split("-").map(Number); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };

  const expired = today();
  const realised = result.realised.filter((r) => {
    const t = fnoTrades.find((x) => x.date === r.closeDate);
    return t?.segment === seg && inPeriod(fyOf(r.closeDate));
  });
  const openSeg = result.open.filter((o) => o.segment === seg);
  // an option past its expiry settles worthless (0): that is realised, not open
  const expiredSettled = openSeg.filter((o) => o.expiry < expired && o.instrument !== "FUT" && inPeriod(fyOf(o.expiry)));
  const stillOpen = openSeg.filter((o) => !(o.expiry < expired && o.instrument !== "FUT"));
  const realisedTotal = realised.reduce((s, r) => s + r.pnlPaise, 0) + expiredSettled.reduce((s, o) => s + unrealisedPnl(o, 0), 0);
  const openUnreal = stillOpen.reduce((s, o) => s + unrealisedPnl(o, o.avgPricePaise), 0);
  const expiredTurnover = expiredSettled.reduce((s, o) => s + Math.abs(unrealisedPnl(o, 0)), 0);
  const turnover = (period === "All"
    ? Object.values(result.turnoverPaiseByFy).reduce((s, v) => s + v, 0)
    : result.turnoverPaiseByFy[period] ?? 0) + expiredTurnover;
  const open = stillOpen;

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <label className="field" style={{ maxWidth: 160 }}>
          Period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {fys.map((f) => <option key={f} value={f}>{f === "All" ? "All to date" : `FY ${f}`}</option>)}
          </select>
        </label>
        <span className="label">{trades.length} trades in {name}</span>
      </div>

      <section className="summary" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
        <div className="stat"><span className="label">Realised P/L</span><span className={`v num ${realisedTotal >= 0 ? "gain" : "loss"}`}>₹{rupees(realisedTotal)}</span><span className="s mut">{realised.length} closed</span></div>
        <div className="stat"><span className="label">Open positions</span><span className="v num">{open.length}</span><span className="s mut">{seg === "stock" ? "index / stock" : "currency / commodity"}</span></div>
        <div className="stat"><span className="label">Open MTM (est.)</span><span className={`v num ${openUnreal >= 0 ? "gain" : "loss"}`}>₹{rupees(openUnreal)}</span><span className="s mut">expired options at 0</span></div>
        <div className="stat"><span className="label">Turnover ({period === "All" ? "all" : period})</span><span className="v num">₹{rupees(turnover)}</span><span className="s mut">for the tax-audit check</span></div>
      </section>

      <div className="tabsWrap" style={{ flex: "0 1 auto", alignSelf: "flex-start" }}>
        <div className="tabs">
          {([["stock", "Stock F&O"], ["other", "Other F&O"]] as const).map(([k, label]) => (
            <button key={k} className="tab" role="tab" aria-selected={seg === k} onClick={() => setSeg(k)}><code>{k === "stock" ? "S" : "OT"}</code>{label}</button>
          ))}
        </div>
      </div>

      <div className="tbox">
        {open.length || realised.length || expiredSettled.length ? (
          <table>
            <thead><tr><th>Contract</th><th>Status</th><th>Qty</th><th>Open</th><th>Close / LTP</th><th>Realised P/L</th></tr></thead>
            <tbody>
              {open.map((o) => (
                <tr className="row" key={o.key}>
                  <td style={{ textAlign: "left" }}><span className="xp" style={{ color: "var(--gain)" }} title="Open">O</span> {contractLabel(o)}</td>
                  <td>{o.qty > 0 ? "Long" : "Short"}</td>
                  <td className="num">{Math.abs(o.qty)}</td>
                  <td className="num">{rupees(o.avgPricePaise)}</td>
                  <td className="num">—</td>
                  <td><span className="mut">open</span></td>
                </tr>
              ))}
              {expiredSettled.map((o) => (
                <tr className="row" key={`e${o.key}`}>
                  <td style={{ textAlign: "left" }}><span className="xp" title="Expired, settled at 0">E</span> {contractLabel(o)}</td>
                  <td>{o.qty > 0 ? "Long (lapsed)" : "Short (kept)"}</td>
                  <td className="num">{Math.abs(o.qty)}</td>
                  <td className="num">{rupees(o.avgPricePaise)}</td>
                  <td className="num">0 (exp)</td>
                  <td>{pnlCell(unrealisedPnl(o, 0))}</td>
                </tr>
              ))}
              {realised.map((r, i) => (
                <tr className="row" key={`r${i}`}>
                  <td style={{ textAlign: "left" }}>{r.key.split("|")[0]} {r.key.split("|")[1]} {r.key.split("|")[2]} {r.key.split("|")[3] ? Number(r.key.split("|")[3]) / 100 : ""}</td>
                  <td>{r.wasShort ? "Short closed" : "Long closed"}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{rupees(r.openPricePaise)}</td>
                  <td className="num">{rupees(r.closePricePaise)}</td>
                  <td>{pnlCell(r.pnlPaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Realised total</td><td /><td /><td /><td /><td>{pnlCell(realisedTotal)}</td></tr></tfoot>
          </table>
        ) : (
          <div className="empty">No {seg === "stock" ? "stock/index" : "currency/commodity"} F&amp;O trades yet. Import a contract note from the Actions menu.</div>
        )}
      </div>
      <span className="note">
        Realised P/L includes closed trades plus expired options <b>assumed to have lapsed worthless</b> (settled at 0) — correct for sold out-of-the-money options, but an option that expired in-the-money was really a loss; exact expiry settlement needs the F&amp;O price feed (added with the daily prices). Turnover is the sum of absolute realised P/L (ICAI guidance), for the tax-audit threshold check.
      </span>
    </>
  );
}
