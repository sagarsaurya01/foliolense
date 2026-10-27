"use client";

import { useMemo, useState } from "react";
import { classInfo } from "@/lib/assetClasses";
import { LTCG_EQUITY_EXEMPT_PAISE } from "@/lib/calc/gains";
import { quantity, rupees } from "@/lib/format";
import type { TxRow } from "@/lib/holdings";
import { allRealisedGains, gainsSummary, holdingsAsOn, incomeRows, registerRows } from "@/lib/reports";
import { Modal, ModalHead } from "./Modal";

type Cat = "Capital Gains" | "Performance" | "Income" | "Transactions" | "Tax Formats";
const CATS: Cat[] = ["Capital Gains", "Performance", "Income", "Transactions", "Tax Formats"];
const REPORTS: Record<Cat, { id: string; name: string; period?: "fy" | "date" }[]> = {
  "Capital Gains": [
    { id: "realised", name: "Realised capital gains (FIFO)", period: "fy" },
    { id: "cg_summary", name: "Capital gains summary (all years)" },
  ],
  Performance: [{ id: "holdings_on", name: "Holdings as on a date", period: "date" }],
  Income: [{ id: "income", name: "Dividends & interest", period: "fy" }],
  Transactions: [{ id: "register", name: "Transaction register" }],
  "Tax Formats": [{ id: "112a", name: "Schedule 112A (long-term equity, CSV)", period: "fy" }],
};

const FYS = ["2026-27", "2025-26", "2024-25", "2023-24", "2022-23"];
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function csvDownload(name: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const dmy = (d: string) => d.split("-").reverse().join("-");
const money = (p: number) => <span className={`num ${p >= 0 ? "gain" : "loss"}`}>{rupees(p)}</span>;

export function Reports({ rows, title, portName, onClose }: { rows: TxRow[]; title: string; portName: (id: string) => string; onClose: () => void }) {
  const [cat, setCat] = useState<Cat>("Capital Gains");
  const [reportId, setReportId] = useState("realised");
  const [fy, setFy] = useState("2025-26");
  const [onDate, setOnDate] = useState(today());
  const report = REPORTS[cat].find((r) => r.id === reportId) ?? REPORTS[cat][0];

  const gains = useMemo(() => allRealisedGains(rows), [rows]);
  const summary = useMemo(() => gainsSummary(rows), [rows]);

  const pickCat = (c: Cat) => { setCat(c); setReportId(REPORTS[c][0].id); };

  let body: React.ReactNode = null;
  let csv: () => void = () => {};

  if (report.id === "realised") {
    const g = gains.filter((x) => x.fy === fy);
    const st = g.filter((x) => !x.longTerm).reduce((s, x) => s + x.gainPaise, 0);
    const lt = g.filter((x) => x.longTerm).reduce((s, x) => s + x.gainPaise, 0);
    const ltEq = g.filter((x) => x.longTerm && (x.taxClass === "listed_equity" || x.taxClass === "equity_fund")).reduce((s, x) => s + x.gainPaise, 0);
    csv = () => csvDownload(`realised-gains-${fy}.csv`,
      [["Asset", "ISIN", "Buy date", "Sell date", "Qty", "Cost", "Grandfathered cost", "Proceeds", "Gain", "Term"],
        ...g.map((x) => [x.assetName, x.isin ?? "", dmy(x.buyDate), dmy(x.sellDate), x.qty, (x.costPaise / 100).toFixed(2), (x.grandfatheredCostPaise / 100).toFixed(2), (x.proceedsPaise / 100).toFixed(2), (x.gainPaise / 100).toFixed(2), x.longTerm ? "Long" : "Short"])]);
    body = (
      <>
        <div className="steps">
          <span className="st-chip st-Mapped">Short-term {rupees(st)}</span>
          <span className="st-chip st-Mapped">Long-term {rupees(lt)}</span>
          <span className="st-chip st-Fully">of which equity (112A) {rupees(ltEq)}</span>
        </div>
        {ltEq > LTCG_EQUITY_EXEMPT_PAISE
          ? <div className="note">Equity long-term gains are ₹{rupees(ltEq)}; the first ₹1,25,000 is exempt, so ₹{rupees(ltEq - LTCG_EQUITY_EXEMPT_PAISE)} is taxable at 12.5%.</div>
          : <div className="note">Equity long-term gains ₹{rupees(ltEq)} are within the ₹1,25,000 yearly exemption.</div>}
        <div className="tbox" style={{ maxHeight: "48vh" }}>
          {g.length ? (
            <table>
              <thead><tr><th>Asset</th><th>Buy</th><th>Sell</th><th>Qty</th><th>Cost</th><th>Proceeds</th><th>Gain</th><th>Term</th></tr></thead>
              <tbody>
                {g.map((x, i) => (
                  <tr className="row" key={i}>
                    <td style={{ textAlign: "left", whiteSpace: "normal" }}>{x.assetName}{x.fmv2018Paise != null && <span className="chip"> grandfathered</span>}</td>
                    <td>{dmy(x.buyDate)}</td><td>{dmy(x.sellDate)}</td>
                    <td className="num">{quantity(x.qty)}</td>
                    <td className="num">{rupees(x.grandfatheredCostPaise)}</td>
                    <td className="num">{rupees(x.proceedsPaise)}</td>
                    <td>{money(x.gainPaise)}</td>
                    <td>{x.longTerm ? "Long" : "Short"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">No sales in {fy}.</div>}
        </div>
      </>
    );
  } else if (report.id === "cg_summary") {
    csv = () => csvDownload("capital-gains-summary.csv",
      [["FY", "Short-term", "Long-term", "of which equity (112A)", "Total"],
        ...summary.map((s) => [s.fy, (s.shortTermPaise / 100).toFixed(2), (s.longTermPaise / 100).toFixed(2), (s.longTermEquityPaise / 100).toFixed(2), (s.totalPaise / 100).toFixed(2)])]);
    body = (
      <div className="tbox">
        {summary.length ? (
          <table>
            <thead><tr><th>Financial year</th><th>Short-term</th><th>Long-term</th><th>Equity LT (112A)</th><th>Total</th></tr></thead>
            <tbody>{summary.map((s) => (
              <tr className="row" key={s.fy}><td>FY {s.fy}</td><td>{money(s.shortTermPaise)}</td><td>{money(s.longTermPaise)}</td><td>{money(s.longTermEquityPaise)}</td><td>{money(s.totalPaise)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="empty">No realised gains yet.</div>}
      </div>
    );
  } else if (report.id === "holdings_on") {
    const h = holdingsAsOn(rows, onDate);
    const total = h.reduce((s, x) => s + x.costPaise, 0);
    csv = () => csvDownload(`holdings-as-on-${onDate}.csv`,
      [["Asset", "Class", "ISIN", "Qty", "Cost"], ...h.map((x) => [x.name, classInfo(x.cls).name, x.isin ?? "", x.qty, (x.costPaise / 100).toFixed(2)])]);
    body = (
      <div className="tbox" style={{ maxHeight: "50vh" }}>
        {h.length ? (
          <table>
            <thead><tr><th>Asset</th><th>Class</th><th>Qty</th><th>Cost</th></tr></thead>
            <tbody>{h.map((x, i) => (
              <tr className="row" key={i}><td style={{ textAlign: "left" }}>{x.name}</td><td>{classInfo(x.cls).chip}</td><td className="num">{classInfo(x.cls).balance ? "—" : quantity(x.qty)}</td><td className="num">{rupees(x.costPaise)}</td></tr>
            ))}</tbody>
            <tfoot><tr><td>{h.length} holdings</td><td /><td /><td className="num">{rupees(total)}</td></tr></tfoot>
          </table>
        ) : <div className="empty">Nothing held on {dmy(onDate)}.</div>}
      </div>
    );
  } else if (report.id === "income") {
    const inc = incomeRows(rows).filter((x) => x.fy === fy);
    const total = inc.reduce((s, x) => s + x.amountPaise, 0);
    csv = () => csvDownload(`income-${fy}.csv`, [["Date", "Asset", "Type", "Amount"], ...inc.map((x) => [dmy(x.date), x.asset, x.kind, (x.amountPaise / 100).toFixed(2)])]);
    body = (
      <div className="tbox">
        {inc.length ? (
          <table>
            <thead><tr><th>Date</th><th>Asset</th><th>Type</th><th>Amount</th></tr></thead>
            <tbody>{inc.map((x, i) => <tr className="row" key={i}><td>{dmy(x.date)}</td><td style={{ textAlign: "left" }}>{x.asset}</td><td>{x.kind}</td><td className="num">{rupees(x.amountPaise)}</td></tr>)}</tbody>
            <tfoot><tr><td>Total</td><td /><td /><td className="num">{rupees(total)}</td></tr></tfoot>
          </table>
        ) : <div className="empty">No dividends or interest recorded in {fy}. (These come in when you import them.)</div>}
      </div>
    );
  } else if (report.id === "register") {
    const reg = registerRows(rows, portName);
    csv = () => csvDownload("transactions.csv",
      [["Date", "Portfolio", "Asset", "Class", "Type", "Qty", "Price", "Amount"],
        ...reg.map((x) => [dmy(x.date), x.portfolio, x.asset, classInfo(x.cls).name, x.type, classInfo(x.cls).balance ? "" : x.qty, (x.pricePaise / 100).toFixed(2), (x.amountPaise / 100).toFixed(2)])]);
    body = (
      <div className="tbox" style={{ maxHeight: "52vh" }}>
        {reg.length ? (
          <table>
            <thead><tr><th>Date</th><th>Portfolio</th><th>Asset</th><th>Type</th><th>Qty</th><th>Amount</th></tr></thead>
            <tbody>{reg.slice(0, 500).map((x, i) => <tr className="row" key={i}><td>{dmy(x.date)}</td><td>{x.portfolio}</td><td style={{ textAlign: "left" }}>{x.asset}</td><td>{x.type}</td><td className="num">{classInfo(x.cls).balance ? "—" : quantity(x.qty)}</td><td className="num">{rupees(x.amountPaise)}</td></tr>)}</tbody>
          </table>
        ) : <div className="empty">No transactions.</div>}
      </div>
    );
  } else if (report.id === "112a") {
    // ITR Schedule 112A: one row per long-term equity sale (PRD 7.5.2)
    const g112 = gains.filter((x) => x.fy === fy && x.longTerm && (x.taxClass === "listed_equity" || x.taxClass === "equity_fund"));
    csv = () => csvDownload(`schedule-112A-${fy}.csv`,
      [["ISIN", "Name", "No. of shares/units", "Sale price per unit", "Full value of consideration", "Cost of acquisition without indexation", "Cost of acquisition (higher of actual / 112A)", "FMV per unit on 31-Jan-2018", "Expenditure", "Total deductions"],
        ...g112.map((x) => [x.isin ?? "", x.assetName, x.qty, (x.proceedsPaise / x.qty / 100).toFixed(4), (x.proceedsPaise / 100).toFixed(2), (x.costPaise / 100).toFixed(2), (x.grandfatheredCostPaise / 100).toFixed(2), x.fmv2018Paise != null ? (x.fmv2018Paise / 100).toFixed(2) : "", "0", (x.grandfatheredCostPaise / 100).toFixed(2)])]);
    body = (
      <>
        <div className="note">Schedule 112A lists each long-term equity sale for the income-tax return. Download the CSV and import it into the ITR utility.</div>
        <div className="tbox" style={{ maxHeight: "44vh" }}>
          {g112.length ? (
            <table>
              <thead><tr><th>ISIN</th><th>Name</th><th>Units</th><th>Consideration</th><th>Cost (112A)</th><th>Gain</th></tr></thead>
              <tbody>{g112.map((x, i) => <tr className="row" key={i}><td>{x.isin}</td><td style={{ textAlign: "left" }}>{x.assetName}</td><td className="num">{quantity(x.qty)}</td><td className="num">{rupees(x.proceedsPaise)}</td><td className="num">{rupees(x.grandfatheredCostPaise)}</td><td>{money(x.gainPaise)}</td></tr>)}</tbody>
            </table>
          ) : <div className="empty">No long-term equity sales in {fy}.</div>}
        </div>
      </>
    );
  }

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Reports" extra={<div className="mut" style={{ fontSize: 13 }}>{title}</div>} onClose={onClose} />
      <div className="mbody rep">
        <div className="cats">{CATS.map((c) => <button key={c} data-rcat={c} aria-pressed={c === cat} onClick={() => pickCat(c)}>{c}</button>)}</div>
        <div className="rl">
          <div className="colhead">{cat}</div>
          {REPORTS[cat].map((r) => <button key={r.id} aria-pressed={r.id === reportId} onClick={() => setReportId(r.id)}><span>{r.name}</span></button>)}
        </div>
        <div className="det">
          <h3><span>{report.name}</span></h3>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            {report.period === "fy" && (
              <label className="field" style={{ maxWidth: 160 }}>Financial year<select value={fy} onChange={(e) => setFy(e.target.value)}>{FYS.map((f) => <option key={f} value={f}>FY {f}</option>)}</select></label>
            )}
            {report.period === "date" && (
              <label className="field" style={{ maxWidth: 180 }}>As on<input type="date" value={onDate} max={today()} onChange={(e) => setOnDate(e.target.value)} /></label>
            )}
            <button className="btn primary" onClick={csv}>Export to CSV</button>
          </div>
          {body}
        </div>
      </div>
    </Modal>
  );
}
