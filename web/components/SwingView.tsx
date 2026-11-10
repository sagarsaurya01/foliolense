"use client";

import { useEffect, useState } from "react";
import { swingSignals } from "@/app/swing-actions";
import type { SwingSignal, SwingStatus } from "@/lib/swing";

const TONE: Record<SwingStatus, "green" | "amber" | "red" | "mut"> = {
  breakout: "green", watch: "amber", hold: "mut", avoid: "red",
};
const ORDER: Record<SwingStatus, number> = { breakout: 0, watch: 1, hold: 2, avoid: 3 };
const rupee = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

export function SwingView({ items, title }: { items: { isin: string; name: string }[]; title: string }) {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<SwingSignal[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (isin: string) =>
    setOpen((s) => { const n = new Set(s); if (n.has(isin)) n.delete(isin); else n.add(isin); return n; });
  const key = items.map((i) => i.isin).join(",");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    swingSignals(items)
      .then((v) => alive && setSignals(v))
      .catch(() => alive && setSignals([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sorted = [...signals].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (s: SwingStatus) => signals.filter((v) => v.status === s).length;

  return (
    <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
      <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>Swing trading</div>
      <h2 style={{ fontSize: 23, fontWeight: 600, margin: "3px 0 2px" }}>Short-term trade setups</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 14 }}>{title} · 2–5 day swings from daily price action — breakout, trend and ATR-based stops. Signals, not advice.</p>

      {loading ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>Scanning the daily charts for setups…</div></div>
      ) : !signals.length ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>No price history yet for these stocks.</div></div>
      ) : (
        <>
          <div className="demo-lens-summary">
            <span className="ls-pill green">{count("breakout")} breakout</span>
            <span className="ls-pill amber">{count("watch")} to watch</span>
            <span className="ls-pill red">{count("avoid")} avoid</span>
          </div>

          <p className="mut small" style={{ margin: "14px 0 6px" }}>Tap any stock for its entry, stop and target.</p>
          <div className="demo-lenses">
            {sorted.map((v) => {
              const isOpen = open.has(v.isin);
              return (
                <div className={`demo-lens s-${TONE[v.status]}`} key={v.isin}>
                  <button
                    type="button"
                    className="demo-lens-top"
                    onClick={() => toggleOpen(v.isin)}
                    aria-expanded={isOpen}
                    style={{ width: "100%", background: "none", border: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", padding: 0 }}
                  >
                    <span className="demo-lens-dot" />
                    <div style={{ flex: 1 }}>
                      <b>{v.symbol || v.name}</b>
                      <p className="mut small">{v.name}</p>
                    </div>
                    <span className={`demo-lens-tag t-${TONE[v.status]}`}>{v.headline}</span>
                    <span className="mut" style={{ marginLeft: 8, fontSize: 12 }} aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      {(v.entry != null || v.stop != null || v.target != null) && (
                        <div className="demo-lens-metric">
                          {v.entry != null && <>Entry {rupee(v.entry)} · </>}Stop {rupee(v.stop)}{v.target != null && <> · Target {rupee(v.target)}</>}{v.rr != null && <> · {v.rr}:1</>}
                        </div>
                      )}
                      <p className="demo-lens-reason">{v.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="demo-tone">
            Swing setups from daily price action (20-day breakout, 20-day trend, ATR stops). This is analysis of price data, not a recommendation to buy or sell — place and manage every trade yourself.
          </p>
        </>
      )}
    </div>
  );
}
