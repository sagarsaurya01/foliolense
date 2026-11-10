"use server";

// Swing scanner: runs the swing engine across the whole F&O universe in price_history and returns
// today's fresh setups (breakout / watch), ranked, excluding anything the user already holds —
// so it finds NEW trades, not re-analysing the portfolio. Reads under the user's session.

import { supabaseServer } from "@/lib/supabase/server";
import { computeSwing, type SwingBar, type SwingSignal } from "@/lib/swing";

const MAX = 60; // top setups to show

export async function swingScan(heldIsins: string[]): Promise<SwingSignal[]> {
  const supabase = await supabaseServer();
  const held = new Set(heldIsins);

  // last ~100 calendar days is enough for the 20-day breakout + ATR; keeps the scan light
  const cutoff = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
  const byIsin = new Map<string, { symbol: string; bars: SwingBar[] }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("price_history")
      .select("isin,nse_symbol,price_date,high_paise,low_paise,close_paise")
      .gte("price_date", cutoff)
      .order("isin", { ascending: true })
      .order("price_date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      let e = byIsin.get(r.isin);
      if (!e) { e = { symbol: r.nse_symbol ?? r.isin, bars: [] }; byIsin.set(r.isin, e); }
      if (r.nse_symbol) e.symbol = r.nse_symbol;
      e.bars.push({
        date: r.price_date,
        high: (r.high_paise ?? r.close_paise) / 100,
        low: (r.low_paise ?? r.close_paise) / 100,
        close: r.close_paise / 100,
      });
    }
    if (data.length < PAGE) break;
  }

  const items = [...byIsin.entries()].map(([isin, e]) => ({ isin, symbol: e.symbol, name: e.symbol, bars: e.bars }));
  return computeSwing(items)
    .filter((s) => (s.status === "breakout" || s.status === "watch") && !held.has(s.isin))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "breakout" ? -1 : 1))
    .slice(0, MAX);
}
