"use client";

import { useState, useTransition } from "react";
import { importTransactions, undoImport, type ImportRow, type TieOut } from "@/app/import-actions";
import { classInfo } from "@/lib/assetClasses";
import { quantity, rupees } from "@/lib/format";
import { parseTradebook } from "@/lib/tradebook";
import { Modal, ModalHead } from "./Modal";

type Port = { id: string; name: string };
export type ImportLogRow = { id: string; template: string; file_name: string; status: string; stats: { added?: number; skipped?: number } | null; created_at: string };

const TEMPLATES = [
  { id: "zerodha_tb", name: "Zerodha / broker tradebook", kind: "csv", fmt: "CSV / Excel", hint: "Zerodha Console → Reports → Tradebook → download. Anand Rathi / Groww trade sheets work too." },
  { id: "zerodha_cn", name: "Broker contract note (Zerodha / Anand Rathi)", kind: "pdf", fmt: "PDF", endpoint: "contractnote", hint: "The original equity contract-note PDF your broker emails you — no password. (F&O notes come in Phase 5.)" },
  { id: "cas", name: "Mutual Fund CAS (CAMS / KFintech)", kind: "pdf", fmt: "PDF", pw: true, hint: "Request a DETAILED statement from camsonline.com; it is emailed to you." },
  { id: "ecas", name: "Demat e-CAS (NSDL / CDSL)", kind: "pdf", fmt: "PDF", pw: true, hint: "The monthly e-CAS emailed by NSDL/CDSL. Loads holdings (no purchase history)." },
];

async function sha256(buf: ArrayBuffer): Promise<string> {
  try {
    const h = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8000";

export function ImportWizard({
  portfolios,
  defaultPortfolio,
  log,
  onClose,
  onDone,
}: {
  portfolios: Port[];
  defaultPortfolio?: string;
  log: ImportLogRow[];
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [tab, setTab] = useState<"new" | "log">("new");
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [portfolioId, setPortfolio] = useState(defaultPortfolio ?? portfolios[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<{ name: string; buf: ArrayBuffer } | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [tieouts, setTieouts] = useState<TieOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  const pickFile = async (f: File) => {
    setError("");
    setRows(null);
    setResult(null);
    const buf = await f.arrayBuffer();
    setFile({ name: f.name, buf });
  };

  const parse = async () => {
    if (!file) return setError("Choose a file first.");
    setBusy(true);
    setError("");
    try {
      if (tpl.kind === "csv") {
        const out = parseTradebook(file.buf);
        if (out.error) setError(out.error);
        else if (!out.rows.length) setError("No buy/sell rows found in this file.");
        else setRows(out.rows);
      } else if ("endpoint" in tpl && tpl.endpoint === "contractnote") {
        const fd = new FormData();
        fd.append("file", new Blob([file.buf]), file.name);
        const res = await fetch(`${WORKER}/parse/contractnote`, { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || `Parser error (${res.status}). Is the worker running?`);
        }
        const d = await res.json();
        setRows(d.rows as ImportRow[]);
      } else {
        const fd = new FormData();
        fd.append("file", new Blob([file.buf]), file.name);
        fd.append("password", password);
        fd.append("kind", tpl.id === "ecas" ? "ecas" : "cas");
        const res = await fetch(`${WORKER}/parse/cas`, { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || `Parser error (${res.status}). Is the worker running?`);
        }
        const d = await res.json();
        if (d.mode === "holdings") {
          setError("This is a holdings statement (e-CAS). Use it in Reconcile Holdings — it has no purchase history to import as transactions.");
        } else {
          setRows(d.rows as ImportRow[]);
          setTieouts((d.tieouts as TieOut[]) ?? []);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    start(async () => {
      const sha = await sha256(file!.buf);
      const r = await importTransactions(portfolioId, tpl.name, file!.name, sha, rows!);
      if (r.error) setError(r.error);
      else setResult({ added: r.added ?? 0, skipped: r.skipped ?? 0 });
    });

  // tie-out on units: a scheme matches when its closing balance equals units rebuilt from the file
  const matched = tieouts.filter((t) => Math.abs(t.close_units - t.built_units) <= 0.001);
  const partial = tieouts.filter((t) => t.built_units + 0.001 < t.close_units); // older units before this statement
  const over = tieouts.filter((t) => t.built_units - 0.001 > t.close_units); // rebuilt more than held — a real problem

  return (
    <Modal wide onClose={onClose}>
      <ModalHead
        title="Import"
        extra={
          <>
            <button className="tabb" aria-pressed={tab === "new"} onClick={() => setTab("new")} style={{ padding: "0 18px", background: "none", border: 0, borderRight: "1px solid var(--line)", fontWeight: 600 }}>New import</button>
            <button className="tabb" aria-pressed={tab === "log"} onClick={() => setTab("log")} style={{ padding: "0 18px", background: "none", border: 0, borderRight: "1px solid var(--line)", fontWeight: 600 }}>Import log{log.length ? ` (${log.length})` : ""}</button>
          </>
        }
        onClose={onClose}
      />
      <div className="mbody">
        {tab === "log" ? (
          <ImportLog log={log} onUndo={onDone} />
        ) : result ? (
          <div className="dlg" style={{ padding: 0 }}>
            <b style={{ fontSize: 16 }}>Import complete</b>
            <span>{result.added} transaction{result.added === 1 ? "" : "s"} added to <b>{portfolios.find((p) => p.id === portfolioId)?.name}</b>{result.skipped ? `, ${result.skipped} already imported (skipped).` : "."}</span>
            <div className="row-end">
              <button className="btn" onClick={() => { setResult(null); setRows(null); setFile(null); }}>Import another</button>
              <button className="btn primary" onClick={() => onDone(`${result.added} imported`)}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              <span className="label">1. What are you importing?</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TEMPLATES.map((t) => (
                  <button key={t.id} className={`btn${tpl.id === t.id ? " dark" : ""}`} onClick={() => { setTpl(t); setRows(null); }}>
                    {t.name} <span className="chip">{t.fmt}</span>
                  </button>
                ))}
              </div>
              <span className="note">{tpl.hint}</span>
            </div>
            <div className="grid2">
              <label className="field">
                2. Into portfolio
                <select value={portfolioId} onChange={(e) => setPortfolio(e.target.value)}>
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {tpl.pw && (
                <label className="field">
                  PDF password
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="usually your PAN" />
                </label>
              )}
            </div>
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void pickFile(f); }}>
              <span className="btn">Choose file</span>
              <span className="mut" style={{ fontSize: 13 }}>{file?.name || `or drop the ${tpl.fmt} here`}</span>
              <input type="file" hidden accept={tpl.kind === "csv" ? ".csv,.xlsx,.xls" : ".pdf"} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }} />
            </label>
            {file && !rows && <div className="row-end"><button className="btn primary" onClick={parse} disabled={busy}>{busy ? "Reading…" : "Read file"}</button></div>}
            {error && <div className="warn loss">{error}</div>}
            {rows && (
              <>
                {tieouts.length > 0 && (
                  <div className={`warn${over.length ? " loss" : ""}`}>
                    {over.length > 0 ? (
                      <>Check: {over.length} fund{over.length === 1 ? "" : "s"} rebuild to more units than the closing balance — the statement may be incomplete.</>
                    ) : partial.length > 0 ? (
                      <>Tie-out: {matched.length} of {tieouts.length} funds match their closing balance exactly ✓. {partial.length} hold units bought before this statement&apos;s start date, so their <b>cost will be partial</b> — import a CAS from inception for full cost.</>
                    ) : (
                      <>Tie-out ✓ — all {tieouts.length} funds match their closing balance; full history captured.</>
                    )}
                  </div>
                )}
                <div className="note">{rows.length} rows read. New assets are created and linked to live prices by ISIN. Rows already imported are skipped.</div>
                <div className="tbox" style={{ maxHeight: "40vh" }}>
                  <table>
                    <thead><tr><th>Date</th><th>Asset</th><th>Type</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
                    <tbody>
                      {rows.slice(0, 300).map((r, i) => (
                        <tr className="row" key={i}>
                          <td>{r.date.split("-").reverse().join("-")}</td>
                          <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.name} {r.isin && <code className="gcode">{r.isin}</code>}</td>
                          <td>{r.type}</td>
                          <td className="num">{classInfo(r.cls ?? "EQ").balance ? "—" : quantity(r.units)}</td>
                          <td className="num">{rupees(r.nav_paise)}</td>
                          <td className="num">{rupees(r.amount_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 300 && <span className="note">Showing the first 300 of {rows.length}.</span>}
                <div className="row-end">
                  <button className="btn" onClick={() => { setRows(null); setFile(null); }}>Back</button>
                  <button className="btn primary" onClick={confirm} disabled={pending}>{pending ? "Importing…" : `Import ${rows.length} rows`}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ImportLog({ log, onUndo }: { log: ImportLogRow[]; onUndo: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!log.length) return <div className="empty">No imports yet.</div>;
  return (
    <div className="log">
      {log.map((l) => (
        <div key={l.id}>
          <b>{l.file_name}</b>
          <span className="mut">{l.template} · {new Date(l.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span className={l.status === "undone" ? "mut" : ""}>
              {l.status === "undone" ? "Undone" : `${l.stats?.added ?? 0} imported${l.stats?.skipped ? `, ${l.stats.skipped} skipped` : ""}`}
            </span>
            {l.status === "completed" && (busy === l.id ? (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button className="btn" style={{ borderColor: "var(--loss)", color: "var(--loss)" }} disabled={pending} onClick={() => start(async () => { const r = await undoImport(l.id); setBusy(null); onUndo(r.error ?? `Removed ${r.removed} transactions`); })}>Undo import</button>
                <button className="btn" onClick={() => setBusy(null)}>Keep</button>
              </span>
            ) : (
              <button className="btn" onClick={() => setBusy(l.id)}>Undo…</button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
