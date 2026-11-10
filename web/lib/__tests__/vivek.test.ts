import { describe, expect, it } from "vitest";
import { computeVivek, regimeRiskOn, type Bar } from "../vivek";

// build ascending daily bars from a list of closes
function bars(closes: number[], deliv = 55): Bar[] {
  const start = new Date("2025-01-01").getTime();
  return closes.map((close, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    close,
    high: close,
    delivPct: deliv,
  }));
}

// a gentle up-trending index: 260 bars, ~+15%, so its 200-DMA sits below the last close (risk-on)
const niftyUp = bars(Array.from({ length: 260 }, (_, i) => 100 + 15 * (i / 259) + Math.sin(i / 7)));
// a down-trending index: ends below its own 200-DMA (risk-off)
const niftyDown = bars(Array.from({ length: 260 }, (_, i) => 120 - 25 * (i / 259) + Math.sin(i / 7)));

function verdictOf(closes: number[], nifty = niftyUp) {
  return computeVivek([{ isin: "X", symbol: "TEST", name: "Test", bars: bars(closes) }], nifty)[0];
}

describe("computeVivek", () => {
  it("broken laggard (below 200-DMA, lagging Nifty) -> exit", () => {
    // rose to a peak mid-series, then fell back below its average
    const closes = Array.from({ length: 260 }, (_, i) => 100 + 45 * Math.sin((Math.PI * i) / 259));
    const v = verdictOf(closes);
    expect(v.verdict).toBe("exit");
    expect(v.signals.close).toBeLessThan(v.signals.dma200!);
    expect(v.signals.rs6mPct!).toBeLessThan(0);
  });

  it("strong leader is treated as strong (keep), never exit/sell", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + 40 * (i / 259) + 3 * Math.sin(i / 5));
    const v = verdictOf(closes);
    expect(["add", "hold", "trim"]).toContain(v.verdict);
    expect(["exit", "sell"]).not.toContain(v.verdict);
    expect(v.signals.rs6mPct!).toBeGreaterThan(0);
    expect(v.signals.close).toBeGreaterThan(v.signals.dma200!);
  });

  it("strong but overextended (sharp recent spike) -> trim", () => {
    const closes = Array.from({ length: 260 }, (_, i) =>
      100 + 25 * (i / 259) + (i > 240 ? (i - 240) * 4 : 0) + Math.sin(i / 6),
    );
    const v = verdictOf(closes);
    expect(v.verdict).toBe("trim");
  });

  it("not enough history -> hold with a note, no 200-DMA", () => {
    const closes = Array.from({ length: 150 }, (_, i) => 100 + i * 0.1);
    const v = verdictOf(closes);
    expect(v.verdict).toBe("hold");
    expect(v.signals.dma200).toBeNull();
    expect(v.reason.toLowerCase()).toContain("not enough");
  });

  it("risk-off market: a leader is held, not added", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + 40 * (i / 259) + 3 * Math.sin(i / 5));
    const v = verdictOf(closes, niftyDown);
    expect(v.verdict).not.toBe("add");
    expect(v.signals.regimeRiskOn).toBe(false);
  });

  it("regimeRiskOn reflects Nifty vs its 200-DMA", () => {
    expect(regimeRiskOn(niftyUp)).toBe(true);
    expect(regimeRiskOn(niftyDown)).toBe(false);
  });
});
