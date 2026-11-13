"use client";

import { useEffect, useMemo, useState } from "react";
import { stockReport, type StockReportData } from "@/app/stock-actions";
import { quantity, rupees } from "@/lib/format";
import { Modal, ModalHead } from "./Modal";

const pct = (n: number | null) => (n == null || !isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const tone = (n: number | null) => (n == null ? "" : n > 0.05 ? "gain" : n < -0.05 ? "loss" : "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dmy = (d: string) => { const [y, m, dd] = d.split("-"); return `${dd}-${MON[+m - 1]}-${y}`; };
const TYPE: Record<string, string> = { buy: "Buy", sell: "Sell", dividend: "Dividend", interest: "Interest", bonus: "Bonus", split: "Split", opening: "Opening" };

type AssetRow = { id: string; name: string; cls: string };

function Stat({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div style={{ padding: "11px 13px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", minWidth: 0 }}>
      <div className="mut" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div className={`num ${cls ?? ""}`} style={{ fontSize: 16, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div className={`num ${cls ?? "mut"}`} style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function StockReport({ familyId, assetList, initialAssetId, onClose }: {
  familyId: string; assetList: AssetRow[]; initialAssetId?: string; onClose: () => void;
}) {
  const [assetId, setAssetId] = useState<string | undefined>(initialAssetId);
  const [q, setQ] = useState("");
  const [data, setData] = useState<StockReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assetId) { setData(null); return; }
    let alive = true;
    setLoading(true); setData(null);
    stockReport(familyId, assetId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [familyId, assetId]);

  const matches = useMemo(() => {
    const seen = new Set<string>();
    return assetList
      .filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return !q || a.name.toLowerCase().includes(q.toLowerCase()); })
      .slice(0, 60);
  }, [assetList, q]);

  const priceStr = data?.pricePaise != null ? rupees(data.pricePaise) : null;
  const dayChgPct = data && data.pricePaise != null && data.prevPaise ? (data.pricePaise - data.prevPaise) / data.prevPaise * 100 : null;

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Stock report" extra={<div className="mut" style={{ fontSize: 13 }}>Across the whole family</div>} onClose={onClose} />

      {!assetId ? (
        <div style={{ padding: "4px 16px 16px" }}>
          <label className="asearch" style={{ width: "100%", background: "var(--surface)", marginBottom: 10 }}>
            <input placeholder="Search a stock or fund…" aria-label="Search a stock" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "52vh", overflow: "auto" }}>
            {matches.map((a) => (
              <button key={a.id} className="it" style={{ textAlign: "left", justifyContent: "flex-start" }} onClick={() => setAssetId(a.id)}>
                {a.name} <span className="mut" style={{ fontSize: 11, marginLeft: 6 }}>{a.cls}</span>
              </button>
            ))}
            {!matches.length && <div className="mut" style={{ fontSize: 13, padding: 8 }}>No assets match.</div>}
          </div>
        </div>
      ) : (
        <div style={{ padding: "4px 16px 16px" }}>
          <button className="link" style={{ fontSize: 12, marginBottom: 10 }} onClick={() => { setAssetId(undefined); setQ(""); }}>← Pick another stock</button>

          {loading ? (
            <div className="mut" style={{ fontSize: 13, padding: 20 }}>Loading the stock&apos;s history…</div>
          ) : !data ? (
            <div className="mut" style={{ fontSize: 13, padding: 20 }}>Couldn&apos;t load this stock.</div>
          ) : !data.txns.length ? (
            <div><h2 style={{ fontFamily: "var(--f-display)", fontSize: 20, margin: "0 0 6px" }}>{data.name}</h2>
              <div className="mut" style={{ fontSize: 13 }}>No buys or sells of this in the family yet.</div></div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <h2 style={{ fontFamily: "var(--f-display)", fontSize: 20, margin: 0 }}>{data.name}</h2>
                {priceStr && (
                  <span className="num" style={{ fontSize: 15 }}>{priceStr}
                    {dayChgPct != null && <span className={`num ${tone(dayChgPct)}`} style={{ marginLeft: 6, fontSize: 13 }}>{pct(dayChgPct)} today</span>}
                  </span>
                )}
                {data.priceDate && <span className="mut" style={{ fontSize: 11 }}>as of {dmy(data.priceDate)}</span>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
                <Stat label="Bought" value={quantity(data.boughtQty)} sub={data.boughtQty ? `avg ${rupees(Math.round(data.boughtCostPaise / data.boughtQty))}` : undefined} />
                {data.soldQty > 0 && <Stat label="Sold" value={quantity(data.soldQty)} sub={`avg ${rupees(Math.round(data.soldProceedsPaise / data.soldQty))}`} />}
                {data.soldQty > 0 && <Stat label="Realised P/L" value={rupees(data.realisedPaise)} cls={tone(data.realisedPaise)} />}
                {data.dividendsPaise > 0 && <Stat label="Dividends" value={rupees(data.dividendsPaise)} cls="gain" />}
                <Stat label="Net held" value={quantity(data.netQty)} sub={data.netQty ? `avg cost ${rupees(data.avgCostPaise)}` : "nothing held"} />
                <Stat label="Invested" value={rupees(data.investedPaise)} />
                <Stat label="Current value" value={data.currentPaise == null ? "—" : rupees(data.currentPaise)} sub={data.heldAtCost ? "at cost" : undefined} />
                <Stat label="Unrealised" value={data.unrealisedPaise == null ? "—" : rupees(data.unrealisedPaise)}
                  sub={data.unrealisedPaise == null ? undefined : pct(data.investedPaise ? data.unrealisedPaise / data.investedPaise * 100 : null)}
                  cls={tone(data.unrealisedPaise)} />
              </div>

              <div className="tbox" style={{ overflow: "auto" }}>
                <table>
                  <thead><tr>
                    <th style={{ textAlign: "left" }}>Date</th><th style={{ textAlign: "left" }}>Type</th><th style={{ textAlign: "left" }}>Member</th>
                    <th>Qty</th><th>Price</th><th>Amount</th><th>vs today</th>
                  </tr></thead>
                  <tbody>
                    {data.txns.map((t) => {
                      const isBuy = t.type === "buy", isSell = t.type === "sell", isDiv = t.type === "dividend" || t.type === "interest";
                      const vsP = isBuy && data.pricePaise != null && t.pricePaise ? (data.pricePaise - t.pricePaise) / t.pricePaise * 100 : null;
                      return (
                        <tr key={t.id} className="row">
                          <td style={{ textAlign: "left" }}>{dmy(t.date)}</td>
                          <td style={{ textAlign: "left" }}><span className={isBuy ? "gain" : isSell ? "loss" : "mut"} style={{ fontWeight: 600 }}>{TYPE[t.type] ?? t.type}</span></td>
                          <td style={{ textAlign: "left" }} className="mut">{t.member}</td>
                          <td className="num">{isDiv ? "—" : quantity(t.qty)}</td>
                          <td className="num">{isDiv ? "—" : rupees(t.pricePaise)}</td>
                          <td className="num">{rupees(t.amountPaise)}</td>
                          <td className="num">{vsP != null ? <span className={tone(vsP)}>{pct(vsP)}</span> : isSell ? <span className="mut">sold</span> : <span className="mut">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mut" style={{ fontSize: 11, marginTop: 8 }}>Buys show price appreciation against today&apos;s price · realised P/L is on shares already sold (average cost) · this is a read-only view.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
