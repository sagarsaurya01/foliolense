# Vivek Bajaj view — method, rules and sources

The "Vivek Bajaj" view runs each holding through his **public, data-based momentum / relative-strength
method** and returns a verdict (buy / add / hold / trim / sell / exit) with the number behind it.

This is his **publicly taught** approach, not his private paid-course thresholds — so every rule below
is pinned to a source where he says it, and the thresholds are tunable. It ships as *"signals, in the
Vivek Bajaj style"* with a disclaimer, not as investment advice.

Every signal is computed in code from `price_history` (daily OHLC, volume, delivery) + the Nifty 50
series. The AI only words the result; the number always decides.

## Signals (the "data" he means)

| Signal | How we compute it | Source |
|---|---|---|
| Trend | close vs **50-DMA** and **200-DMA** | Exit video: 21/55/100/200 MAs |
| Relative strength (RS) | stock 6-month return − Nifty 6-month return | RS55 / StockEdge RS scans |
| RS improving? | stock 1-month return − Nifty 1-month return > 0 | position-sizing post |
| RSI(14) | standard 14-day RSI; >70 = overbought | weekly-research post (RSI 70) |
| Distance from 52-week high | (close − 250-day high) / high | momentum webinar |
| Delivery % | avg of last 20 days' delivery % | his emphasis on delivery |
| Market regime | **Nifty vs its own 200-DMA** → risk-on / risk-off | "aggressive above 200-DMA" |

## Verdict rules (each maps to a signal, tunable)

1. **EXIT** — close **below its 200-DMA** and **lagging the Nifty** (RS < 0). *Trend broken + laggard — cut it.*
2. **SELL / reduce** — close **below its 50-DMA** and RS **not improving**. *Lost its 50-DMA, momentum fading.*
3. **TRIM / book part** — strong (RS > 0, above both DMAs) but **overextended** (RSI > 75 or >20% above the 50-DMA). *Book part, let the rest run — reduce when momentum weakens.*
4. **ADD** — **leader** (RS > 0 and improving), above both DMAs, and the market is **risk-on** (Nifty above its 200-DMA). *Add on strength — his position-sizing rule.*
5. **HOLD** — above its 200-DMA and still working, none of the above. *In the trend; sit tight.*

When the market is **risk-off** (Nifty below its 200-DMA), ADD is held back to HOLD and the note turns
cautious — his "be aggressive only above the 200-DMA" rule.

Stocks with **less than ~200 days of history** can't have a 200-DMA, so they return HOLD with a
"not enough history yet" note rather than a false signal.

## Sources
- Exit with Supertrend + moving averages: https://www.elearnmarkets.com/learn2trade/details/how-to-exit-the-stock-at-the-right-time-using-supertrend-indicator
- Relative-strength scans: https://blog.stockedge.com/relative-strength-rs/
- Weekly research (RSI 70, delivery, breakout): https://blog.stockedge.com/weekly-market-research-with-stockedge-scans/
- Momentum strategies webinar: https://www.elearnmarkets.com/webinars/my-7-momentum-investing-profitable-strategies
- Aggressive above the 200-DMA: https://www.inkl.com/news/why-vivek-bajaj-is-waiting-for-a-momentum-market
