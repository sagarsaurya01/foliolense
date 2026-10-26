"use client";

import { ASSET_CLASSES } from "@/lib/assetClasses";
import { sumFigures } from "@/lib/calc/figures";
import { rupees } from "@/lib/format";
import { xirrPct, type Holding, type TxRow } from "@/lib/holdings";
import { Modal, ModalHead } from "./Modal";

// colours per asset class, chosen to read on both themes
const COLOR: Record<string, string> = {
  EQ: "#1f6f5c", MFE: "#d9603a", MFD: "#e9b949", SIF: "#a24d7a", BNK: "#6b8f3a", ULP: "#3d7fa8",
  INS: "#7a6a55", PE: "#4b4f9c", FD: "#5b7fbf", CD: "#8a6bb8", PPF: "#3a9bb0", GLD: "#b58a2c",
};
const pct = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const value = (h: Holding) => h.fig.currentPaise ?? h.fig.investedPaise;

function Donut({ parts, half }: { parts: { v: number; c: string }[]; half?: boolean }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const r = 40, cx = 60, cy = half ? 58 : 60;
  const L = Math.PI * r * (half ? 1 : 2);
  let off = 0;
  return (
    <svg viewBox={`0 0 120 ${half ? 70 : 120}`} role="img" aria-label="allocation chart">
      <circle r={r} cx={cx} cy={cy} fill="none" stroke="var(--surface-2)" strokeWidth={16}
        strokeDasharray={half ? `${L} 999` : undefined} transform={half ? `rotate(180 ${cx} ${cy})` : undefined} />
      {parts.map((p, i) => {
        const len = (p.v / total) * L;
        const el = (
          <circle key={i} r={r} cx={cx} cy={cy} fill="none" stroke={p.c} strokeWidth={16}
            strokeDasharray={`${len} ${2 * Math.PI * r}`} strokeDashoffset={-off}
            transform={`rotate(${half ? 180 : -90} ${cx} ${cy})`} />
        );
        off += len;
        return el;
      })}
    </svg>
  );
}

function split(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + value(h), 0) || 1;
  const byClass = ASSET_CLASSES.map((c) => ({
    code: c.code, name: c.name, c: COLOR[c.code],
    v: holdings.filter((h) => h.cls === c.code).reduce((s, h) => s + value(h), 0),
  })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const eq = [
    { name: "Stocks & ETFs", c: COLOR.EQ, v: holdings.filter((h) => h.cls === "EQ").reduce((s, h) => s + value(h), 0) },
    { name: "Equity mutual funds", c: COLOR.MFE, v: holdings.filter((h) => h.cls === "MFE").reduce((s, h) => s + value(h), 0) },
    { name: "SIF", c: COLOR.SIF, v: holdings.filter((h) => h.cls === "SIF").reduce((s, h) => s + value(h), 0) },
  ].filter((x) => x.v > 0);
  return { total, byClass, eq, eqTotal: eq.reduce((s, x) => s + x.v, 0) || 1 };
}

export function AnalyticsCards({ holdings, xirr, onOpen }: { holdings: Holding[]; xirr: number | null; onOpen: () => void }) {
  const { total, byClass, eq, eqTotal } = split(holdings);
  return (
    <>
      <button className="acard" onClick={onOpen}>
        <span className="label">Asset allocation</span>
        {byClass.length > 0 && <Donut half parts={byClass} />}
        <div className="mini">
          {byClass.slice(0, 5).map((x) => (
            <span key={x.code}><span><i style={{ background: x.c }} />{x.name}</span><b className="num">{((x.v / total) * 100).toFixed(1)}%</b></span>
          ))}
        </div>
        <h4>Holdings</h4>
      </button>
      <button className="acard" onClick={onOpen}>
        <span className="label">Return (XIRR)</span>
        <div style={{ display: "grid", gap: 6, padding: "10px 0" }}>
          <b className={`num ${xirr == null ? "mut" : xirr >= 0 ? "gain" : "loss"}`} style={{ fontSize: 24 }}>{pct(xirr)}</b>
          <span className="mini">a year, since the first investment</span>
          <span className="mini">Nifty 50 comparison arrives with daily prices (Phase 2).</span>
        </div>
        <h4>Performance</h4>
      </button>
      <button className="acard" onClick={onOpen}>
        <span className="label">Equity exposure</span>
        {eq.length > 0 ? <Donut parts={eq} /> : <span className="mini">No equity holdings.</span>}
        <div className="mini">
          {eq.map((x) => (
            <span key={x.name}><span><i style={{ background: x.c }} />{x.name}</span><b className="num">{((x.v / eqTotal) * 100).toFixed(1)}%</b></span>
          ))}
        </div>
        <h4>Equity Exposure</h4>
      </button>
    </>
  );
}

export function AnalyticsModal({ holdings, rows, xirr, asOf, title, onClose }: { holdings: Holding[]; rows: TxRow[]; xirr: number | null; asOf: string; title: string; onClose: () => void }) {
  const classes = ASSET_CLASSES.map((c) => {
    const hs = holdings.filter((h) => h.cls === c.code);
    const ids = new Set(hs.map((h) => h.assetId));
    return { c, hs, f: sumFigures(hs.map((h) => h.fig)), x: hs.length ? xirrPct(rows.filter((r) => ids.has(r.asset_id)), hs, asOf) : null };
  }).filter((r) => r.hs.length);
  const all = sumFigures(holdings.map((h) => h.fig));
  const totalValue = holdings.reduce((s, h) => s + value(h), 0) || 1;
  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Analytics" extra={<div className="mut" style={{ fontSize: 13 }}>{title}</div>} onClose={onClose} />
      <div className="mbody">
        <div className="anpanel" style={{ width: "auto", padding: 0 }}>
          <AnalyticsCards holdings={holdings} xirr={xirr} onOpen={() => {}} />
        </div>
        <div className="tbox" style={{ maxHeight: "none" }}>
          <table>
            <thead><tr><th>Asset class</th><th>Invested</th><th>Current value</th><th>Share</th><th>Gain</th><th>XIRR</th></tr></thead>
            <tbody>
              {classes.map(({ c, hs, f, x }) => (
                <tr className="row" key={c.code}>
                  <td><code className="gcode" style={{ color: COLOR[c.code], borderColor: COLOR[c.code] }}>{c.chip}</code> {c.name}</td>
                  <td className="num">{rupees(f.investedPaise)}</td>
                  <td className="num">{f.currentPaise == null ? "—" : rupees(f.currentPaise)}</td>
                  <td className="num">{((hs.reduce((s, h) => s + value(h), 0) / totalValue) * 100).toFixed(1)}%</td>
                  <td className={`num ${f.unrealisedPaise == null ? "" : f.unrealisedPaise >= 0 ? "gain" : "loss"}`}>{f.unrealisedPaise == null ? "—" : rupees(f.unrealisedPaise)}</td>
                  <td className={`num ${x == null ? "" : x >= 0 ? "gain" : "loss"}`}>{pct(x)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{rupees(all.investedPaise)}</td>
                <td className="num">{all.currentPaise == null ? "—" : rupees(all.currentPaise)}</td>
                <td className="num">100%</td>
                <td className="num">{all.unrealisedPaise == null ? "—" : rupees(all.unrealisedPaise)}</td>
                <td className="num">{pct(xirr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {all.currentPaise == null && <span className="note">Some holdings have no price yet, so their value and XIRR are left blank. Set a price on the holdings table.</span>}
      </div>
    </Modal>
  );
}
