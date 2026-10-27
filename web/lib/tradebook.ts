import * as XLSX from "xlsx";
import type { ImportRow } from "@/app/import-actions";

// Stable short hash for a row's source_ref, so re-importing the same file adds nothing.
function hash(parts: (string | number)[]): string {
  const s = parts.join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const paise = (n: number) => Math.round(n * 100);

function pick(keys: string[], ...names: string[]): string | null {
  const low = new Map(keys.map((k) => [k.trim().toLowerCase(), k]));
  for (const n of names) if (low.has(n)) return low.get(n)!;
  return null;
}

function isoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const s = String(v ?? "").slice(0, 10);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

/** Parse a Zerodha (or similar) equity tradebook CSV/XLSX in the browser. Mirrors worker/jobs/statements.py. */
export function parseTradebook(buf: ArrayBuffer): { rows: ImportRow[]; error?: string } {
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true });
  if (!data.length) return { rows: [], error: "The file has no rows." };
  const keys = Object.keys(data[0]);
  const cSym = pick(keys, "symbol", "tradingsymbol");
  const cIsin = pick(keys, "isin");
  const cDate = pick(keys, "trade_date", "order_execution_time", "date");
  const cType = pick(keys, "trade_type", "transaction_type", "buy/sell");
  const cQty = pick(keys, "quantity", "qty");
  const cPrice = pick(keys, "price", "trade_price", "average_price");
  if (!(cSym && cDate && cType && cQty && cPrice))
    return { rows: [], error: "Not a recognised tradebook (needs symbol, date, type, quantity, price columns)." };

  const rows: ImportRow[] = [];
  data.forEach((r, i) => {
    const qty = Math.abs(Number(r[cQty]));
    const price = Number(r[cPrice]);
    if (!(qty > 0) || !isFinite(price)) return;
    const t = String(r[cType] ?? "").trim().toLowerCase();
    const type = t === "buy" || t === "b" ? "buy" : t === "sell" || t === "s" ? "sell" : null;
    if (!type) return;
    const date = isoDate(r[cDate]);
    const sym = String(r[cSym] ?? "").trim();
    rows.push({
      date, type, isin: cIsin ? String(r[cIsin] ?? "").trim() || null : null, symbol: sym, name: sym, cls: "EQ",
      units: qty, nav_paise: paise(price), amount_paise: paise(qty * price), charges_paise: 0,
      source_ref: "tb-" + hash([sym, date, t, qty, price, i]),
    });
  });
  return { rows };
}
