import { describe, expect, it } from "vitest";
import { classInfo } from "../assetClasses";
import { sumFigures } from "../calc/figures";
import { DEMO_PORTFOLIOS } from "../demo";
import { buildHoldings, type TxRow } from "../holdings";

// Builds the demo family the same way "Load demo family" stores it.
function demoRows(): TxRow[] {
  const p = (r: number) => Math.round(r * 100);
  const rows: TxRow[] = [];
  let n = 0;
  for (const port of DEMO_PORTFOLIOS)
    for (const h of port.holdings) {
      const bal = !!classInfo(h.cls).balance;
      const asset = {
        id: h.name, name: h.name, asset_class: h.cls, isin: null,
        meta: bal ? { value_paise: p(h.price) } : { price_paise: p(h.price), prev_price_paise: p(h.prev) },
      };
      for (const [date, qty, price] of h.lots)
        rows.push({
          id: String(n++), portfolio_id: port.name, asset_id: h.name, type: bal ? "deposit" : "buy", trade_date: date,
          quantity: qty, price_paise: p(price), amount_paise: p(qty * price), charges_paise: 0, notes: null, asset,
        });
    }
  return rows;
}

describe("demo family matches the approved prototype", () => {
  it("Family Group totals equal the prototype's NET WORTH row", () => {
    const t = sumFigures(buildHoldings(demoRows(), "2026-10-26").map((h) => h.fig));
    // prototype: invested 63,79,169.03 · today 13,635.81 · unrealised 19,91,977.39 · value 83,71,146.42
    // Today's gain is ₹2,710 lower: the prototype gave NPS and the two FDs a made-up previous-day value;
    // balance-type holdings have no daily value until a valuation feed exists, so their day change is 0.
    expect(t.investedPaise / 100).toBeCloseTo(6379169.03, 1);
    expect(t.todayPaise! / 100).toBeCloseTo(13635.81 - 2710, 1);
    expect(t.unrealisedPaise! / 100).toBeCloseTo(1991977.39, 1);
    expect(t.currentPaise! / 100).toBeCloseTo(8371146.42, 1);
  });

  it("merges the same asset held by several members into one row", () => {
    const hs = buildHoldings(demoRows(), "2026-10-26");
    expect(hs).toHaveLength(27);
    expect(hs.every((h) => h.owners.length === 1)).toBe(true);
  });
});
