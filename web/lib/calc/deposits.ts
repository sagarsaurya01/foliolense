// Accrued value of deposits (PRD 7.6). Amounts in paise.
import { daysBetween } from "./fifo";

export interface DepositTerms {
  ratePct: number; // annual %, e.g. 7.1
  compounding: "quarterly" | "monthly" | "half-yearly" | "yearly" | "simple";
  start: string; // YYYY-MM-DD
  maturity?: string;
  payout?: boolean; // interest paid out: value stays at principal
}

const PER_YEAR = { monthly: 12, quarterly: 4, "half-yearly": 2, yearly: 1 } as const;

/** Value of `principalPaise` on `asOf` (interest stops at maturity). */
export function depositValue(principalPaise: number, t: DepositTerms, asOf: string): number {
  if (t.payout || t.ratePct <= 0) return principalPaise;
  const end = t.maturity && t.maturity < asOf ? t.maturity : asOf;
  const days = Math.max(0, daysBetween(t.start, end));
  const years = days / 365;
  const r = t.ratePct / 100;
  if (t.compounding === "simple") return principalPaise * (1 + r * years);
  const n = PER_YEAR[t.compounding];
  return principalPaise * Math.pow(1 + r / n, n * years);
}
