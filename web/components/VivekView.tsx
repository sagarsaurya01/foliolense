"use client";

import { useEffect, useState } from "react";
import { vivekVerdicts } from "@/app/vivek-actions";
import type { Verdict, VivekVerdict } from "@/lib/vivek";

const TONE: Record<Verdict, "red" | "amber" | "green" | "mut"> = {
  exit: "red", sell: "red", trim: "amber", hold: "mut", add: "green", buy: "green",
};
const ORDER: Record<Verdict, number> = { exit: 0, sell: 1, trim: 2, hold: 3, add: 4, buy: 5 };
const num = (n: number | null, suffix = "") => (n == null ? "—" : `${n.toFixed(n >= 100 ? 0 : 1)}${suffix}`);

export function VivekView({ items, title }: { items: { isin: string; name: string }[]; title: string }) {
  const [loading, setLoading] = useState(true);
  const [verdicts, setVerdicts] = useState<VivekVerdict[]>([]);
  const key = items.map((i) => i.isin).join(",");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    vivekVerdicts(items)
      .then((v) => alive && setVerdicts(v))
      .catch(() => alive && setVerdicts([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sorted = [...verdicts].sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
  const toBook = sorted.filter((v) => v.verdict === "exit" || v.verdict === "sell" || v.verdict === "trim");
  const count = (vs: Verdict[]) => verdicts.filter((v) => vs.includes(v.verdict)).length;

  return (
    <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
      <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>Vivek Bajaj view</div>
      <h2 style={{ fontSize: 23, fontWeight: 600, margin: "3px 0 2px" }}>What would he do with your stocks?</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 14 }}>{title} · his data-based momentum &amp; relative-strength method, applied to your holdings. Signals, not advice.</p>

      {loading ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>Reading 18 months of prices and running the signals…</div></div>
      ) : !verdicts.length ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>No price history yet for these stocks. The daily feed fills it in.</div></div>
      ) : (
        <>
          <div className="demo-lens-summary">
            <span className="ls-pill red">{count(["exit", "sell"])} to book/exit</span>
            <span className="ls-pill amber">{count(["trim"])} to trim</span>
            <span className="ls-pill green">{count(["add", "buy"])} to add</span>
          </div>

          {toBook.length > 0 && (
            <div className="demo-card" style={{ borderColor: "var(--loss)" }}>
              <div className="demo-card-head">The sell discipline — what he'd book or exit now</div>
              {toBook.map((v) => (
                <div key={v.isin} className="demo-line">
                  <span>{v.symbol || v.name}<small> {v.headline}</small></span>
                  <b className={`num ${TONE[v.verdict] === "red" ? "loss" : "num"}`} style={{ color: TONE[v.verdict] === "red" ? "var(--loss)" : "var(--accent)" }}>{v.headline}</b>
                </div>
              ))}
              <p className="demo-note" style={{ marginTop: 10 }}>&ldquo;You know how to buy, not how to sell&rdquo; — profit only comes home when you book it.</p>
            </div>
          )}

          <div className="demo-lenses">
            {sorted.map((v) => (
              <div className={`demo-lens s-${TONE[v.verdict]}`} key={v.isin}>
                <div className="demo-lens-top">
                  <span className="demo-lens-dot" />
                  <div>
                    <b>{v.symbol || v.name}</b>
                    <p className="mut small">{v.name}</p>
                  </div>
                  <span className={`demo-lens-tag t-${TONE[v.verdict]}`}>{v.headline}</span>
                </div>
                <div className="demo-lens-metric">
                  RS {num(v.signals.rs6mPct, "%")} vs Nifty · {v.signals.close > (v.signals.dma200 ?? 0) ? "above" : "below"} 200-DMA · delivery {num(v.signals.delivAvg, "%")}
                </div>
                <p className="demo-lens-reason">{v.reason}</p>
              </div>
            ))}
          </div>

          <p className="demo-tone">
            Based on Vivek Bajaj&apos;s public method (relative strength, 50/200-day trend, RSI, delivery, the Nifty 200-DMA regime). Thresholds are tunable; this is analysis of your own data, not a recommendation to buy or sell any security.
          </p>
        </>
      )}
    </div>
  );
}
