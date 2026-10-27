import { describe, expect, it } from "vitest";
import type { Tx } from "../fifo";
import { fyOf, realisedGains, summariseGains, taxClassFor } from "../gains";

const buy = (date: string, qty: number, price: number): Tx => ({
  portfolioId: "A", type: "buy", date, quantity: qty, pricePaise: price * 100, amountPaise: Math.round(qty * price * 100), chargesPaise: 0,
});
const sell = (date: string, qty: number, price: number): Tx => ({
  portfolioId: "A", type: "sell", date, quantity: qty, pricePaise: price * 100, amountPaise: Math.round(qty * price * 100), chargesPaise: 0,
});

describe("financial year", () => {
  it("runs April to March", () => {
    expect(fyOf("2025-07-28")).toBe("2025-26");
    expect(fyOf("2026-03-31")).toBe("2025-26");
    expect(fyOf("2026-04-01")).toBe("2026-27");
  });
});

describe("tax class", () => {
  it("picks equity vs debt-fund rules by buy date", () => {
    expect(taxClassFor("EQ")).toBe("listed_equity");
    expect(taxClassFor("MFE")).toBe("equity_fund");
    expect(taxClassFor("MFD", { firstBuy: "2024-01-01" })).toBe("specified_mf"); // bought after Apr-2023
    expect(taxClassFor("MFD", { firstBuy: "2022-01-01" })).toBe("other_mf");
    expect(taxClassFor("GLD", { subType: "SGB" })).toBe("sgb");
  });
});

describe("realised gains", () => {
  it("classifies short vs long term for equity (12-month line)", () => {
    const g = realisedGains([buy("2023-01-01", 100, 100), sell("2023-06-01", 40, 150), sell("2024-03-01", 60, 200)],
      { assetName: "X", isin: null, taxClass: "listed_equity" });
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ longTerm: false, qty: 40, gainPaise: 40 * 50 * 100 }); // 5 months
    expect(g[1]).toMatchObject({ longTerm: true, qty: 60, gainPaise: 60 * 100 * 100 }); // 14 months
  });

  it("applies 31-Jan-2018 grandfathering to long-term equity", () => {
    // bought 2015 @ ₹100, FMV on 31-Jan-2018 was ₹300, sold 2024 @ ₹500
    // taxable cost = max(100, min(300, 500)) = 300; gain = 500-300 = 200 per share
    const g = realisedGains([buy("2015-06-01", 10, 100), sell("2024-06-01", 10, 500)],
      { assetName: "X", isin: null, taxClass: "listed_equity", fmv2018Paise: 300 * 100 });
    expect(g[0].longTerm).toBe(true);
    expect(g[0].grandfatheredCostPaise).toBe(300 * 10 * 100);
    expect(g[0].gainPaise).toBe(200 * 10 * 100);
    expect(g[0].costPaise).toBe(100 * 10 * 100); // actual cost still recorded
  });

  it("does not grandfather when FMV is above the sale price (caps at sale value)", () => {
    // FMV ₹600 but sold at ₹500: cost = max(100, min(600, 500)) = 500 -> gain 0
    const g = realisedGains([buy("2015-06-01", 10, 100), sell("2024-06-01", 10, 500)],
      { assetName: "X", isin: null, taxClass: "listed_equity", fmv2018Paise: 600 * 100 });
    expect(g[0].gainPaise).toBe(0);
  });

  it("treats specified MF (debt after Apr-2023) as always short term", () => {
    const g = realisedGains([buy("2023-05-01", 100, 100), sell("2026-05-01", 100, 130)],
      { assetName: "D", isin: null, taxClass: "specified_mf" });
    expect(g[0].longTerm).toBe(false); // even after 3 years
  });

  it("uses 24 months for unlisted and other debt", () => {
    const g = realisedGains([buy("2022-01-01", 10, 100), sell("2024-06-01", 10, 200)],
      { assetName: "U", isin: null, taxClass: "unlisted" });
    expect(g[0].longTerm).toBe(true); // 29 months > 24
    const g2 = realisedGains([buy("2023-01-01", 10, 100), sell("2024-06-01", 10, 200)],
      { assetName: "U", isin: null, taxClass: "unlisted" });
    expect(g2[0].longTerm).toBe(false); // 17 months < 24
  });
});

describe("summary by FY", () => {
  it("separates equity long-term for the 1.25L exemption", () => {
    const gains = [
      ...realisedGains([buy("2020-01-01", 100, 100), sell("2025-06-01", 100, 300)], { assetName: "EQ", isin: null, taxClass: "listed_equity" }),
      ...realisedGains([buy("2025-01-01", 100, 100), sell("2025-09-01", 100, 150)], { assetName: "EQ2", isin: null, taxClass: "listed_equity" }),
    ];
    const s = summariseGains(gains).find((x) => x.fy === "2025-26")!;
    expect(s.longTermEquityPaise).toBe(100 * 200 * 100); // 20,000
    expect(s.shortTermPaise).toBe(100 * 50 * 100); // 5,000
    expect(s.totalPaise).toBe(100 * 200 * 100 + 100 * 50 * 100);
  });
});
