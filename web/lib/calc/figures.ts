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

/** Adds rows; current/today/unrealised are null as soon as any row lacks a price. */
export function sumFigures(rows: Figures[]) {
  const invested = rows.reduce((s, r) => s + r.investedPaise, 0);
  const priced = rows.every((r) => r.currentPaise != null);
  const current = priced ? rows.reduce((s, r) => s + (r.currentPaise ?? 0), 0) : null;
  const today = priced ? rows.reduce((s, r) => s + (r.todayPaise ?? 0), 0) : null;
  const unrl = current == null ? null : current - invested;
  return {
    investedPaise: invested,
    currentPaise: current,
    todayPaise: today,
    todayPct: today == null || current == null || current - today === 0 ? null : (today / (current - today)) * 100,
    unrealisedPaise: unrl,
    unrealisedPct: unrl == null || !invested ? null : (unrl / invested) * 100,
    pricedCount: rows.filter((r) => r.currentPaise != null).length,
  };
}
