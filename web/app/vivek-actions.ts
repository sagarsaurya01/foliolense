"use server";

// Runs the Vivek Bajaj engine on real data: pulls each held stock's price history + the Nifty 50
// series from the app's own tables and returns a verdict per stock. Computed on demand (when the
// user opens the Vivek view) so a normal page load stays light. Reads under the user's session.

import { supabaseServer } from "@/lib/supabase/server";
import { computeVivek, type Bar, type VivekVerdict } from "@/lib/vivek";

export async function vivekVerdicts(items: { isin: string; name: string }[]): Promise<VivekVerdict[]> {
  const isins = [...new Set(items.map((i) => i.isin).filter(Boolean))] as string[];
  if (!isins.length) return [];

  const supabase = await supabaseServer();
  const byIsin = new Map<string, { symbol: string; bars: Bar[] }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("price_history")
      .select("isin,nse_symbol,price_date,close_paise,high_paise,deliv_pct")
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
        close: r.close_paise / 100,
        high: (r.high_paise ?? r.close_paise) / 100,
        delivPct: r.deliv_pct,
      });
    }
    if (data.length < PAGE) break;
  }

  const { data: idx } = await supabase
    .from("index_prices")
    .select("price_date,close")
    .eq("index_code", "Nifty 50")
    .order("price_date", { ascending: true })
    .limit(2000);
  const nifty: Bar[] = (idx ?? []).map((r) => ({ date: r.price_date, close: Number(r.close) }));

  const engineItems = items
    .map((it) => {
      const e = byIsin.get(it.isin);
      return e && e.bars.length ? { isin: it.isin, symbol: e.symbol || it.name, name: it.name, bars: e.bars } : null;
    })
    .filter((x): x is { isin: string; symbol: string; name: string; bars: Bar[] } => x != null);

  return computeVivek(engineItems, nifty);
}
