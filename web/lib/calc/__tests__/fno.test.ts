import { describe, expect, it } from "vitest";
import { computeFno, contractLabel, unrealisedPnl, type FnoTrade } from "../fno";

const t = (over: Partial<FnoTrade>): FnoTrade => ({
  underlying: "NIFTY", instrument: "CE", expiry: "2026-04-24", strikePaise: 2390000, segment: "stock",
  date: "2026-04-01", side: "sell", quantity: 75, pricePaise: 7900, ...over,
});

describe("F&O P&L", () => {
  it("realises a short option closed by a buy (sell high, buy low = profit)", () => {
    const r = computeFno([
      t({ side: "sell", quantity: 75, pricePaise: 7900, date: "2026-04-01" }),
      t({ side: "buy", quantity: 75, pricePaise: 2000, date: "2026-04-10" }),
    ]);
    expect(r.realised).toHaveLength(1);
    expect(r.realised[0]).toMatchObject({ wasShort: true, qty: 75 });
    expect(r.realised[0].pnlPaise).toBe((7900 - 2000) * 75);
    expect(r.open).toHaveLength(0);
  });

  it("realises a long future closed by a sell", () => {
    const r = computeFno([
      t({ instrument: "FUT", strikePaise: undefined, side: "buy", quantity: 35, pricePaise: 5612000, date: "2026-04-01" }),
      t({ instrument: "FUT", strikePaise: undefined, side: "sell", quantity: 35, pricePaise: 5648800, date: "2026-04-05" }),
    ]);
    expect(r.realised[0].pnlPaise).toBe((5648800 - 5612000) * 35);
    expect(r.realised[0].wasShort).toBe(false);
  });

  it("keeps a partial position open and nets FIFO", () => {
    const r = computeFno([
      t({ side: "sell", quantity: 150, pricePaise: 8000, date: "2026-04-01" }),
      t({ side: "buy", quantity: 75, pricePaise: 3000, date: "2026-04-05" }),
    ]);
    expect(r.realised[0].qty).toBe(75);
    expect(r.realised[0].pnlPaise).toBe((8000 - 3000) * 75);
    expect(r.open).toHaveLength(1);
    expect(r.open[0].qty).toBe(-75); // still short 75
    expect(r.open[0].avgPricePaise).toBe(8000);
  });

  it("totals turnover per FY as the sum of absolute realised P&L", () => {
    const r = computeFno([
      t({ side: "sell", quantity: 75, pricePaise: 7900, date: "2026-04-01" }),
      t({ side: "buy", quantity: 75, pricePaise: 9000, date: "2026-04-10" }), // a loss
    ]);
    expect(r.realised[0].pnlPaise).toBe((7900 - 9000) * 75); // negative
    expect(r.turnoverPaiseByFy["2026-27"]).toBe(Math.abs((7900 - 9000) * 75));
  });

  it("separates different contracts", () => {
    const r = computeFno([
      t({ strikePaise: 2390000, side: "sell", quantity: 75, pricePaise: 100 }),
      t({ strikePaise: 2400000, side: "sell", quantity: 75, pricePaise: 50 }),
    ]);
    expect(r.open).toHaveLength(2);
  });

  it("marks an open position to a settlement price", () => {
    const r = computeFno([t({ instrument: "FUT", strikePaise: undefined, side: "buy", quantity: 35, pricePaise: 5612000 })]);
    expect(unrealisedPnl(r.open[0], 5648800)).toBe((5648800 - 5612000) * 35);
  });

  it("labels contracts", () => {
    expect(contractLabel({ underlying: "NIFTY", instrument: "FUT", expiry: "2026-11-25" })).toBe("NIFTY 25-Nov-26 FUT");
    expect(contractLabel({ underlying: "NIFTY", instrument: "CE", expiry: "2026-04-24", strikePaise: 2390000 })).toContain("CE");
  });
});
