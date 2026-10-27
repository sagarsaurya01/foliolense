// Display figures for one holding (PRD 7.2). Totals are always sums of rupees, never of percentages.
import type { Lot } from "./fifo";

export interface Figures {
  qty: number;
  investedPaise: number;
  avgPaise: number;
  currentPaise: number | null; // null = no price yet
  todayPaise: number | null;
  todayPct: number | null;
  unrealisedPaise: number | null;
  unrealisedPct: number | null;
}

export interface PriceInfo {
  pricePaise?: number | null; // per unit
  prevPaise?: number | null; // previous close, per unit
  valuePaise?: number | null; // whole-holding value for balance types
  prevValuePaise?: number | null;
}

export function figures(lots: Lot[], balance: boolean, p: PriceInfo): Figures {
  const qty = lots.reduce((s, l) => s + l.qty, 0);
  const investedPaise = lots.reduce((s, l) => s + l.costPaise, 0);
  const avgPaise = !balance && qty > 0 ? investedPaise / qty : 0;

  let current: number | null = null;
  let prev: number | null = null;
  if (balance) {
    current = p.valuePaise ?? investedPaise; // a deposit with no valuation is worth what went in
    prev = p.prevValuePaise ?? current;
  } else if (p.pricePaise != null) {
    current = qty * p.pricePaise;
    prev = qty * (p.prevPaise ?? p.pricePaise);
  }
  const today = current == null || prev == null ? null : current - prev;
  const unrl = current == null ? null : current - investedPaise;
  return {
    qty,
    investedPaise,
    avgPaise,
    currentPaise: current,
    todayPaise: today,
    todayPct: today == null || !prev ? null : (today / prev) * 100,
    unrealisedPaise: unrl,
    unrealisedPct: unrl == null || !investedPaise ? null : (unrl / investedPaise) * 100,
  };
}

/**
 * Adds rows. A holding with no price yet is counted at its cost (so one unpriced holding doesn't
 * blank the whole total); today's gain counts only priced holdings. `unpricedCount` lets the UI
 * say how many are held at cost. `currentPaise` is null only when nothing has any cost at all.
 */
export function sumFigures(rows: Figures[]) {
  const invested = rows.reduce((s, r) => s + r.investedPaise, 0);
  // unpriced holdings contribute their invested cost to current value (no gain/loss shown on them)
  const current = rows.length ? rows.reduce((s, r) => s + (r.currentPaise ?? r.investedPaise), 0) : null;
  const today = rows.reduce((s, r) => s + (r.todayPaise ?? 0), 0);
  const unrl = current == null ? null : current - invested;
  const prevForToday = current == null ? 0 : current - today;
  return {
    investedPaise: invested,
    currentPaise: current,
    todayPaise: today,
    todayPct: !prevForToday ? null : (today / prevForToday) * 100,
    unrealisedPaise: unrl,
    unrealisedPct: unrl == null || !invested ? null : (unrl / invested) * 100,
    pricedCount: rows.filter((r) => r.currentPaise != null).length,
    unpricedCount: rows.filter((r) => r.currentPaise == null).length,
  };
}
