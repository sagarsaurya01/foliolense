"use client";

import { useState } from "react";
import { ASSET_CLASSES, classInfo } from "@/lib/assetClasses";
import { sumFigures } from "@/lib/calc/figures";
import { quantity, rupees } from "@/lib/format";
import { termOf, type Holding } from "@/lib/holdings";

type SortKey = "name" | "qty" | "invested" | "price" | "today" | "unrl" | "current";

const pct = (n: number | null) => (n == null || !isFinite(n) ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const tone = (n: number | null) => (n == null ? "" : n > 0.5 ? "gain" : n < -0.5 ? "loss" : "");
const dmy = (d: string) => {
  const [y, m, dd] = d.split("-");
  return `${dd}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]}-${y}`;
};

function TwoLine({ paise, percent }: { paise: number | null; percent: number | null }) {
  if (paise == null) return <span className="mut">—</span>;
  return (
    <div className={`two pl ${tone(paise)}`}>
      <span className="num">{rupees(paise)}</span>
      <small className="num">{pct(percent)}</small>
    </div>
  );
}

export function HoldingsTable({
  holdings,
  combined,
  portName,
  asOf,
  onSetPrice,
  onAdd,
  emptyText,
}: {
  holdings: Holding[];
  combined: boolean;
  portName: (id: string) => string;
  asOf: string;
  onSetPrice: (h: Holding) => void;
  onAdd: () => void;
  emptyText: string;
}) {
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "current", d: -1 });
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!holdings.length)
    return (
      <div className="empty">
        {emptyText}
        <button className="addp" onClick={onAdd}><span className="plus">+</span>Add a transaction</button>
      </div>
    );

  const key: Record<SortKey, (h: Holding) => number | string> = {
    name: (h) => h.name.toLowerCase(),
    qty: (h) => h.fig.qty,
    invested: (h) => h.fig.investedPaise,
    price: (h) => h.meta.price_paise ?? -1,
    today: (h) => h.fig.todayPaise ?? -Infinity,
    unrl: (h) => h.fig.unrealisedPaise ?? -Infinity,
    current: (h) => h.fig.currentPaise ?? h.fig.investedPaise,
  };
  const sorted = [...holdings].sort((a, b) => {
    const x = key[sort.k](a);
    const y = key[sort.k](b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.d;
  });
  const total = sumFigures(holdings.map((h) => h.fig));
  const th = (k: SortKey, a: string, b?: string) => (
    <th>
      <button
        className="sort"
        data-on={sort.k === k ? "" : undefined}
        onClick={() => setSort(sort.k === k ? { k, d: (sort.d * -1) as 1 | -1 } : { k, d: k === "name" ? 1 : -1 })}
      >
        {a}
        {b && <><br /><span style={k === "qty" ? { color: "var(--accent)", fontWeight: 500 } : undefined}>{b}</span></>}
        {sort.k === k ? (sort.d > 0 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <table>
      <thead>
        <tr>
          {th("name", "Asset")}
          {th("qty", "Qty.", "Avg. pur. price")}
          {th("invested", "Amt.", "Invested")}
          {th("price", "Current", "Price")}
          {th("today", "Today's", "Gain")}
          {th("unrl", "Unrealised", "Gain")}
          {th("current", "Current", "Value")}
        </tr>
      </thead>
      <tbody>
        {ASSET_CLASSES.filter((c) => sorted.some((h) => h.cls === c.code)).flatMap((c) => {
          const group = sorted.filter((h) => h.cls === c.code);
          const g = sumFigures(group.map((h) => h.fig));
          const isClosed = closed[c.code];
          const rows = [
            <tr className="grp" key={`g-${c.code}`}>
              <td>
                <button onClick={() => setClosed({ ...closed, [c.code]: !isClosed })} aria-expanded={!isClosed}>
                  <span className="caret">▸</span><code className="gcode">{c.chip}</code>{c.name} <span className="chip">{group.length}</span>
                </button>
              </td>
              <td />
              <td className="num">{rupees(g.investedPaise)}</td>
              <td />
              <td><TwoLine paise={g.todayPaise} percent={g.todayPct} /></td>
              <td><TwoLine paise={g.unrealisedPaise} percent={g.unrealisedPct} /></td>
              <td className="num">{g.currentPaise == null ? <span className="mut">—</span> : rupees(g.currentPaise)}</td>
            </tr>,
          ];
          if (isClosed) return rows;
          for (const h of group) {
            const isOpen = open[h.assetId];
            const bal = classInfo(h.cls).balance;
            rows.push(
              <tr className={`row${isOpen ? " open" : ""}`} key={h.assetId}>
                <td>
                  <button className="nm-btn" onClick={() => setOpen({ ...open, [h.assetId]: !isOpen })} aria-expanded={!!isOpen}>
                    <span className="caret">▸</span>
                    <span>
                      {h.name}
                      {combined && (
                        <span className="mut" style={{ fontSize: 11 }}>
                          {" "}· {h.owners.length > 1 ? `${h.owners.length} members` : portName(h.owners[0])}
                        </span>
                      )}
                      {h.warnings.length > 0 && <span className="loss" title={h.warnings.join("\n")}> ⚠</span>}
                    </span>
                  </button>
                </td>
                <td>
                  {bal ? <span className="mut">—</span> : (
                    <div className="two"><span className="num">{quantity(h.fig.qty)}</span><small className="num">{rupees(h.fig.avgPaise)}</small></div>
                  )}
                </td>
                <td className="num">{rupees(h.fig.investedPaise)}</td>
                <td className="num">
                  {bal ? (
                    h.meta.deposit ? <span className="mut" title="Worked out from the interest rate">auto</span> : (
                      <button className="pricebtn" title="Update the current value" onClick={() => onSetPrice(h)}>
                        {h.meta.value_paise != null ? "edit" : <span className="pricebtn set">Set value</span>}
                      </button>
                    )
                  ) : h.meta.price_paise != null ? (
                    <button className="pricebtn num" title="Update the price" onClick={() => onSetPrice(h)}>{rupees(h.meta.price_paise)}</button>
                  ) : (
                    <button className="pricebtn set" onClick={() => onSetPrice(h)}>Set price</button>
                  )}
                </td>
                <td><TwoLine paise={h.fig.todayPaise} percent={h.fig.todayPct} /></td>
                <td><TwoLine paise={h.fig.unrealisedPaise} percent={h.fig.unrealisedPct} /></td>
                <td className="num">{h.fig.currentPaise == null ? <span className="mut">—</span> : rupees(h.fig.currentPaise)}</td>
              </tr>,
            );
            if (isOpen)
              h.lots.forEach((l, i) => {
                const t = termOf(h.cls, l.date, asOf);
                rows.push(
                  <tr className="lot" key={`${h.assetId}-lot-${i}`}>
                    <td>
                      {dmy(l.date)}
                      {combined ? ` · ${portName(l.portfolioId)}` : ""} · {t.long ? "Long term" : "Short term"} ({t.days} days)
                    </td>
                    <td className="num">{bal ? "—" : quantity(l.qty)}</td>
                    <td className="num">{rupees(l.costPaise)}</td>
                    <td className="num">{bal ? "" : `@ ${rupees(l.costPaise / l.qty)}`}</td>
                    <td /><td /><td />
                  </tr>,
                );
              });
          }
          return rows;
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>NET WORTH</td>
          <td />
          <td className="num">{rupees(total.investedPaise)}</td>
          <td />
          <td><TwoLine paise={total.todayPaise} percent={total.todayPct} /></td>
          <td><TwoLine paise={total.unrealisedPaise} percent={total.unrealisedPct} /></td>
          <td className="num">{total.currentPaise == null ? <span className="mut">—</span> : rupees(total.currentPaise)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
