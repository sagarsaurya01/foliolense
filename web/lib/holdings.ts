// Turns transaction rows from the database into holdings, totals and XIRR for one view
// (a portfolio, a group or the whole family). Pure: the page passes data in.
import { classInfo } from "./assetClasses";
import { depositValue, type DepositTerms } from "./calc/deposits";
import { buildLots, daysBetween, type Lot, type RealisedPiece, type Tx, type TxType } from "./calc/fifo";
import { figures, sumFigures, type Figures } from "./calc/figures";
import { xirr, type Flow } from "./calc/xirr";

/** What the user can store on an asset until daily prices arrive (Phase 2). Lives in assets.meta. */
export interface AssetMeta {
  price_paise?: number;
  prev_price_paise?: number;
  price_date?: string;
  value_paise?: number; // balance types: current value as entered
  deposit?: DepositTerms; // FD / loans given: value is calculated
}

export interface TxRow {
  id: string;
  portfolio_id: string;
  asset_id: string;
  type: TxType;
  trade_date: string;
  quantity: number;
  price_paise: number;
  amount_paise: number;
  charges_paise: number;
  notes: string | null;
  asset: { id: string; name: string; asset_class: string; isin: string | null; meta: AssetMeta | null };
}

export interface Holding {
  assetId: string;
  name: string;
  cls: string;
  balance: boolean;
  meta: AssetMeta;
  lots: Lot[];
  realised: RealisedPiece[];
  warnings: string[];
  fig: Figures;
  owners: string[];
  isin: string | null;
  live: { priceDate: string } | null; // set when the price came from the daily feed
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

/** isin -> latest close from the daily feed (instrument_prices). */
export type FeedPrices = Map<string, { close_paise: number; prev_close_paise: number | null; price_date: string }>;

export function buildHoldings(rows: TxRow[], asOf: string, feed?: FeedPrices): Holding[] {
  const byAsset = new Map<string, TxRow[]>();
  rows.forEach((r) => byAsset.set(r.asset_id, [...(byAsset.get(r.asset_id) ?? []), r]));
  const out: Holding[] = [];
  for (const [assetId, txs] of byAsset) {
    const a = txs[0].asset;
    const balance = !!classInfo(a.asset_class).balance;
    const meta = a.meta ?? {};
    const { lots, realised, warnings } = buildLots(txs.map(toTx), balance);
    if (!lots.length && !realised.length) continue;
    // a linked holding (its asset has an ISIN in the feed) uses the daily price; otherwise the typed-in one
    const live = a.isin ? feed?.get(a.isin) : undefined;
    let value: number | null = null;
    if (balance) {
      if (meta.deposit) value = lots.reduce((s, l) => s + depositValue(l.costPaise, { ...meta.deposit!, start: l.date }, asOf), 0);
      else if (meta.value_paise != null) value = meta.value_paise;
    }
    const fig = figures(lots, balance, {
      pricePaise: live ? live.close_paise : meta.price_paise,
      prevPaise: live ? (live.prev_close_paise ?? live.close_paise) : meta.prev_price_paise,
      valuePaise: value,
      prevValuePaise: value,
    });
    out.push({
      assetId, name: a.name, cls: a.asset_class, balance, meta, lots, realised, warnings, fig,
      owners: [...new Set(lots.map((l) => l.portfolioId))],
      isin: a.isin, live: live ? { priceDate: live.price_date } : null,
    });
  }
  return out;
}

/** Cash flows for XIRR: money put in is negative, money taken out (and today's value) positive. */
export function flowsFor(rows: TxRow[], holdings: Holding[], asOf: string): Flow[] | null {
  const current = sumFigures(holdings.map((h) => h.fig)).currentPaise;
  if (current == null) return null; // some holding has no price: XIRR would be wrong
  const flows: Flow[] = [];
  for (const r of rows) {
    const amt = Number(r.amount_paise);
    const ch = Number(r.charges_paise);
    if (["buy", "deposit", "opening", "merge_in"].includes(r.type)) flows.push({ date: r.trade_date, amount: -(amt + ch) });
    else if (["sell", "withdraw"].includes(r.type)) flows.push({ date: r.trade_date, amount: amt - ch });
    else if (["dividend", "interest"].includes(r.type)) flows.push({ date: r.trade_date, amount: amt });
    else if (r.type === "charges") flows.push({ date: r.trade_date, amount: -amt });
  }
  flows.push({ date: asOf, amount: current });
  return flows;
}

export function xirrPct(rows: TxRow[], holdings: Holding[], asOf: string): number | null {
  const f = flowsFor(rows, holdings, asOf);
  if (!f) return null;
  const r = xirr(f);
  return isFinite(r) ? r * 100 : null;
}

/** Equity-type holdings become long term after 12 months, others after 24 (PRD 7.5 default rows). */
export function termOf(cls: string, buyDate: string, asOf: string) {
  const days = daysBetween(buyDate, asOf);
  const equity = cls === "EQ" || cls === "MFE" || cls === "SIF";
  return { days, long: days > (equity ? 365 : 730) };
}

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
