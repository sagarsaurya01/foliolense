"use client";

import { useEffect, useState } from "react";
import { swingScan } from "@/app/swing-actions";
import type { SwingSignal, SwingStatus } from "@/lib/swing";

const TONE: Record<SwingStatus, "green" | "amber" | "red" | "mut"> = {
  breakout: "green", watch: "amber", hold: "mut", avoid: "red",
};
const rupee = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

export function SwingView({ heldIsins }: { heldIsins: string[] }) {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<SwingSignal[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (isin: string) =>
    setOpen((s) => { const n = new Set(s); if (n.has(isin)) n.delete(isin); else n.add(isin); return n; });
  const key = heldIsins.join(",");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    swingScan(heldIsins)
      .then((v) => alive && setSignals(v))
      .catch(() => alive && setSignals([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const breakout = signals.filter((s) => s.status === "breakout").length;
  const watch = signals.filter((s) => s.status === "watch").length;

  return (
    <div className="demo-owner" style={{ padding: "4px 2px 8px" }}>
      <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>Swing trading</div>
      <h2 style={{ fontSize: 23, fontWeight: 600, margin: "3px 0 2px" }}>Today&apos;s swing setups</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 14 }}>Scanning the ~220 F&amp;O stocks for 2–5 day setups — excluding what you already hold. Breakout, trend and ATR stops. Signals, not advice.</p>

      {loading ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>Scanning the F&amp;O universe for breakouts…</div></div>
      ) : !signals.length ? (
        <div className="demo-card"><div className="mut" style={{ fontSize: 13 }}>No fresh setups right now (or the F&amp;O history is still loading). Check back after market close.</div></div>
      ) : (
        <>
          <div className="demo-lens-summary">
            <span className="ls-pill green">{breakout} breakout today</span>
            <span className="ls-pill amber">{watch} setting up</span>
          </div>

          <p className="mut small" style={{ margin: "14px 0 6px" }}>Tap any stock for its entry, stop and target.</p>
          <div className="demo-lenses">
            {signals.map((v) => {
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
                      <b>{v.symbol}</b>
                      <p className="mut small">{rupee(v.close)}{v.target != null && <> · target {rupee(v.target)}</>}</p>
                    </div>
                    <span className={`demo-lens-tag t-${TONE[v.status]}`}>{v.headline}</span>
                    <span className="mut" style={{ marginLeft: 8, fontSize: 12 }} aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      <div className="demo-lens-metric">
                        {v.entry != null && <>Entry {rupee(v.entry)} · </>}Stop {rupee(v.stop)}{v.target != null && <> · Target {rupee(v.target)}</>}{v.rr != null && <> · {v.rr}:1</>}
                      </div>
                      <p className="demo-lens-reason">{v.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="demo-tone">
            A scan of the F&amp;O universe for 20-day breakouts with ATR-based stops — these are *new* trade ideas, not your holdings. Analysis of price data, not a recommendation; place and manage every trade yourself.
          </p>
        </>
      )}
    </div>
  );
}
