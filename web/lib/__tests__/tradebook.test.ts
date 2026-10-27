import { describe, expect, it } from "vitest";
import { parseTradebook } from "../tradebook";

const enc = (s: string) => new TextEncoder().encode(s).buffer;

describe("tradebook parser (browser)", () => {
  it("reads buy/sell rows and builds amounts in paise", () => {
    const csv = "symbol,isin,trade_date,trade_type,quantity,price\n" +
      "TATAMOTORS,INE155A01022,2024-05-10,buy,20,950.50\n" +
      "INFY,INE009A01021,2024-11-20,sell,5,1850.00\n";
    const { rows, error } = parseTradebook(enc(csv));
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "buy", symbol: "TATAMOTORS", isin: "INE155A01022", units: 20, amount_paise: 1901000 });
    expect(rows[1].type).toBe("sell");
    // same rows re-parsed give the same source_refs (so re-import skips)
    expect(parseTradebook(enc(csv)).rows.map((r) => r.source_ref)).toEqual(rows.map((r) => r.source_ref));
  });

  it("rejects a non-tradebook file", () => {
    expect(parseTradebook(enc("a,b\n1,2\n")).error).toMatch(/no trade rows found/i);
  });
});

describe("tradebook with title preamble + Rate column (Anand Rathi / Zerodha export)", () => {
  it("finds the header under title rows and maps Rate to price", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Stock-Level Trade Details"],
      ["One row per stock trade"],
      [],
      ["Date", "Contract Note No", "Buy/Sell", "ISIN", "Symbol", "Quantity", "Rate (Rs)", "Trade Value (Rs)"],
      ["07/04/2025", "0053118", "BUY", "INE570A01022", "IONEXCHANG", 25, 429, 10725],
      ["08/04/2025", "0064571", "SELL", "INE021A01026", "ASIANPAINT", 10, 2376, 23760],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Trade Details");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const { rows, error } = parseTradebook(buf as ArrayBuffer);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "buy", isin: "INE570A01022", units: 25, nav_paise: 42900, amount_paise: 1072500 });
    expect(rows[1].type).toBe("sell");
  });
});
