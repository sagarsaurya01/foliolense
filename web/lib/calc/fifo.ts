// Holdings from transactions, oldest lots sold first (PRD 7.1). Pure functions: no I/O, fully tested.
// Money is in paise. Quantities are plain numbers (fund units carry 3–4 decimals).
//
// Balance-type assets (bank, FD, PPF…) have no units: their lots count rupees, so a lot's
// quantity equals its amount in paise, and a withdrawal takes amount off the oldest deposits.

export type TxType =
  | "buy" | "sell" | "deposit" | "withdraw" | "dividend" | "interest"
  | "bonus" | "split" | "merge_in" | "merge_out" | "charges" | "opening";

export interface Tx {
  id?: string;
  portfolioId: string;
  type: TxType;
  date: string; // YYYY-MM-DD
  quantity: number; // units; for "split" the multiplier (1:10 split = 10)
  pricePaise: number;
  amountPaise: number; // quantity × price for units; the amount for balance types
  chargesPaise: number;
}

export interface Lot {
  date: string;
  portfolioId: string;
  qty: number;
  costPaise: number; // purchase value + charges, for the qty still held
  txId?: string;
}

export interface RealisedPiece {
  buyDate: string;
  sellDate: string;
  portfolioId: string;
  qty: number;
  costPaise: number;
  proceedsPaise: number;
  gainPaise: number;
  days: number;
}

export interface LotResult {
  lots: Lot[];
  realised: RealisedPiece[];
  /** problems found, e.g. selling more than held; the excess is ignored */
  warnings: string[];
}

const EPS = 1e-9;
// same-day order: opening, then additions, then corporate actions, then removals
const ORDER: Record<TxType, number> = {
  opening: 0, buy: 1, deposit: 1, merge_in: 1, bonus: 2, split: 3,
  sell: 4, withdraw: 4, merge_out: 4, dividend: 5, interest: 5, charges: 5,
};

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export function sortTx<T extends Tx>(txs: T[]): T[] {
  return [...txs].sort((x, y) => x.date.localeCompare(y.date) || ORDER[x.type] - ORDER[y.type]);
}

/** Builds the open lots of ONE asset (all portfolios given are pooled per portfolio). */
export function buildLots(txs: Tx[], balance = false): LotResult {
  const lots: Lot[] = [];
  const realised: RealisedPiece[] = [];
  const warnings: string[] = [];

  for (const t of sortTx(txs)) {
    const units = balance ? t.amountPaise : t.quantity;
    switch (t.type) {
      case "opening":
      case "buy":
      case "deposit":
      case "merge_in":
        if (units > EPS) lots.push({ date: t.date, portfolioId: t.portfolioId, qty: units, costPaise: t.amountPaise + t.chargesPaise, txId: t.id });
        break;
      case "bonus":
        // bonus shares cost nothing; their holding period starts on the allotment date
        if (units > EPS) lots.push({ date: t.date, portfolioId: t.portfolioId, qty: units, costPaise: 0, txId: t.id });
        break;
      case "split":
        if (t.quantity > EPS)
          lots.filter((l) => l.portfolioId === t.portfolioId).forEach((l) => (l.qty *= t.quantity));
        break;
      case "sell":
      case "withdraw":
      case "merge_out": {
        let left = units;
        const held = lots.filter((l) => l.portfolioId === t.portfolioId).reduce((s, l) => s + l.qty, 0);
        if (left > held + EPS) {
          warnings.push(`${t.date}: ${t.type} of ${left} is more than the ${held} held; only ${held} counted`);
          left = held;
        }
        // proceeds are shared over the pieces in proportion to quantity
        const netProceeds = t.amountPaise - t.chargesPaise;
        const perUnit = units > EPS ? netProceeds / units : 0;
        for (let i = 0; i < lots.length && left > EPS; ) {
          const l = lots[i];
          if (l.portfolioId !== t.portfolioId) { i++; continue; }
          const take = Math.min(l.qty, left);
          const cost = (l.costPaise * take) / l.qty;
          const proceeds = perUnit * take;
          if (t.type !== "merge_out")
            realised.push({
              buyDate: l.date, sellDate: t.date, portfolioId: t.portfolioId, qty: take,
              costPaise: cost, proceedsPaise: proceeds, gainPaise: proceeds - cost, days: daysBetween(l.date, t.date),
            });
          l.qty -= take;
          l.costPaise -= cost;
          left -= take;
          if (l.qty <= EPS) lots.splice(i, 1);
          else i++;
        }
        break;
      }
      default:
        break; // dividend / interest / charges don't change holdings
    }
  }
  return { lots, realised, warnings };
}
