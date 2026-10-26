"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { importOpening, type OpeningRow } from "@/app/tx-actions";
import { ASSET_CLASSES, classInfo } from "@/lib/assetClasses";
import { quantity, rupees } from "@/lib/format";
import { Modal, ModalHead } from "./Modal";

const HEAD = ["Portfolio", "Asset class", "Asset name", "Purchase date", "Quantity", "Price per unit (or amount)", "Current price (or value)"];

// "EQ", "Stocks & ETFs", "stocks" … → class code
function toClass(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  const hit = ASSET_CLASSES.find((c) => c.code.toLowerCase() === s || c.name.toLowerCase() === s || c.name.toLowerCase().startsWith(s));
  return hit?.code ?? null;
}

function toDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) {
    // SheetJS gives local-midnight dates: read the local parts
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/); // DD-MM-YYYY, the Indian way
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const toNum = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[₹,\s]/g, "")));

type Parsed = OpeningRow & { problem?: string };

export function downloadTemplate(portfolios: string[]) {
  const wb = XLSX.utils.book_new();
  const p1 = portfolios[0] ?? "My portfolio";
  const ws = XLSX.utils.aoa_to_sheet([
    HEAD,
    [p1, "EQ", "HDFC Bank", "15-06-2023", 50, 1580.5, 1642.3],
    [p1, "MFE", "Parag Parikh Flexi Cap - Direct", "05-04-2022", 1820.4, 54.93, 92.14],
    [p1, "FD", "SBI FD 7.10% (2027)", "15-04-2024", "", 500000, 548200],
  ]);
  ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 34 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, "Holdings");
  const help = XLSX.utils.aoa_to_sheet([
    ["Asset class code", "Means", "Quantity", "Price column"],
    ...ASSET_CLASSES.map((c) => [c.code, c.name, c.balance ? "leave blank" : "units held", c.balance ? "amount put in" : "price per unit"]),
    [],
    ["Portfolio names must match the portfolios in FolioLense exactly."],
    ["Dates as DD-MM-YYYY. One row per purchase if you know them, or one row per holding with the first purchase date."],
    ["Importing the same sheet twice adds nothing the second time."],
  ]);
  help["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, help, "How to fill");
  XLSX.writeFile(wb, "FolioLense opening balances.xlsx");
}

export function ImportOpening({
  familyId,
  portfolios,
  onClose,
  onDone,
}: {
  familyId: string;
  portfolios: string[];
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [file, setFile] = useState("");
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();
  const known = new Set(portfolios.map((p) => p.trim().toLowerCase()));

  async function read(f: File) {
    setError("");
    setFile(f.name);
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, raw: true });
      const body = raw.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
      const parsed: Parsed[] = body.map((r) => {
        const cls = toClass(r[1]);
        const bal = cls ? !!classInfo(cls).balance : false;
        const row: Parsed = {
          portfolio: String(r[0] ?? "").trim(),
          assetClass: cls ?? String(r[1] ?? ""),
          assetName: String(r[2] ?? "").trim(),
          date: toDate(r[3]) ?? "",
          quantity: bal ? 1 : toNum(r[4]),
          price: toNum(r[5]),
          currentPrice: String(r[6] ?? "").trim() === "" ? null : toNum(r[6]),
        };
        if (!known.has(row.portfolio.toLowerCase())) row.problem = `No portfolio "${row.portfolio}"`;
        else if (!cls) row.problem = `Unknown asset class "${r[1] ?? ""}"`;
        else if (!row.assetName) row.problem = "No asset name";
        else if (!row.date) row.problem = "Date not understood (use DD-MM-YYYY)";
        else if (!bal && !(row.quantity > 0)) row.problem = "Quantity missing";
        else if (!(row.price > 0)) row.problem = bal ? "Amount missing" : "Price missing";
        return row;
      });
      if (!parsed.length) setError("No rows found under the heading row.");
      setRows(parsed);
    } catch {
      setError("That file couldn't be read. Use the template (.xlsx), or save your sheet as .xlsx or .csv.");
      setRows(null);
    }
  }

  const bad = rows?.filter((r) => r.problem).length ?? 0;
  const go = () =>
    start(async () => {
      const r = await importOpening(
        familyId,
        rows!.map((x) => ({ portfolio: x.portfolio, assetClass: x.assetClass, assetName: x.assetName, date: x.date, quantity: x.quantity, price: x.price, currentPrice: x.currentPrice })),
      );
      if (r.error) setError(r.error);
      else onDone(`${r.added} holdings added${r.skipped ? `, ${r.skipped} already there` : ""}`);
    });

  return (
    <Modal wide onClose={onClose}>
      <ModalHead title="Load opening balances from Excel" onClose={onClose} />
      <div className="mbody">
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <button className="link" onClick={() => downloadTemplate(portfolios)}>Download the template</button> and fill one row per holding (or per purchase).
          </li>
          <li>Portfolio names must match: {portfolios.length ? portfolios.join(", ") : "add portfolios first"}.</li>
          <li>Upload it here, check the preview, then import.</li>
        </ol>
        <label
          className={`drop${over ? " over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void read(f); }}
        >
          <span className="btn">Upload File</span>
          <span className="mut" style={{ fontSize: 13 }}>{file || "or drop the .xlsx / .csv here"}</span>
          <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
        </label>
        {error && <div className="warn loss">{error}</div>}
        {rows && rows.length > 0 && (
          <>
            <div className={bad ? "warn" : "note"}>
              {rows.length} rows read{bad ? ` · ${bad} need fixing in the sheet before importing` : " · all look right"}
            </div>
            <div className="tbox" style={{ maxHeight: "40vh" }}>
              <table>
                <thead><tr><th>Row</th><th>Portfolio</th><th>Asset</th><th>Date</th><th>Qty</th><th>Price / amount</th><th>Current</th><th>Check</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const bal = ASSET_CLASSES.some((c) => c.code === r.assetClass) && !!classInfo(r.assetClass).balance;
                    return (
                      <tr className="row" key={i}>
                        <td>{i + 2}</td>
                        <td style={{ textAlign: "left" }}>{r.portfolio}</td>
                        <td style={{ textAlign: "left", whiteSpace: "normal" }}>{r.assetName} <code className="gcode">{r.assetClass}</code></td>
                        <td>{r.date}</td>
                        <td className="num">{bal ? "—" : isFinite(r.quantity) ? quantity(r.quantity) : "?"}</td>
                        <td className="num">{isFinite(r.price) ? rupees(Math.round(r.price * 100)) : "?"}</td>
                        <td className="num">{r.currentPrice != null && isFinite(r.currentPrice) ? rupees(Math.round(r.currentPrice * 100)) : ""}</td>
                        <td className={r.problem ? "loss" : "gain"} style={{ textAlign: "left" }}>{r.problem ?? "✓"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="row-end">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={pending || bad > 0} onClick={go}>
                {pending ? "Importing…" : `Import ${rows.length} rows`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
