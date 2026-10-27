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
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

// column aliases (lower-case) for the fields we need across Zerodha / Anand Rathi / generic tradebooks
const COLS = {
  date: ["trade_date", "order_execution_time", "date", "trade date"],
  type: ["trade_type", "transaction_type", "buy/sell", "buy / sell", "type"],
  isin: ["isin"],
  symbol: ["symbol", "tradingsymbol", "security", "security name", "scrip"],
  qty: ["quantity", "qty", "no. of shares/units", "shares"],
  price: ["price", "trade_price", "average_price", "rate (rs)", "net rate (rs)", "rate", "net rate", "price (rs)", "rate/unit"],
};

function findCols(header: unknown[]): Record<keyof typeof COLS, number> | null {
  const lower = header.map(norm);
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = lower.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const map = {
    date: idx(COLS.date), type: idx(COLS.type), isin: idx(COLS.isin),
    symbol: idx(COLS.symbol), qty: idx(COLS.qty), price: idx(COLS.price),
  };
  // a usable header has date, type, quantity, price and some asset id (isin or symbol)
  if (map.date >= 0 && map.type >= 0 && map.qty >= 0 && map.price >= 0 && (map.isin >= 0 || map.symbol >= 0)) return map;
  return null;
}

function isoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const s = String(v ?? "").slice(0, 10);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // DD-MM-YYYY or DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

const money = (v: unknown) => Number(String(v ?? "").replace(/[₹,\s]/g, ""));

/**
 * Parse an equity tradebook / trade-details sheet in the browser. Handles Zerodha and Anand Rathi
 * "Trade Details" exports (title rows before the header, a "Rate" price column) and plain tradebooks.
 * Picks the sheet that has the trade columns, and finds the header row under any title preamble.
 */
export function parseTradebook(buf: ArrayBuffer): { rows: ImportRow[]; error?: string } {
  const wb = XLSX.read(buf, { cellDates: true });
  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: false });
    for (let h = 0; h < Math.min(grid.length, 12); h++) {
      const cols = findCols(grid[h] ?? []);
      if (!cols) continue;
      const rows: ImportRow[] = [];
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r] ?? [];
        const qty = Math.abs(money(row[cols.qty]));
        const price = money(row[cols.price]);
        if (!(qty > 0) || !isFinite(price) || price <= 0) continue;
        const t = norm(row[cols.type]);
        const type = t.startsWith("b") ? "buy" : t.startsWith("s") ? "sell" : null;
        if (!type) continue;
        const date = isoDate(row[cols.date]);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const isin = cols.isin >= 0 ? String(row[cols.isin] ?? "").trim() || null : null;
        const symbol = cols.symbol >= 0 ? String(row[cols.symbol] ?? "").trim() : "";
        const name = symbol || isin || "";
        if (!name) continue;
        rows.push({
          date, type, isin, symbol: symbol || null, name, cls: "EQ",
          units: qty, nav_paise: paise(price), amount_paise: paise(qty * price), charges_paise: 0,
          source_ref: "tb-" + hash([isin || symbol, date, t, qty, price, r]),
        });
      }
      if (rows.length) return { rows };
    }
  }
  return { rows: [], error: "No trade rows found. The sheet needs date, buy/sell, quantity, price and a symbol or ISIN." };
}
