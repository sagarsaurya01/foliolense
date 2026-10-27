// Futures & Options profit and loss (PRD 7.4). Unlike equity, an F&O position can be opened by a
// SELL (short) as well as a BUY, so matching tracks a signed position: a trade in the opposite
// direction to the open lots closes them (realised P&L); a same-direction trade adds a lot.
// Money in paise. Quantities are whole units (lots × lot size).

export type Instrument = "FUT" | "CE" | "PE";

export interface FnoTrade {
  underlying: string; // NIFTY, BANKNIFTY, RELIANCE…
  instrument: Instrument;
  expiry: string; // YYYY-MM-DD
  strikePaise?: number; // options only
  segment: "stock" | "other"; // index/stock F&O vs currency/commodity
  date: string;
  side: "buy" | "sell";
  quantity: number;
  pricePaise: number; // per unit
}

export function contractKey(t: Pick<FnoTrade, "underlying" | "instrument" | "expiry" | "strikePaise">): string {
  return [t.underlying, t.instrument, t.expiry, t.strikePaise ?? ""].join("|");
}

export const contractLabel = (t: Pick<FnoTrade, "underlying" | "instrument" | "expiry" | "strikePaise">) => {
  const d = t.expiry.split("-");
  const exp = `${d[2]}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+d[1] - 1]}-${d[0].slice(2)}`;
  if (t.instrument === "FUT") return `${t.underlying} ${exp} FUT`;
  return `${t.underlying} ${exp} ${t.strikePaise != null ? (t.strikePaise / 100).toLocaleString("en-IN") : ""} ${t.instrument}`;
};

export interface RealisedFno {
  key: string;
  qty: number;
  openDate: string;
  closeDate: string;
  openPricePaise: number;
  closePricePaise: number;
  pnlPaise: number; // realised
  wasShort: boolean;
}

export interface OpenFno {
  key: string;
  underlying: string;
  instrument: Instrument;
  expiry: string;
  strikePaise?: number;
  segment: "stock" | "other";
  qty: number; // signed: + long, - short
  avgPricePaise: number; // of the open quantity
}

export interface FnoResult {
  realised: RealisedFno[];
  open: OpenFno[];
  /** turnover per FY for the tax-audit check: sum of absolute realised P&L (ICAI guidance) */
  turnoverPaiseByFy: Record<string, number>;
}

const EPS = 1e-9;
const fyOf = (d: string) => { const [y, m] = d.split("-").map(Number); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };

type Lot = { qty: number; pricePaise: number; date: string }; // qty signed

/** Build realised P&L, open positions and turnover from F&O trades (all contracts). */
export function computeFno(trades: FnoTrade[]): FnoResult {
  const byKey = new Map<string, FnoTrade[]>();
  for (const t of trades) byKey.set(contractKey(t), [...(byKey.get(contractKey(t)) ?? []), t]);

  const realised: RealisedFno[] = [];
  const open: OpenFno[] = [];
  const turnover: Record<string, number> = {};

  for (const [key, group] of byKey) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const lots: Lot[] = []; // signed FIFO queue, all same sign at any time
    for (const t of sorted) {
      let signed = (t.side === "buy" ? 1 : -1) * t.quantity;
      // close against opposite-sign lots first
      while (Math.abs(signed) > EPS && lots.length && Math.sign(lots[0].qty) !== Math.sign(signed)) {
        const lot = lots[0];
        const take = Math.min(Math.abs(lot.qty), Math.abs(signed));
        const wasShort = lot.qty < 0;
        // P&L: long closed by sell = (sell-buy)*qty; short closed by buy = (sell-buy)*qty
        const openPrice = lot.pricePaise;
        const closePrice = t.pricePaise;
        const pnl = (wasShort ? openPrice - closePrice : closePrice - openPrice) * take;
        realised.push({
          key, qty: take, openDate: lot.date, closeDate: t.date,
          openPricePaise: openPrice, closePricePaise: closePrice, pnlPaise: Math.round(pnl), wasShort,
        });
        turnover[fyOf(t.date)] = (turnover[fyOf(t.date)] ?? 0) + Math.abs(Math.round(pnl));
        lot.qty += Math.sign(lot.qty) * -take; // reduce magnitude toward zero
        signed += Math.sign(signed) * -take;
        if (Math.abs(lot.qty) <= EPS) lots.shift();
      }
      if (Math.abs(signed) > EPS) lots.push({ qty: signed, pricePaise: t.pricePaise, date: t.date });
    }
    const netQty = lots.reduce((s, l) => s + l.qty, 0);
    if (Math.abs(netQty) > EPS) {
      const cost = lots.reduce((s, l) => s + l.qty * l.pricePaise, 0);
      const first = sorted[0];
      open.push({
        key, underlying: first.underlying, instrument: first.instrument, expiry: first.expiry,
        strikePaise: first.strikePaise, segment: first.segment, qty: netQty, avgPricePaise: Math.round(cost / netQty),
      });
    }
  }
  realised.sort((a, b) => b.closeDate.localeCompare(a.closeDate));
  return { realised, open, turnoverPaiseByFy: turnover };
}

/** Unrealised P&L of an open position at a settlement/last price. */
export function unrealisedPnl(o: OpenFno, lastPricePaise: number): number {
  return Math.round((lastPricePaise - o.avgPricePaise) * o.qty);
}
