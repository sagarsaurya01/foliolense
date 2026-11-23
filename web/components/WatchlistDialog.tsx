"use client";

import { useEffect, useRef, useState } from "react";
import {
  addWatch, getWatchlist, removeWatch, searchStocks, setAlert, setAlertEmail,
  type StockHit, type WatchItem, type WatchlistData,
} from "@/app/watchlist-actions";
import { rupees } from "@/lib/format";
import { Modal, ModalHead } from "./Modal";

const pctTxt = (n: number | null) => (n == null || !isFinite(n) ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);
const tone = (n: number | null) => (n == null ? "" : n > 0.05 ? "gain" : n < -0.05 ? "loss" : "");
const dayMove = (i: WatchItem) => (i.closePaise != null && i.prevPaise != null ? i.closePaise - i.prevPaise : null);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dmy = (d: string) => { const [y, m, dd] = d.split("-"); return `${dd}-${MON[+m - 1]}`; };
const dirWord = (d: string | null) => (d === "up" ? "rises" : d === "down" ? "falls" : "moves up or down");

export function WatchlistDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<WatchlistData | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockHit[]>([]);
  const [emailOn, setEmailOn] = useState(false);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSaved = () => { setSaved(true); if (savedTimer.current) clearTimeout(savedTimer.current); savedTimer.current = setTimeout(() => setSaved(false), 1600); };

  const load = () => getWatchlist().then((d) => { setData(d); setEmailOn(d.emailOn); setEmail(d.email ?? ""); });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => searchStocks(q).then(setHits), 250);
    return () => clearTimeout(t);
  }, [q]);

  const items = data?.items ?? [];
  const held = new Set(items.map((i) => i.nse_symbol));

  const patchLocal = (id: string, patch: Partial<WatchItem>) =>
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : d));

  // Merge one change into the item and persist the FULL alert — correct no matter the field order
  // (fixes the ₹/% switch saving the wrong value).
  const persist = (it: WatchItem, patch: Partial<WatchItem>) => {
    const next = { ...it, ...patch };
    patchLocal(it.id, patch);
    setAlert(it.id, { dir: next.alertDir, amountPaise: next.alertAmountPaise, pct: next.alertPct, active: next.alertActive });
    flashSaved();
  };

  const add = async (s: StockHit) => { await addWatch(s); setQ(""); setHits([]); load(); flashSaved(); };
  const remove = async (id: string) => { patchLocal(id, {}); setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d)); await removeWatch(id); };

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Watchlist & alerts" extra={saved ? <span className="gain" style={{ fontSize: 13, fontWeight: 600 }}>✓ Saved</span> : <div className="mut" style={{ fontSize: 13 }}>Changes save automatically — no button needed</div>} onClose={onClose} />
      <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* add */}
        <div style={{ position: "relative" }}>
          <label className="asearch" style={{ width: "100%", background: "var(--surface)" }}>
            <input placeholder="Add a stock — type a name or symbol…" aria-label="Add a stock" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {hits.length > 0 && (
            <div style={{ position: "absolute", zIndex: 5, left: 0, right: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, maxHeight: 240, overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
              {hits.map((h) => (
                <button key={h.nse_symbol} className="it" disabled={held.has(h.nse_symbol)} style={{ width: "100%", textAlign: "left", justifyContent: "flex-start", opacity: held.has(h.nse_symbol) ? 0.5 : 1 }} onClick={() => add(h)}>
                  <b>{h.nse_symbol}</b> <span className="mut" style={{ fontSize: 12, marginLeft: 6 }}>{h.name}</span>{held.has(h.nse_symbol) && <span className="mut" style={{ fontSize: 11, marginLeft: 6 }}>· added</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* list */}
        {!data ? <div className="mut" style={{ fontSize: 13, padding: 10 }}>Loading…</div>
          : !items.length ? <div className="mut" style={{ fontSize: 13, padding: 10 }}>No stocks yet — add a few above. Prices are the daily close; alerts are checked each evening after the market update.</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it) => {
                const mv = dayMove(it);
                const mvPct = mv != null && it.prevPaise ? (mv / it.prevPaise) * 100 : null;
                const mode: "amount" | "pct" = it.alertPct != null ? "pct" : "amount";
                const triggeredToday = it.lastAlertDate && it.priceDate && it.lastAlertDate === it.priceDate;
                return (
                  <div key={it.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14 }}>{it.nse_symbol}</b>
                      <span className="mut" style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      {it.closePaise != null ? (
                        <span className="num" style={{ fontSize: 13 }}>{rupees(it.closePaise)}
                          {mv != null && <span className={`num ${tone(mvPct)}`} style={{ marginLeft: 6, fontSize: 12 }}>{pctTxt(mvPct)}</span>}
                        </span>
                      ) : <span className="mut" style={{ fontSize: 12 }}>no price yet</span>}
                      {triggeredToday && <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>alerted {it.lastAlertKind === "up" ? "↑" : "↓"}</span>}
                      <button className="link" style={{ fontSize: 12 }} onClick={() => remove(it.id)}>Remove</button>
                    </div>

                    {/* alert row — every change saves itself */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                        <input type="checkbox" checked={it.alertActive && !!it.alertDir} onChange={(e) => { const on = e.target.checked; persist(it, { alertActive: on, alertDir: on && !it.alertDir ? "both" : it.alertDir }); }} />
                        Alert me
                      </label>
                      <select value={it.alertDir ?? "both"} onChange={(e) => persist(it, { alertDir: e.target.value as WatchItem["alertDir"] })}
                        style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 7, color: "var(--fg)", fontSize: 12.5, padding: "5px 7px" }}>
                        <option value="up">moves up</option>
                        <option value="down">moves down</option>
                        <option value="both">moves either way</option>
                      </select>
                      <span className="mut" style={{ fontSize: 12.5 }}>by</span>
                      <input type="number" inputMode="decimal" min="0" placeholder="0"
                        value={mode === "pct" ? (it.alertPct ?? "") : (it.alertAmountPaise != null ? it.alertAmountPaise / 100 : "")}
                        onChange={(e) => { const v = e.target.value === "" ? null : Math.abs(+e.target.value);
                          patchLocal(it.id, mode === "pct" ? { alertPct: v, alertAmountPaise: null } : { alertAmountPaise: v != null ? Math.round(v * 100) : null, alertPct: null }); }}
                        onBlur={(e) => { const v = e.target.value === "" ? null : Math.abs(+e.target.value);
                          persist(it, mode === "pct" ? { alertPct: v, alertAmountPaise: null } : { alertAmountPaise: v != null ? Math.round(v * 100) : null, alertPct: null }); }}
                        style={{ width: 84, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 7, color: "var(--fg)", fontSize: 12.5, padding: "5px 7px" }} />
                      <select value={mode} onChange={(e) => { const m = e.target.value as "amount" | "pct";
                          persist(it, m === "pct"
                            ? { alertPct: it.alertAmountPaise != null ? +(it.alertAmountPaise / 100).toFixed(2) : it.alertPct, alertAmountPaise: null }
                            : { alertAmountPaise: it.alertPct != null ? Math.round(it.alertPct * 100) : it.alertAmountPaise, alertPct: null }); }}
                        style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 7, color: "var(--fg)", fontSize: 12.5, padding: "5px 7px" }}>
                        <option value="amount">₹</option>
                        <option value="pct">%</option>
                      </select>
                    </div>

                    {it.alertActive && it.alertDir && (it.alertAmountPaise != null || it.alertPct != null) && (
                      <div style={{ marginTop: 7, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--accent)" }}>🔔</span>
                        <span className="mut">Alert set — you&apos;ll be notified if <b style={{ color: "var(--fg)" }}>{it.nse_symbol}</b> {dirWord(it.alertDir)} by <b style={{ color: "var(--fg)" }}>{it.alertPct != null ? `${it.alertPct}%` : rupees(it.alertAmountPaise!)}</b> in a day.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* email digest */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={emailOn} onChange={(e) => { setEmailOn(e.target.checked); setAlertEmail(e.target.checked, email || null); flashSaved(); }} /> Email me a daily digest of triggers
          </label>
          <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { setAlertEmail(emailOn, email || null); flashSaved(); }}
            style={{ flex: 1, minWidth: 180, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 7, color: "var(--fg)", fontSize: 13, padding: "7px 9px" }} />
        </div>
        <p className="mut" style={{ fontSize: 11, margin: 0 }}>Alerts compare each evening&apos;s close to the previous close and fire once per stock per day. Email delivery turns on once it&apos;s wired on the server (I&apos;ll confirm).</p>

        {/* recent */}
        {data && data.recent.length > 0 && (
          <div>
            <div className="mut" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Recent alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.recent.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 12.5 }}>
                  <span className="mut num" style={{ width: 54 }}>{dmy(a.priceDate)}</span>
                  <b style={{ width: 90 }}>{a.nse_symbol}</b>
                  <span className={a.kind === "up" ? "gain" : "loss"}>{a.kind === "up" ? "▲" : "▼"} {rupees(a.movePaise)} {a.movePct != null && `(${pctTxt(a.movePct)})`}</span>
                  <span className="mut num">→ {rupees(a.pricePaise)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
