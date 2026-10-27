"use server";

import { revalidatePath } from "next/cache";
import { buildLots, type Tx } from "@/lib/calc/fifo";
import { supabaseServer } from "@/lib/supabase/server";

export type CorpActionType = "split" | "bonus" | "dividend";

export interface CorpActionInput {
  assetId: string;
  type: CorpActionType;
  exDate: string;
  // split: face value a -> b means multiplier b/a (e.g. ₹10 -> ₹2 is ×5)
  // bonus: b:a means b bonus shares for every a held
  ratioFrom?: number; // a
  ratioTo?: number; // b
  perSharePaise?: number; // dividend amount per share
}

/**
 * Applies a split/bonus/dividend to every portfolio holding the asset on the ex-date,
 * by writing the matching transaction (the FIFO engine then adjusts the lots). Recorded
 * once per asset+type+ex-date so it can't be applied twice.
 */
export async function applyCorporateAction(input: CorpActionInput): Promise<{ error?: string; applied?: number }> {
  const { assetId, type, exDate } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exDate)) return { error: "Pick the ex-date." };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };

  const { data: asset } = await supabase.from("assets").select("id, name, asset_class").eq("id", assetId).maybeSingle();
  if (!asset) return { error: "Asset not found." };

  // record the action, and refuse a duplicate (same asset, type, ex-date)
  const { data: existing } = await supabase
    .from("corporate_actions")
    .select("id")
    .eq("asset_id", assetId)
    .eq("type", type)
    .eq("ex_date", exDate)
    .maybeSingle();
  if (existing) return { error: "This corporate action is already recorded for that date." };

  if (type === "split" && !(input.ratioFrom && input.ratioTo)) return { error: "Enter the split ratio (e.g. 10 to 2)." };
  if (type === "bonus" && !(input.ratioFrom && input.ratioTo)) return { error: "Enter the bonus ratio (e.g. 1 for 1)." };
  if (type === "dividend" && !(input.perSharePaise && input.perSharePaise > 0)) return { error: "Enter the dividend per share." };

  const { data: ca, error: caErr } = await supabase
    .from("corporate_actions")
    .insert({ asset_id: assetId, type, ex_date: exDate, ratio_from: input.ratioFrom ?? null, ratio_to: input.ratioTo ?? null })
    .select("id")
    .single();
  if (caErr) return { error: caErr.message };

  // every portfolio that holds this asset, with its transactions up to the ex-date
  const { data: txRows } = await supabase
    .from("transactions")
    .select("portfolio_id, type, trade_date, quantity, price_paise, amount_paise, charges_paise")
    .eq("asset_id", assetId)
    .lte("trade_date", exDate);

  const byPort = new Map<string, Tx[]>();
  (txRows ?? []).forEach((r) => {
    const t: Tx = { portfolioId: r.portfolio_id, type: r.type, date: r.trade_date, quantity: Number(r.quantity), pricePaise: Number(r.price_paise), amountPaise: Number(r.amount_paise), chargesPaise: Number(r.charges_paise) };
    byPort.set(r.portfolio_id, [...(byPort.get(r.portfolio_id) ?? []), t]);
  });

  const inserts: Record<string, unknown>[] = [];
  const applied: string[] = [];
  for (const [portfolioId, txs] of byPort) {
    const held = buildLots(txs, false).lots.reduce((s, l) => s + l.qty, 0);
    if (held <= 1e-9) continue;
    applied.push(portfolioId);
    if (type === "split") {
      inserts.push({ portfolio_id: portfolioId, asset_id: assetId, type: "split", trade_date: exDate, quantity: input.ratioTo! / input.ratioFrom!, price_paise: 0, amount_paise: 0, charges_paise: 0, source_ref: `ca:${ca.id}:${portfolioId}`, notes: `Split ${input.ratioFrom}:${input.ratioTo}` });
    } else if (type === "bonus") {
      const bonusShares = (held * input.ratioTo!) / input.ratioFrom!;
      inserts.push({ portfolio_id: portfolioId, asset_id: assetId, type: "bonus", trade_date: exDate, quantity: bonusShares, price_paise: 0, amount_paise: 0, charges_paise: 0, source_ref: `ca:${ca.id}:${portfolioId}`, notes: `Bonus ${input.ratioTo}:${input.ratioFrom}` });
    } else {
      const amount = Math.round(held * input.perSharePaise!);
      inserts.push({ portfolio_id: portfolioId, asset_id: assetId, type: "dividend", trade_date: exDate, quantity: 0, price_paise: 0, amount_paise: amount, charges_paise: 0, source_ref: `ca:${ca.id}:${portfolioId}`, notes: `Dividend ₹${(input.perSharePaise! / 100).toFixed(2)}/share` });
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("transactions").insert(inserts);
    if (error) {
      await supabase.from("corporate_actions").delete().eq("id", ca.id);
      return { error: error.message };
    }
  }
  // mark applied
  if (applied.length) {
    await supabase.from("corporate_action_applied").insert(applied.map((p) => ({ portfolio_id: p, action_id: ca.id })));
  }
  revalidatePath("/", "layout");
  return { applied: applied.length };
}

export interface HeldAsset { id: string; name: string; asset_class: string; isin: string | null }

/** The equity-type assets this account holds, to choose from when applying an action. */
export async function heldEquityAssets(): Promise<HeldAsset[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("transactions")
    .select("asset:assets(id, name, asset_class, isin)")
    .in("type", ["buy", "opening", "bonus", "split"]);
  const seen = new Map<string, HeldAsset>();
  (data ?? []).forEach((r) => {
    const a = r.asset as unknown as HeldAsset;
    if (a && (a.asset_class === "EQ") && !seen.has(a.id)) seen.set(a.id, a);
  });
  return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
}
