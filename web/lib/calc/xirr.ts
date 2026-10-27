// XIRR: the annual rate r where Σ amount / (1+r)^(days/365) = 0 (PRD 7.3). Same convention as Excel.

export interface Flow {
  date: string; // YYYY-MM-DD
  amount: number; // negative = money in, positive = money out (any unit, e.g. paise)
}

const DAY = 86_400_000;

/** Returns the rate as a fraction (0.12 = 12%), or NaN when there is no answer. */
export function xirr(flows: Flow[]): number {
  const fs = flows.filter((f) => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (fs.length < 2 || !fs.some((f) => f.amount < 0) || !fs.some((f) => f.amount > 0)) return NaN;
  const t0 = Date.parse(fs[0].date + "T00:00:00Z");
  const years = fs.map((f) => (Date.parse(f.date + "T00:00:00Z") - t0) / DAY / 365);
  const npv = (r: number) => fs.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, years[i]), 0);
  const dnpv = (r: number) => fs.reduce((s, f, i) => s - (years[i] * f.amount) / Math.pow(1 + r, years[i] + 1), 0);

  // Newton-Raphson from 10%
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const v = npv(r);
    const d = dnpv(r);
    if (!isFinite(v) || !isFinite(d) || d === 0) break;
    const next = r - v / d;
    if (!isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  // fall back to bisection over -99.99% … +10000%
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo);
  if (flo * npv(hi) > 0) return NaN;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
