"use client";

import { useState, useTransition } from "react";
import { deleteTransaction } from "@/app/tx-actions";
import { ASSET_CLASSES, classInfo } from "@/lib/assetClasses";
import { quantity, rupees } from "@/lib/format";
import type { TxRow } from "@/lib/holdings";
import { Modal, ModalHead } from "./Modal";

const TYPE_LABEL: Record<string, string> = {
  buy: "Buy", sell: "Sell", deposit: "Deposit", withdraw: "Withdraw", dividend: "Dividend", interest: "Interest",
  bonus: "Bonus", split: "Split", opening: "Opening", merge_in: "Merger in", merge_out: "Merger out", charges: "Charges",
};

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function TxList({
  rows,
  title,
  portName,
  onEdit,
  onClose,
  say,
}: {
  rows: TxRow[];
  title: string;
  portName: (id: string) => string;
  onEdit: (t: TxRow) => void;
  onClose: () => void;
  say: (m: string) => void;
}) {
  const [cls, setCls] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const shown = rows
    .filter(
      (t) =>
        (!cls || t.asset.asset_class === cls) &&
        (!from || t.trade_date >= from) &&
        (!to || t.trade_date <= to) &&
        (!q || t.asset.name.toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) => b.trade_date.localeCompare(a.trade_date));
  const total = shown.reduce((s, t) => s + Number(t.amount_paise), 0);

  const exportCsv = () => {
    const head = ["Date", "Portfolio", "Asset class", "Asset", "Type", "Qty", "Price", "Amount", "Charges", "Notes"];
    const body = shown.map((t) => {
      const bal = classInfo(t.asset.asset_class).balance;
      return [
        t.trade_date, portName(t.portfolio_id), classInfo(t.asset.asset_class).name, t.asset.name, TYPE_LABEL[t.type] ?? t.type,
        bal ? "" : Number(t.quantity), bal ? "" : (Number(t.price_paise) / 100).toFixed(2),
        (Number(t.amount_paise) / 100).toFixed(2), (Number(t.charges_paise) / 100).toFixed(2), t.notes ?? "",
      ];
    });
    // BOM so Excel opens the ₹ and names correctly
    const csv = "﻿" + [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `transactions-${title.replace(/\W+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    say(`Exported ${shown.length} transactions`);
  };

  const remove = (id: string) =>
    start(async () => {
      setError("");
      const r = await deleteTransaction(id);
      setConfirm(null);
      if (r.error) setError(r.error);
      else say("Transaction deleted");
    });

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="All Transactions" extra={<div className="mut" style={{ fontSize: 13 }}>{title}</div>} onClose={onClose} />
      <div className="mbody">
        <div className="vfilters">
          <label className="field">
            Asset class
            <select id="vfClass" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">All</option>
              {ASSET_CLASSES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">From<input id="vfFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field">To<input id="vfTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field" style={{ flex: 1, minWidth: 160 }}>Asset<input id="vfQ" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button className="btn" onClick={() => { setCls(""); setFrom(""); setTo(""); setQ(""); }}>Clear filters</button>
          <button className="btn primary" onClick={exportCsv} disabled={!shown.length}>Export to CSV</button>
        </div>
        {error && <div className="warn loss">{error}</div>}
        <div className="tbox" style={{ maxHeight: "55vh" }}>
          {shown.length ? (
            <table>
              <thead>
                <tr><th>Date</th><th>Portfolio</th><th>Asset</th><th>Type</th><th>Qty</th><th>Price</th><th>Amount</th><th>Charges</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const bal = classInfo(t.asset.asset_class).balance;
                  return (
                    <tr className="row" key={t.id}>
                      <td>{t.trade_date.split("-").reverse().join("-")}</td>
                      <td>{portName(t.portfolio_id)}</td>
                      <td style={{ whiteSpace: "normal", textAlign: "left" }}>
                        {t.asset.name} <code className="gcode">{classInfo(t.asset.asset_class).chip}</code>
                      </td>
                      <td style={{ textAlign: "left" }}>{TYPE_LABEL[t.type] ?? t.type}</td>
                      <td className="num">{bal || t.type === "dividend" ? "—" : t.type === "split" ? `×${Number(t.quantity)}` : quantity(Number(t.quantity))}</td>
                      <td className="num">{bal || ["bonus", "split", "dividend"].includes(t.type) ? "—" : rupees(Number(t.price_paise))}</td>
                      <td className="num">{rupees(Number(t.amount_paise))}</td>
                      <td className="num">{Number(t.charges_paise) ? rupees(Number(t.charges_paise)) : ""}</td>
                      <td>
                        {confirm === t.id ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button className="btn" style={{ borderColor: "var(--loss)", color: "var(--loss)" }} disabled={pending} onClick={() => remove(t.id)}>Delete</button>
                            <button className="btn" onClick={() => setConfirm(null)}>Keep</button>
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button className="btn" onClick={() => onEdit(t)}>Edit</button>
                            <button className="btn" onClick={() => setConfirm(t.id)} aria-label="Delete transaction">✕</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td>{shown.length} transactions</td><td /><td /><td /><td /><td /><td className="num">{rupees(total)}</td><td /><td /></tr>
              </tfoot>
            </table>
          ) : (
            <div className="empty">No transactions match these filters.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
