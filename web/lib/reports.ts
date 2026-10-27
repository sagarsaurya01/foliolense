// Builds the report data from a portfolio/family's transactions (PRD S13). Pure.
import { classInfo } from "./assetClasses";
import { figures } from "./calc/figures";
import { buildLots, type Tx, type TxType } from "./calc/fifo";
import { realisedGains, summariseGains, taxClassFor, type RealisedGain, type GainsSummary } from "./calc/gains";
import type { TxRow } from "./holdings";

const toTx = (r: TxRow): Tx => ({
  id: r.id, portfolioId: r.portfolio_id, type: r.type, date: r.trade_date,
  quantity: Number(r.quantity), pricePaise: Number(r.price_paise),
  amountPaise: Number(r.amount_paise), chargesPaise: Number(r.charges_paise),
});

function groupByAsset(rows: TxRow[]): Map<string, TxRow[]> {
  const m = new Map<string, TxRow[]>();
  rows.forEach((r) => m.set(r.asset_id, [...(m.get(r.asset_id) ?? []), r]));
  return m;
}

/** All realised capital-gain pieces across the rows, ready to filter by FY. */
export function allRealisedGains(rows: TxRow[], fmvByIsin?: Map<string, number>): RealisedGain[] {
  const out: RealisedGain[] = [];
  for (const [, txs] of groupByAsset(rows)) {
    const a = txs[0].asset;
    if (classInfo(a.asset_class).balance) continue; // deposits have no capital gains
    const firstBuy = txs.map((t) => t.trade_date).sort()[0];
    const isSgb = /\bSGB\b|sovereign gold/i.test(a.name);
    const taxClass = taxClassFor(a.asset_class, { subType: isSgb ? "SGB" : undefined, firstBuy });
    const fmv = a.isin ? fmvByIsin?.get(a.isin) : undefined;
    out.push(...realisedGains(txs.map(toTx), { assetName: a.name, isin: a.isin, taxClass, fmv2018Paise: fmv }));
  }
  return out.sort((x, y) => y.sellDate.localeCompare(x.sellDate));
}

export function gainsSummary(rows: TxRow[], fmvByIsin?: Map<string, number>): GainsSummary[] {
  return summariseGains(allRealisedGains(rows, fmvByIsin));
}

/** Holdings as they stood on a past date: process only transactions up to that date. */
export interface HoldingAsOn { name: string; cls: string; isin: string | null; qty: number; costPaise: number }
export function holdingsAsOn(rows: TxRow[], onDate: string): HoldingAsOn[] {
  const out: HoldingAsOn[] = [];
  for (const [, txs] of groupByAsset(rows)) {
    const a = txs[0].asset;
    const balance = !!classInfo(a.asset_class).balance;
    const upto = txs.filter((t) => t.trade_date <= onDate);
    if (!upto.length) continue;
    const { lots } = buildLots(upto.map(toTx), balance);
    const f = figures(lots, balance, {});
    if (f.qty <= 1e-9 && f.investedPaise <= 0) continue;
    out.push({ name: a.name, cls: a.asset_class, isin: a.isin, qty: f.qty, costPaise: f.investedPaise });
  }
  return out.sort((x, y) => y.costPaise - x.costPaise);
}

/** Dividend and interest received, by FY (PRD income report). */
export interface IncomeRow { date: string; fy: string; asset: string; kind: "dividend" | "interest"; amountPaise: number }
const fyOf = (d: string) => { const [y, m] = d.split("-").map(Number); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
export function incomeRows(rows: TxRow[]): IncomeRow[] {
  return rows
    .filter((r) => r.type === "dividend" || r.type === "interest")
    .map((r) => ({ date: r.trade_date, fy: fyOf(r.trade_date), asset: r.asset.name, kind: r.type as "dividend" | "interest", amountPaise: Number(r.amount_paise) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Every transaction, newest first (transaction register). */
export interface RegisterRow { date: string; portfolio: string; asset: string; cls: string; type: TxType; qty: number; pricePaise: number; amountPaise: number }
export function registerRows(rows: TxRow[], portName: (id: string) => string): RegisterRow[] {
  return rows
    .map((r) => ({
      date: r.trade_date, portfolio: portName(r.portfolio_id), asset: r.asset.name, cls: r.asset.asset_class,
      type: r.type, qty: Number(r.quantity), pricePaise: Number(r.price_paise), amountPaise: Number(r.amount_paise),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
