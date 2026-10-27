// Realised capital gains for tax (PRD 7.5). Builds on the FIFO engine: each sale is matched to the
// oldest purchases, then classified short/long term by the asset's tax class and holding period,
// with 31-Jan-2018 grandfathering for listed equity and equity funds. Money in paise.
import { buildLots, daysBetween, type Tx } from "./fifo";

// which long-term threshold and which tax treatment an asset gets (PRD 7.5)
export type TaxClass =
  | "listed_equity" // shares, equity ETFs
  | "equity_fund" // equity-oriented mutual funds
  | "specified_mf" // debt funds bought on/after 1-Apr-2023: always short term
  | "other_mf" // other debt funds, gold/international FoF
  | "listed_other" // listed bonds, REIT/InvIT
  | "unlisted" // unlisted shares
  | "gold_physical"
  | "sgb"
  | "slab"; // interest-bearing, no capital gains

/** Long-term if held longer than this many months. null = never long term (specified MF). */
const LONG_TERM_MONTHS: Record<TaxClass, number | null> = {
  listed_equity: 12, equity_fund: 12, listed_other: 12, sgb: 12,
  specified_mf: null, other_mf: 24, unlisted: 24, gold_physical: 24,
  slab: 24,
};

/** Map an asset class (EQ/MFE/…) + a hint to a tax class. Debt-fund cutoff needs the first buy date. */
export function taxClassFor(assetClass: string, opts?: { subType?: string; firstBuy?: string }): TaxClass {
  switch (assetClass) {
    case "EQ": return "listed_equity";
    case "MFE": case "SIF": return "equity_fund";
    case "MFD":
      // debt-oriented funds bought on/after 1-Apr-2023 are "specified MF" (always short term, slab)
      return opts?.firstBuy && opts.firstBuy >= "2023-04-01" ? "specified_mf" : "other_mf";
    case "PE": return "unlisted";
    case "GLD": return opts?.subType === "SGB" ? "sgb" : "gold_physical";
    default: return "slab";
  }
}

export interface RealisedGain {
  assetName: string;
  isin: string | null;
  taxClass: TaxClass;
  buyDate: string;
  sellDate: string;
  fy: string; // e.g. "2025-26"
  qty: number;
  costPaise: number; // actual cost (purchase + charges) for the quantity sold
  grandfatheredCostPaise: number; // cost used for tax after 31-Jan-2018 grandfathering
  proceedsPaise: number;
  gainPaise: number; // taxable gain (uses grandfathered cost)
  longTerm: boolean;
  fmv2018Paise?: number;
}

/** Financial year label for a date (April–March). "2025-07-28" -> "2025-26". */
export function fyOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const GF_DATE = "2018-01-31"; // 31-Jan-2018 fair market value applies to equity bought on/before this

/**
 * @param txs one asset's transactions
 * @param taxClass the asset's tax class
 * @param fmv2018Paise 31-Jan-2018 FMV per unit (listed equity / equity funds), if known
 */
export function realisedGains(
  txs: Tx[],
  meta: { assetName: string; isin: string | null; taxClass: TaxClass; fmv2018Paise?: number },
): RealisedGain[] {
  const { realised } = buildLots(txs, false);
  const out: RealisedGain[] = [];
  const threshold = LONG_TERM_MONTHS[meta.taxClass];
  for (const p of realised) {
    const longTerm = threshold != null && daysBetween(p.buyDate, p.sellDate) > threshold * 30.44;
    let taxCost = p.costPaise;
    // grandfathering: for equity/equity-fund bought on/before 31-Jan-2018 and sold long term,
    // cost = max(actual cost, min(FMV on 31-Jan-2018, sale value))
    const eligible = (meta.taxClass === "listed_equity" || meta.taxClass === "equity_fund") && longTerm && p.buyDate <= GF_DATE;
    if (eligible && meta.fmv2018Paise != null) {
      const fmvTotal = meta.fmv2018Paise * p.qty;
      taxCost = Math.max(p.costPaise, Math.min(fmvTotal, p.proceedsPaise));
    }
    out.push({
      assetName: meta.assetName, isin: meta.isin, taxClass: meta.taxClass,
      buyDate: p.buyDate, sellDate: p.sellDate, fy: fyOf(p.sellDate), qty: p.qty,
      costPaise: Math.round(p.costPaise), grandfatheredCostPaise: Math.round(taxCost),
      proceedsPaise: Math.round(p.proceedsPaise), gainPaise: Math.round(p.proceedsPaise - taxCost),
      longTerm, fmv2018Paise: eligible ? meta.fmv2018Paise : undefined,
    });
  }
  return out;
}

export interface GainsSummary {
  fy: string;
  shortTermPaise: number;
  longTermPaise: number;
  longTermEquityPaise: number; // 112A gains, for the ₹1.25L exemption
  totalPaise: number;
}

/** Totals per financial year, separating equity long-term (112A) for the exemption. */
export function summariseGains(gains: RealisedGain[]): GainsSummary[] {
  const byFy = new Map<string, GainsSummary>();
  for (const g of gains) {
    const s = byFy.get(g.fy) ?? { fy: g.fy, shortTermPaise: 0, longTermPaise: 0, longTermEquityPaise: 0, totalPaise: 0 };
    if (g.longTerm) {
      s.longTermPaise += g.gainPaise;
      if (g.taxClass === "listed_equity" || g.taxClass === "equity_fund") s.longTermEquityPaise += g.gainPaise;
    } else {
      s.shortTermPaise += g.gainPaise;
    }
    s.totalPaise += g.gainPaise;
    byFy.set(g.fy, s);
  }
  return [...byFy.values()].sort((a, b) => a.fy.localeCompare(b.fy));
}

export const LTCG_EQUITY_EXEMPT_PAISE = 12_500_000; // ₹1,25,000 a year, section 112A
