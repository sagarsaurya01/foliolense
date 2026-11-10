import { describe, expect, it } from "vitest";
import { computeSwing, type SwingBar } from "../swing";

function sb(closes: number[]): SwingBar[] {
  const start = new Date("2025-01-01").getTime();
  return closes.map((c, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    high: c * 1.01,
    low: c * 0.99,
    close: c,
  }));
}
const sig = (closes: number[]) => computeSwing([{ isin: "X", symbol: "T", name: "Test", bars: sb(closes) }])[0];

describe("computeSwing", () => {
  it("fresh breakout above the 20-day high -> breakout with stop < close < target", () => {
    const closes = [...Array(30).fill(100), 102, 104, 106, 108, 113];
    const s = sig(closes);
    expect(s.status).toBe("breakout");
    expect(s.stop!).toBeLessThan(s.close);
    expect(s.close).toBeLessThan(s.target!);
    expect(s.rr).toBe(2);
  });

  it("downtrend below the 20-day average -> avoid, no levels", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 120 - i * 0.5);
    const s = sig(closes);
    expect(s.status).toBe("avoid");
    expect(s.entry).toBeNull();
  });

  it("coiling just under the 20-day high -> watch, entry at the breakout level", () => {
    const closes = [...Array.from({ length: 20 }, (_, i) => 100 + i * 0.5), ...Array(15).fill(109)];
    const s = sig(closes);
    expect(s.status).toBe("watch");
    expect(s.entry).not.toBeNull();
    expect(s.stop).not.toBeNull();
  });

  it("not enough history -> watch with a note", () => {
    const s = sig(Array.from({ length: 20 }, (_, i) => 100 + i));
    expect(s.status).toBe("watch");
    expect(s.reason.toLowerCase()).toContain("not enough");
  });
});
