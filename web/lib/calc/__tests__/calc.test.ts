import { describe, expect, it } from "vitest";
import { depositValue } from "../deposits";
import { buildLots, type Tx } from "../fifo";
import { figures, sumFigures } from "../figures";
import { xirr } from "../xirr";

// helpers: rupees in, paise in the transaction
const tx = (type: Tx["type"], date: string, qty: number, price: number, charges = 0, portfolioId = "A"): Tx => ({
  portfolioId, type, date, quantity: qty, pricePaise: price * 100, amountPaise: Math.round(qty * price * 100), chargesPaise: charges * 100,
});
const dep = (type: "deposit" | "withdraw", date: string, rupees: number): Tx => ({
  portfolioId: "A", type, date, quantity: 1, pricePaise: rupees * 100, amountPaise: rupees * 100, chargesPaise: 0,
});

describe("FIFO lots", () => {
  it("sells the oldest lot first and splits the second", () => {
    const r = buildLots([tx("buy", "2024-01-01", 10, 100), tx("buy", "2024-02-01", 10, 120), tx("sell", "2024-06-01", 15, 150)]);
    expect(r.realised).toHaveLength(2);
    expect(r.realised[0]).toMatchObject({ qty: 10, costPaise: 100000, proceedsPaise: 150000, gainPaise: 50000, buyDate: "2024-01-01" });
    expect(r.realised[1].qty).toBe(5);
    expect(r.realised[1].costPaise).toBeCloseTo(60000);
    expect(r.realised[1].gainPaise).toBeCloseTo(15000);
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0]).toMatchObject({ date: "2024-02-01", qty: 5 });
    expect(r.lots[0].costPaise).toBeCloseTo(60000);
  });

  it("adds buy charges to cost and takes sell charges off proceeds", () => {
    const r = buildLots([tx("buy", "2024-01-01", 10, 100, 20), tx("sell", "2024-03-01", 10, 110, 10)]);
    expect(r.realised[0].costPaise).toBe(102000);
    expect(r.realised[0].proceedsPaise).toBe(109000);
    expect(r.realised[0].gainPaise).toBe(7000);
    expect(r.lots).toHaveLength(0);
  });

  it("warns and caps a sale larger than the holding", () => {
    const r = buildLots([tx("buy", "2024-01-01", 5, 100), tx("sell", "2024-02-01", 8, 100)]);
    expect(r.warnings).toHaveLength(1);
    expect(r.realised.reduce((s, x) => s + x.qty, 0)).toBe(5);
    expect(r.lots).toHaveLength(0);
  });

  it("adds bonus shares at zero cost, dated on allotment", () => {
    const r = buildLots([tx("buy", "2023-01-01", 10, 100), { ...tx("bonus", "2024-05-01", 10, 0) }]);
    const f = figures(r.lots, false, {});
    expect(f.qty).toBe(20);
    expect(f.investedPaise).toBe(100000);
    expect(f.avgPaise).toBe(5000);
    expect(r.lots[1]).toMatchObject({ date: "2024-05-01", costPaise: 0 });
  });

  it("multiplies quantity on a split and keeps cost and dates", () => {
    const r = buildLots([tx("buy", "2023-01-01", 10, 1000), { ...tx("split", "2024-01-01", 10, 0) }]);
    expect(r.lots[0]).toMatchObject({ date: "2023-01-01", qty: 100, costPaise: 1000000 });
  });

  it("processes a same-day buy before a sell regardless of input order", () => {
    const r = buildLots([tx("sell", "2024-01-01", 5, 110), tx("buy", "2024-01-01", 5, 100)]);
    expect(r.warnings).toHaveLength(0);
    expect(r.realised[0].gainPaise).toBe(5000);
  });

  it("handles fund units with decimals", () => {
    const r = buildLots([tx("buy", "2022-04-05", 1820.4, 54.93), tx("buy", "2024-09-10", 640.2, 78.1), tx("sell", "2025-01-10", 1000, 90)]);
    expect(r.lots[0].qty).toBeCloseTo(820.4, 6);
    expect(r.lots[0].costPaise).toBeCloseTo(820.4 * 5493, 0);
    expect(r.realised[0].days).toBe(1011);
  });

  it("keeps each portfolio's lots separate", () => {
    const r = buildLots([tx("buy", "2024-01-01", 10, 100, 0, "A"), tx("buy", "2024-02-01", 10, 200, 0, "B"), tx("sell", "2024-03-01", 10, 300, 0, "B")]);
    expect(r.lots).toHaveLength(1);
    expect(r.lots[0].portfolioId).toBe("A");
    expect(r.realised[0].costPaise).toBe(200000);
  });

  it("treats balance assets as amounts: withdrawals use up the oldest deposits", () => {
    const r = buildLots([dep("deposit", "2024-01-01", 5000), dep("deposit", "2024-02-01", 5000), dep("withdraw", "2024-03-01", 6000)], true);
    const f = figures(r.lots, true, {});
    expect(f.investedPaise).toBe(400000);
    expect(r.lots[0].date).toBe("2024-02-01");
  });
});

describe("XIRR", () => {
  it("matches Excel's documented example (37.34%)", () => {
    const r = xirr([
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ]);
    expect(r).toBeCloseTo(0.373362535, 6);
  });

  it("gives about 10% for +10% over a leap year (366 days)", () => {
    expect(xirr([{ date: "2020-01-01", amount: -1000 }, { date: "2021-01-01", amount: 1100 }])).toBeCloseTo(0.099713, 5);
  });

  it("handles a loss", () => {
    expect(xirr([{ date: "2023-01-01", amount: -1000 }, { date: "2024-01-01", amount: 800 }])).toBeCloseTo(-0.2, 6);
  });

  it("returns NaN when there is nothing to solve", () => {
    expect(xirr([{ date: "2023-01-01", amount: -1000 }])).toBeNaN();
    expect(xirr([{ date: "2023-01-01", amount: -1000 }, { date: "2024-01-01", amount: -10 }])).toBeNaN();
  });
});

describe("deposits", () => {
  const P = 100000_00; // ₹1,00,000 in paise
  it("compounds quarterly (7% for a year = ₹1,07,185.90)", () => {
    expect(depositValue(P, { ratePct: 7, compounding: "quarterly", start: "2025-01-01" }, "2026-01-01")).toBeCloseTo(10718590, -1);
  });
  it("uses simple interest for loans given", () => {
    expect(depositValue(P, { ratePct: 9, compounding: "simple", start: "2025-01-01" }, "2026-01-01")).toBeCloseTo(10900000, 0);
  });
  it("stops at maturity and leaves payout deposits at principal", () => {
    const t = { ratePct: 7, compounding: "quarterly" as const, start: "2025-01-01", maturity: "2026-01-01" };
    expect(depositValue(P, t, "2027-06-01")).toBeCloseTo(depositValue(P, t, "2026-01-01"), 6);
    expect(depositValue(P, { ...t, payout: true }, "2026-01-01")).toBe(P);
  });
});

describe("figures", () => {
  it("works out current, today and unrealised gains", () => {
    const { lots } = buildLots([tx("buy", "2024-01-01", 10, 100)]);
    const f = figures(lots, false, { pricePaise: 12000, prevPaise: 11000 });
    expect(f).toMatchObject({ currentPaise: 120000, todayPaise: 10000, unrealisedPaise: 20000 });
    expect(f.unrealisedPct).toBeCloseTo(20);
    expect(f.todayPct).toBeCloseTo((10000 / 110000) * 100);
  });

  it("leaves value blank without a price, and totals stay blank too", () => {
    const { lots } = buildLots([tx("buy", "2024-01-01", 10, 100)]);
    const a = figures(lots, false, {});
    const b = figures(lots, false, { pricePaise: 12000 });
    expect(a.currentPaise).toBeNull();
    const s = sumFigures([a, b]);
    expect(s.investedPaise).toBe(200000);
    expect(s.currentPaise).toBeNull();
    expect(s.pricedCount).toBe(1);
  });

  it("totals percentages from rupees, not by adding percentages", () => {
    const x = figures(buildLots([tx("buy", "2024-01-01", 1, 100)]).lots, false, { pricePaise: 20000 });
    const y = figures(buildLots([tx("buy", "2024-01-01", 1, 900)]).lots, false, { pricePaise: 90000 });
    expect(sumFigures([x, y]).unrealisedPct).toBeCloseTo(10); // 100 gain on 1000, not (100% + 0%)
  });
});
