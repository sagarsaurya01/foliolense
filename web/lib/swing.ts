// Swing trading engine (2-5 day holds). Runs on daily OHLC — the data we already have — and gives each
// stock a trade status with entry / stop-loss / target levels. Breakout + trend + ATR-based risk.
// Code computes the levels; the words only explain them. Signals, not advice.

export type SwingStatus = "breakout" | "hold" | "watch" | "avoid";

export interface SwingBar {
  date: string; // ascending
  high: number;
  low: number;
  close: number;
}

export interface SwingSignal {
  isin: string;
  symbol: string;
  name: string;
  status: SwingStatus;
  headline: string; // "Breakout", "Hold", "Watch", "Avoid"
  close: number;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rr: number | null; // reward : risk
  reason: string;
}

const BREAK_LOOKBACK = 20; // 20-day high = the breakout level
const ATR_LEN = 14;
const SWING_LOW = 5; // recent swing low for the stop
const RR = 2; // target at 2x the risk
const NEAR = 0.97; // within 3% of the 20-day high = "watch"

const last = <T>(a: T[]): T => a[a.length - 1];

function sma(bars: SwingBar[], n: number): number | null {
  if (bars.length < n) return null;
  let s = 0;
  for (let i = bars.length - n; i < bars.length; i++) s += bars[i].close;
  return s / n;
}

function atr(bars: SwingBar[], n: number): number | null {
  if (bars.length <= n) return null;
  let s = 0;
  for (let i = bars.length - n; i < bars.length; i++) {
    const pc = bars[i - 1].close;
    s += Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - pc), Math.abs(bars[i].low - pc));
  }
  return s / n;
}

/** highest high of the `n` bars BEFORE the last bar (the level a breakout clears) */
function priorHigh(bars: SwingBar[], n: number): number {
  let hi = 0;
  for (let i = Math.max(0, bars.length - 1 - n); i < bars.length - 1; i++) hi = Math.max(hi, bars[i].high);
  return hi;
}

function recentLow(bars: SwingBar[], n: number): number | null {
  let lo = Infinity;
  for (let i = Math.max(0, bars.length - n); i < bars.length; i++) lo = Math.min(lo, bars[i].low);
  return lo === Infinity ? null : lo;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeSwing(items: { isin: string; symbol: string; name: string; bars: SwingBar[] }[]): SwingSignal[] {
  return items.map(({ isin, symbol, name, bars }) => {
    const close = bars.length ? last(bars).close : 0;
    const dma20 = sma(bars, BREAK_LOOKBACK);
    const a = atr(bars, ATR_LEN);
    const level = priorHigh(bars, BREAK_LOOKBACK);
    const sLow = recentLow(bars, SWING_LOW);

    const base = { isin, symbol, name, close } as const;

    if (bars.length < BREAK_LOOKBACK + ATR_LEN || dma20 == null || a == null || !level) {
      return { ...base, status: "watch", headline: "Watch", entry: null, stop: null, target: null, rr: null,
        reason: `Only ${bars.length} days of history — not enough to read a swing setup yet.` };
    }

    const aboveTrend = close > dma20;
    const brokeOut = close > level;
    const nearHigh = close >= level * NEAR;

    if (brokeOut && aboveTrend) {
      const entry = close;
      const stop = Math.max(sLow ?? entry - 1.5 * a, entry - 2 * a);
      const target = entry + RR * (entry - stop);
      return { ...base, status: "breakout", headline: "Breakout", entry: r2(entry), stop: r2(stop), target: r2(target), rr: RR,
        reason: `Broke above its 20-day high (₹${r2(level)}) with the trend up. Stop ₹${r2(stop)}, target ₹${r2(target)} (${RR}:1).` };
    }
    if (aboveTrend && nearHigh) {
      const entry = level;
      const stop = sLow ?? entry - 1.5 * a;
      const target = entry + RR * (entry - stop);
      return { ...base, status: "watch", headline: "Watch", entry: r2(entry), stop: r2(stop), target: r2(target), rr: RR,
        reason: `Coiling just under its 20-day high (₹${r2(level)}) — a close above it is the entry. Stop ₹${r2(stop)}.` };
    }
    if (aboveTrend) {
      const stop = sLow ?? r2(dma20);
      return { ...base, status: "hold", headline: "Hold", entry: null, stop: r2(stop), target: null, rr: null,
        reason: `In an uptrend above its 20-day average — hold the trade, trail the stop at ₹${r2(stop)}.` };
    }
    return { ...base, status: "avoid", headline: "Avoid", entry: null, stop: null, target: null, rr: null,
      reason: `Below its 20-day average (₹${r2(dma20)}) — no swing setup; stand aside or exit the trade.` };
  });
}
