"use server";

// Runs the swing engine on real daily OHLC from the app's price_history. Computed on demand when the
// Swing view opens. Reads under the user's session.

import { supabaseServer } from "@/lib/supabase/server";
import { computeSwing, type SwingBar, type SwingSignal } from "@/lib/swing";

export async function swingSignals(items: { isin: string; name: string }[]): Promise<SwingSignal[]> {
  const isins = [...new Set(items.map((i) => i.isin).filter(Boolean))] as string[];
  if (!isins.length) return [];

  const supabase = await supabaseServer();
  const byIsin = new Map<string, { symbol: string; bars: SwingBar[] }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("price_history")
      .select("isin,nse_symbol,price_date,high_paise,low_paise,close_paise")
      .in("isin", isins)
      .order("price_date", { ascending: true })
      .order("isin", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) {
      let e = byIsin.get(r.isin);
      if (!e) { e = { symbol: r.nse_symbol ?? "", bars: [] }; byIsin.set(r.isin, e); }
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

  const engineItems = items
    .map((it) => {
      const e = byIsin.get(it.isin);
      return e && e.bars.length ? { isin: it.isin, symbol: e.symbol || it.name, name: it.name, bars: e.bars } : null;
    })
    .filter((x): x is { isin: string; symbol: string; name: string; bars: SwingBar[] } => x != null);

  return computeSwing(engineItems);
}
