"use server";

// Watchlist ("stocks in hand") + per-stock daily price alerts. All under the user's session (RLS
// scopes every row to owner_id = auth.uid()). Prices are the daily close from the feed.

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export type StockHit = { isin: string | null; nse_symbol: string; name: string };

export type WatchItem = {
  id: string; isin: string | null; nse_symbol: string; name: string; sort: number;
  closePaise: number | null; prevPaise: number | null; priceDate: string | null;
  alertDir: "up" | "down" | "both" | null; alertAmountPaise: number | null; alertPct: number | null; alertActive: boolean;
  lastAlertDate: string | null; lastAlertKind: string | null;
};
export type AlertRow = { id: string; nse_symbol: string; name: string; kind: string; movePaise: number; movePct: number | null; pricePaise: number; priceDate: string; createdAt: string };
export type WatchlistData = { items: WatchItem[]; recent: AlertRow[]; emailOn: boolean; email: string | null };

export async function searchStocks(q: string): Promise<StockHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const supabase = await supabaseServer();
  const like = `*${term}*`;
  const { data } = await supabase
    .from("instrument_prices")
    .select("isin, nse_symbol, name")
    .not("nse_symbol", "is", null)
    .or(`nse_symbol.ilike.${like},name.ilike.${like}`)
    .order("nse_symbol")
    .limit(25);
  return (data ?? []).map((r) => ({ isin: r.isin, nse_symbol: r.nse_symbol as string, name: r.name ?? r.nse_symbol }));
}

export async function getWatchlist(): Promise<WatchlistData> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { items: [], recent: [], emailOn: false, email: null };

  const [{ data: rows }, { data: log }, { data: prefs }] = await Promise.all([
    supabase.from("watchlist").select("*").order("sort").order("name"),
    supabase.from("alert_log").select("id, nse_symbol, name, kind, move_paise, move_pct, price_paise, price_date, created_at").order("created_at", { ascending: false }).limit(25),
    supabase.from("preferences").select("alerts_email_on, alert_email").maybeSingle(),
  ]);

  const syms = [...new Set((rows ?? []).map((r) => r.nse_symbol))];
  const priceBySym = new Map<string, { close: number; prev: number | null; date: string }>();
  if (syms.length) {
    const { data: px } = await supabase
      .from("instrument_prices").select("nse_symbol, close_paise, prev_close_paise, price_date").in("nse_symbol", syms);
    for (const p of px ?? []) priceBySym.set(p.nse_symbol, { close: p.close_paise, prev: p.prev_close_paise, date: p.price_date });
  }

  const items: WatchItem[] = (rows ?? []).map((r) => {
    const p = priceBySym.get(r.nse_symbol);
    return {
      id: r.id, isin: r.isin, nse_symbol: r.nse_symbol, name: r.name, sort: r.sort,
      closePaise: p?.close ?? null, prevPaise: p?.prev ?? null, priceDate: p?.date ?? null,
      alertDir: r.alert_dir, alertAmountPaise: r.alert_amount_paise, alertPct: r.alert_pct, alertActive: r.alert_active,
      lastAlertDate: r.last_alert_date, lastAlertKind: r.last_alert_kind,
    };
  });
  const recent: AlertRow[] = (log ?? []).map((a) => ({
    id: a.id, nse_symbol: a.nse_symbol, name: a.name, kind: a.kind, movePaise: a.move_paise, movePct: a.move_pct,
    pricePaise: a.price_paise, priceDate: a.price_date, createdAt: a.created_at,
  }));
  return { items, recent, emailOn: prefs?.alerts_email_on ?? false, email: prefs?.alert_email ?? null };
}

export async function addWatch(stock: StockHit): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.from("watchlist").upsert(
    { isin: stock.isin, nse_symbol: stock.nse_symbol, name: stock.name },
    { onConflict: "owner_id,nse_symbol", ignoreDuplicates: true },
  );
  revalidatePath("/family", "layout");
}

export async function removeWatch(id: string): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.from("watchlist").delete().eq("id", id);
}

export async function setAlert(id: string, a: { dir: "up" | "down" | "both" | null; amountPaise: number | null; pct: number | null; active: boolean }): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.from("watchlist").update({
    alert_dir: a.dir, alert_amount_paise: a.amountPaise, alert_pct: a.pct, alert_active: a.active, updated_at: new Date().toISOString(),
  }).eq("id", id);
}

export async function setAlertEmail(on: boolean, email: string | null): Promise<void> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("preferences").upsert(
    { user_id: auth.user.id, alerts_email_on: on, alert_email: email },
    { onConflict: "user_id" },
  );
}
