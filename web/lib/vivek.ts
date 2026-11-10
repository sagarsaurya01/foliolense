// Vivek Bajaj view — his public, data-based momentum / relative-strength method applied to a holding.
// Code computes the signals from daily price history; the words only explain them. See docs/vivek-method.md
// for the rule->source mapping. Thresholds are named constants so they can be tuned.
// This is "signals in his style", not investment advice.

export type Verdict = "buy" | "add" | "hold" | "trim" | "sell" | "exit";

/** One daily bar from price_history (prices in rupees here; the data layer stores paise). */
export interface Bar {
  date: string; // YYYY-MM-DD, ascending
  close: number;
  high?: number;
  delivPct?: number | null;
}

export interface VivekSignals {
  close: number;
  dma50: number | null;
  dma200: number | null;
  rs6mPct: number | null; // stock 6-mo return minus Nifty 6-mo return
  rsImproving: boolean | null; // stock 1-mo return beating Nifty 1-mo return
  rsi14: number | null;
  fromHighPct: number | null; // distance from the 250-day high, <= 0
  delivAvg: number | null; // avg delivery % over the last 20 days
  regimeRiskOn: boolean; // Nifty above its own 200-DMA
  bars: number; // how many bars we had
}

export interface VivekVerdict {
  isin: string;
  symbol: string;
  name: string;
  verdict: Verdict;
  headline: string; // short label: "Exit", "Trim", ...
  reason: string; // one plain line with the numbers behind it
  signals: VivekSignals;
}

// tunable thresholds (defaults from his public method)
const DMA_FAST = 50;
const DMA_SLOW = 200;
const RS_WINDOW = 125; // ~6 months of trading days
const RS_RECENT = 20; // ~1 month
const RSI_LEN = 14;
const RSI_OVERBOUGHT = 75;
const EXTENDED_ABOVE_50 = 0.2; // >20% above the 50-DMA = overextended
const HIGH_WINDOW = 250; // 52 weeks

const last = <T>(a: T[]): T => a[a.length - 1];

function sma(bars: Bar[], n: number): number | null {
  if (bars.length < n) return null;
  let s = 0;
  for (let i = bars.length - n; i < bars.length; i++) s += bars[i].close;
  return s / n;
}

/** percent return over the last n bars (close now vs close n bars ago) */
function retPct(bars: Bar[], n: number): number | null {
  if (bars.length <= n) return null;
  const now = last(bars).close;
  const then = bars[bars.length - 1 - n].close;
  if (!then) return null;
  return (now / then - 1) * 100;
}

function rsi(bars: Bar[], n: number): number | null {
  if (bars.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = bars.length - n; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

function highest(bars: Bar[], n: number): number {
  let hi = 0;
  for (let i = Math.max(0, bars.length - n); i < bars.length; i++) {
    hi = Math.max(hi, bars[i].high ?? bars[i].close);
  }
  return hi;
}

function avgDelivery(bars: Bar[], n: number): number | null {
  const slice = bars.slice(-n).map((b) => b.delivPct).filter((d): d is number => d != null);
  if (!slice.length) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Nifty is "risk-on" when its close is above its own 200-DMA. */
export function regimeRiskOn(nifty: Bar[]): boolean {
  const d200 = sma(nifty, DMA_SLOW);
  if (d200 == null) return true; // not enough index history -> don't force a defensive stance
  return last(nifty).close >= d200;
}

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** Compute a Vivek-Bajaj verdict for each item. `bars` and `nifty` are ascending daily closes. */
export function computeVivek(
  items: { isin: string; symbol: string; name: string; bars: Bar[] }[],
  nifty: Bar[],
): VivekVerdict[] {
  const riskOn = regimeRiskOn(nifty);
  const niftyRet6 = retPct(nifty, RS_WINDOW);
  const niftyRet1 = retPct(nifty, RS_RECENT);

  return items.map(({ isin, symbol, name, bars }) => {
    const close = bars.length ? last(bars).close : 0;
    const dma50 = sma(bars, DMA_FAST);
    const dma200 = sma(bars, DMA_SLOW);
    const stockRet6 = retPct(bars, RS_WINDOW);
    const stockRet1 = retPct(bars, RS_RECENT);
    const rs6mPct = stockRet6 != null && niftyRet6 != null ? stockRet6 - niftyRet6 : null;
    const rsImproving = stockRet1 != null && niftyRet1 != null ? stockRet1 - niftyRet1 > 0 : null;
    const rsi14 = rsi(bars, RSI_LEN);
    const hi = highest(bars, HIGH_WINDOW);
    const fromHighPct = hi ? (close / hi - 1) * 100 : null;
    const delivAvg = avgDelivery(bars, RS_RECENT);

    const signals: VivekSignals = {
      close, dma50, dma200, rs6mPct, rsImproving, rsi14, fromHighPct, delivAvg,
      regimeRiskOn: riskOn, bars: bars.length,
    };

    let verdict: Verdict;
    let headline: string;
    let reason: string;

    const belowSlow = dma200 != null && close < dma200;
    const belowFast = dma50 != null && close < dma50;
    const leader = rs6mPct != null && rs6mPct > 0;
    const laggard = rs6mPct != null && rs6mPct < 0;
    const overextended = (rsi14 != null && rsi14 > RSI_OVERBOUGHT) || (dma50 != null && close > dma50 * (1 + EXTENDED_ABOVE_50));

    if (dma200 == null) {
      verdict = "hold";
      headline = "Hold";
      reason = `Only ${bars.length} days of history — not enough for the 200-day trend yet. He'd wait for more data.`;
    } else if (belowSlow && laggard) {
      verdict = "exit";
      headline = "Exit";
      reason = `Below its 200-day average and lagging the Nifty by ${fmtPct(rs6mPct!)} over 6 months — trend broken, he'd exit.`;
    } else if (belowFast && rsImproving === false) {
      verdict = "sell";
      headline = "Reduce";
      reason = `Lost its 50-day average and momentum is fading (trailing the Nifty lately) — he'd trim or sell.`;
    } else if (leader && !belowFast && !belowSlow && overextended) {
      verdict = "trim";
      headline = "Trim";
      const why = rsi14 != null && rsi14 > RSI_OVERBOUGHT ? `RSI ${rsi14.toFixed(0)} (overbought)` : `${fmtPct(((close / dma50!) - 1) * 100)} above its 50-day average`;
      reason = `Strong leader (${fmtPct(rs6mPct!)} vs Nifty) but overextended — ${why}. Book part, let the rest run.`;
    } else if (leader && rsImproving && !belowFast && !belowSlow && riskOn) {
      verdict = "add";
      headline = "Add";
      reason = `Leader in an uptrend (${fmtPct(rs6mPct!)} vs Nifty, above both averages) with the market risk-on — add on strength.`;
    } else {
      verdict = "hold";
      headline = "Hold";
      const rel = rs6mPct != null ? `${fmtPct(rs6mPct)} vs Nifty` : "in line with the Nifty";
      reason = riskOn
        ? `In its uptrend and still working (${rel}) — sit tight.`
        : `Holding up (${rel}), but the Nifty is below its 200-day average — he'd stay defensive, not add.`;
    }

    return { isin, symbol, name, verdict, headline, reason, signals };
  });
}
