// Hindsight: "what happened to me" — computed from the family's own transactions and holdings.
// Everything here is real: realised gains come from the FIFO + tax engine, unrealised from the
// priced holdings. Parts that need daily price history (decision verdicts, vs-Nifty) are left for
// later; this module only returns what the current data can prove.
import { fyOf, LTCG_EQUITY_EXEMPT_PAISE, realisedGains, summariseGains, taxClassFor, type RealisedGain } from "./calc/gains";
import type { Tx } from "./calc/fifo";
import { sumFigures } from "./calc/figures";
import type { Holding, TxRow } from "./holdings";

const DEFAULT_INFLATION_PCT = 6;

export interface Contributor { name: string; gainPaise: number; pct: number | null; }
export interface Hindsight {
  fy: string;
  investedPaise: number;
  currentPaise: number;
  unrealisedPaise: number;
  unrealisedPct: number | null;
  realisedFyPaise: number; // booked gains this FY (tax definition)
  estTaxPaise: number; // estimated tax on this FY's booked gains
  shortTermPaise: number;
  longTermPaise: number;
  ltEquityPaise: number;
  harvestHeadroomPaise: number; // unused 112A exemption
  incomeFyPaise: number; // dividends + interest booked this FY
  xirrPct: number | null;
  fdPct: number;
  realAfterInflationPct: number | null; // XIRR less inflation
  winners: Contributor[];
  draggers: Contributor[];
  gainHoldings: number;
  lossHoldings: number;
}

const toTx = (r: TxRow): Tx => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  type: r.type,
  date: r.trade_date,
  quantity: Number(r.quantity),
  pricePaise: Number(r.price_paise),
  amountPaise: Number(r.amount_paise),
  chargesPaise: Number(r.charges_paise),
});

/** Estimated tax on one FY's realised gains. Rates are editable defaults (PRD): equity STCG 20%,
 * equity LTCG 12.5% over the ₹1.25L 112A exemption, everything else at a 30% slab assumption. */
function estTax(gains: RealisedGain[]): number {
  let equityST = 0, lt112A = 0, otherGain = 0;
  for (const g of gains) {
    const equity = g.taxClass === "listed_equity" || g.taxClass === "equity_fund";
    if (equity && g.longTerm) lt112A += g.gainPaise;
    else if (equity) equityST += Math.max(0, g.gainPaise);
    else otherGain += Math.max(0, g.gainPaise);
  }
  const ltTaxable = Math.max(0, lt112A - LTCG_EQUITY_EXEMPT_PAISE);
  return Math.round(equityST * 0.2 + ltTaxable * 0.125 + otherGain * 0.3);
}

export function computeHindsight(holdings: Holding[], rows: TxRow[], asOf: string, xirrPct: number | null): Hindsight {
  const fy = fyOf(asOf);
  const totals = sumFigures(holdings.map((h) => h.fig));
  const invested = totals.investedPaise;
  const current = totals.currentPaise ?? invested;

  // realised gains across every asset, tax-classified, then narrowed to this FY
  const byAsset = new Map<string, TxRow[]>();
  rows.forEach((r) => byAsset.set(r.asset_id, [...(byAsset.get(r.asset_id) ?? []), r]));
  const allGains: RealisedGain[] = [];
  for (const txs of byAsset.values()) {
    const a = txs[0].asset;
    const firstBuy = txs.map((t) => t.trade_date).sort()[0];
    const taxClass = taxClassFor(a.asset_class, { firstBuy });
    allGains.push(...realisedGains(txs.map(toTx), { assetName: a.name, isin: a.isin, taxClass }));
  }
  const fyGains = allGains.filter((g) => g.fy === fy);
  const summary = summariseGains(fyGains)[0] ?? { shortTermPaise: 0, longTermPaise: 0, longTermEquityPaise: 0, totalPaise: 0 };
  const estTaxPaise = estTax(fyGains);
  const harvestHeadroom = Math.max(0, LTCG_EQUITY_EXEMPT_PAISE - summary.longTermEquityPaise);

  // income booked this FY
  const incomeFy = rows
    .filter((r) => (r.type === "dividend" || r.type === "interest") && fyOf(r.trade_date) === fy)
    .reduce((s, r) => s + Number(r.amount_paise), 0);

  // gain contributors by unrealised gain
  const priced = holdings.filter((h) => h.fig.unrealisedPaise != null);
  const ranked = [...priced].sort((a, b) => (b.fig.unrealisedPaise ?? 0) - (a.fig.unrealisedPaise ?? 0));
  const toContrib = (h: Holding): Contributor => ({ name: h.name, gainPaise: h.fig.unrealisedPaise ?? 0, pct: h.fig.unrealisedPct });
  const winners = ranked.filter((h) => (h.fig.unrealisedPaise ?? 0) > 0).slice(0, 3).map(toContrib);
  const draggers = ranked.filter((h) => (h.fig.unrealisedPaise ?? 0) < 0).slice(-3).reverse().map(toContrib);

  const fdPct = 7;
  const real = xirrPct == null ? null : xirrPct - DEFAULT_INFLATION_PCT;

  return {
    fy,
    investedPaise: invested,
    currentPaise: current,
    unrealisedPaise: current - invested,
    unrealisedPct: invested ? ((current - invested) / invested) * 100 : null,
    realisedFyPaise: summary.totalPaise,
    estTaxPaise,
    shortTermPaise: summary.shortTermPaise,
    longTermPaise: summary.longTermPaise,
    ltEquityPaise: summary.longTermEquityPaise,
    harvestHeadroomPaise: harvestHeadroom,
    incomeFyPaise: incomeFy,
    xirrPct,
    fdPct,
    realAfterInflationPct: real,
    winners,
    draggers,
    gainHoldings: priced.filter((h) => (h.fig.unrealisedPaise ?? 0) > 0).length,
    lossHoldings: priced.filter((h) => (h.fig.unrealisedPaise ?? 0) < 0).length,
  };
}
