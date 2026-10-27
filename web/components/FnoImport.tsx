"use client";

import { useState, useTransition } from "react";
import { importFnoTrades, type FnoTradeInput } from "@/app/fno-actions";
import { contractLabel } from "@/lib/calc/fno";
import { rupees } from "@/lib/format";
import { Modal, ModalHead } from "./Modal";

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8000";

export function FnoImport({ portfolioId, portfolioName, onClose, onDone }: { portfolioId: string; portfolioName: string; onClose: () => void; onDone: (m: string) => void }) {
  const [file, setFile] = useState<{ name: string; buf: ArrayBuffer } | null>(null);
  const [trades, setTrades] = useState<FnoTradeInput[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  const read = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", new Blob([file.buf]), file.name);
      const res = await fetch(`${WORKER}/parse/fno`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Parser error (${res.status}). Is the worker running?`);
      }
      const d = await res.json();
      setTrades(d.trades as FnoTradeInput[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    start(async () => {
      const r = await importFnoTrades(portfolioId, "F&O contract note", file!.name, trades!);
      if (r.error) setError(r.error);
      else setResult({ added: r.added ?? 0, skipped: r.skipped ?? 0 });
    });

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Import F&O contract note" extra={<div className="mut" style={{ fontSize: 13 }}>{portfolioName}</div>} onClose={onClose} />
      <div className="mbody">
        {result ? (
          <div className="dlg" style={{ padding: 0 }}>
            <b style={{ fontSize: 16 }}>Imported</b>
            <span>{result.added} F&amp;O trade{result.added === 1 ? "" : "s"} added{result.skipped ? `, ${result.skipped} already imported.` : "."}</span>
            <div className="row-end"><button className="btn primary" onClick={() => onDone(`${result.added} F&O trades imported`)}>Done</button></div>
          </div>
        ) : (
          <>
            <span className="note">The original F&amp;O (futures/options) contract-note PDF from Zerodha or Anand Rathi — no password.</span>
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void f.arrayBuffer().then((buf) => { setFile({ name: f.name, buf }); setTrades(null); setResult(null); }); }}>
              <span className="btn">Choose file</span>
              <span className="mut" style={{ fontSize: 13 }}>{file?.name || "or drop the PDF here"}</span>
              <input type="file" hidden accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.arrayBuffer().then((buf) => { setFile({ name: f.name, buf }); setTrades(null); }); }} />
            </label>
            {file && !trades && <div className="row-end"><button className="btn primary" onClick={read} disabled={busy}>{busy ? "Reading…" : "Read file"}</button></div>}
            {error && <div className="warn loss">{error}</div>}
            {trades && (
              <>
                <div className="note">{trades.length} F&amp;O trades read.</div>
                <div className="tbox" style={{ maxHeight: "44vh" }}>
                  <table>
                    <thead><tr><th>Date</th><th>Contract</th><th>Side</th><th>Qty</th><th>Price</th></tr></thead>
                    <tbody>
                      {trades.slice(0, 300).map((t, i) => (
                        <tr className="row" key={i}>
                          <td>{t.date.split("-").reverse().join("-")}</td>
                          <td style={{ textAlign: "left" }}>{contractLabel({ underlying: t.underlying, instrument: t.instrument, expiry: t.expiry, strikePaise: t.strike_paise ?? undefined })}</td>
                          <td>{t.side}</td>
                          <td className="num">{t.quantity}</td>
                          <td className="num">{rupees(t.price_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row-end">
                  <button className="btn" onClick={() => { setTrades(null); setFile(null); }}>Back</button>
                  <button className="btn primary" onClick={confirm} disabled={pending}>{pending ? "Importing…" : `Import ${trades.length} trades`}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
