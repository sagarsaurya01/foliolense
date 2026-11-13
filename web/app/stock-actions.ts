"use server";

// Per-stock report: every buy / sell / dividend of one asset across the whole family, with a
// comparison to today's price. Read-only, under the user's session. Average-cost basis, so a
// partial sell reduces the remaining cost correctly.

import { supabaseServer } from "@/lib/supabase/server";

export type StockTxn = {
  id: string; date: string; type: string; member: string;
  qty: number; pricePaise: number; amountPaise: number;
};

export type StockReportData = {
  name: string; isin: string | null; cls: string;
  pricePaise: number | null; prevPaise: number | null; priceDate: string | null; heldAtCost: boolean;
  txns: StockTxn[];
  boughtQty: number; boughtCostPaise: number; soldQty: number; soldProceedsPaise: number;
  dividendsPaise: number; realisedPaise: number;
  netQty: number; avgCostPaise: number; investedPaise: number;
  currentPaise: number | null; unrealisedPaise: number | null;
};

export async function stockReport(familyId: string, assetId: string): Promise<StockReportData | null> {
  const supabase = await supabaseServer();

  const [{ data: ports }, { data: asset }] = await Promise.all([
    supabase.from("portfolios").select("id, name").eq("family_id", familyId),
    supabase.from("assets").select("name, isin, asset_class, meta").eq("id", assetId).single(),
  ]);
  const portIds = (ports ?? []).map((p) => p.id);
  const nameById = new Map((ports ?? []).map((p) => [p.id, p.name as string]));
  if (!asset || !portIds.length) return null;

  const { data: txRows } = await supabase
    .from("transactions")
    .select("id, portfolio_id, type, trade_date, quantity, price_paise, amount_paise")
    .eq("asset_id", assetId)
    .in("portfolio_id", portIds)
    .order("trade_date", { ascending: true })
    .limit(5000);

  // today's price: the daily feed by ISIN, else a manual NAV in meta
  const meta = (asset.meta ?? {}) as { price_paise?: number; prev_price_paise?: number; price_date?: string; value_paise?: number };
  let pricePaise: number | null = null, prevPaise: number | null = null, priceDate: string | null = null;
  if (asset.isin) {
    const { data: ip } = await supabase
      .from("instrument_prices").select("close_paise, prev_close_paise, price_date")
      .eq("isin", asset.isin).maybeSingle();
    if (ip) { pricePaise = ip.close_paise; prevPaise = ip.prev_close_paise; priceDate = ip.price_date; }
  }
  if (pricePaise == null && meta.price_paise != null) {
    pricePaise = meta.price_paise; prevPaise = meta.prev_price_paise ?? null; priceDate = meta.price_date ?? null;
  }

  let boughtQty = 0, boughtCost = 0, soldQty = 0, soldProceeds = 0, dividends = 0;
  const txns: StockTxn[] = [];
  for (const t of txRows ?? []) {
    const q = Number(t.quantity);
    txns.push({ id: t.id, date: t.trade_date, type: t.type, member: nameById.get(t.portfolio_id) ?? "—",
      qty: q, pricePaise: t.price_paise, amountPaise: t.amount_paise });
    if (t.type === "buy") { boughtQty += q; boughtCost += q * t.price_paise; }
    else if (t.type === "sell") { soldQty += q; soldProceeds += q * t.price_paise; }
    else if (t.type === "dividend" || t.type === "interest") { dividends += t.amount_paise; }
  }

  const avgCost = boughtQty ? boughtCost / boughtQty : 0;            // paise per unit
  const realised = soldQty ? soldProceeds - soldQty * avgCost : 0;   // on shares already sold
  const netQty = boughtQty - soldQty;
  const invested = Math.round(netQty * avgCost);
  const isDeposit = meta.value_paise != null;                        // FD / bank / NPS / PPF: value, not price
  const heldAtCost = !isDeposit && pricePaise == null && netQty > 0;
  const current = isDeposit ? meta.value_paise!
    : pricePaise != null ? Math.round(netQty * pricePaise)
    : netQty > 0 ? invested : 0;
  const unrealised = current - invested;

  return {
    name: asset.name, isin: asset.isin, cls: asset.asset_class,
    pricePaise, prevPaise, priceDate, heldAtCost,
    txns,
    boughtQty, boughtCostPaise: Math.round(boughtCost), soldQty, soldProceedsPaise: Math.round(soldProceeds),
    dividendsPaise: dividends, realisedPaise: Math.round(realised),
    netQty, avgCostPaise: Math.round(avgCost), investedPaise: invested,
    currentPaise: current, unrealisedPaise: unrealised,
  };
}
