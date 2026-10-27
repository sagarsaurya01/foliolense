"use server";

import { revalidatePath } from "next/cache";
import { classInfo, ASSET_CLASSES } from "@/lib/assetClasses";
import { buildLots, type Tx, type TxType } from "@/lib/calc/fifo";
import type { DepositTerms } from "@/lib/calc/deposits";
import type { AssetMeta } from "@/lib/holdings";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { error?: string; id?: string };

export interface TxInput {
  portfolioId: string;
  assetClass: string;
  assetName: string;
  assetId?: string; // set when picking an existing asset
  type: TxType;
  date: string;
  quantity: number; // units; for balance types ignored (1); for split the multiplier
  price: number; // rupees per unit; for balance types the amount
  charges: number; // rupees
  currentPrice?: number | null; // rupees; balance types: current value
  deposit?: DepositTerms | null;
  notes?: string;
}

const paise = (rupees: number) => Math.round(rupees * 100);
const VALID_TYPES: TxType[] = ["buy", "sell", "deposit", "withdraw", "dividend", "interest", "bonus", "split", "opening"];

function check(t: TxInput): string | null {
  if (!ASSET_CLASSES.some((c) => c.code === t.assetClass)) return "Pick an asset class.";
  if (!t.assetName.trim() && !t.assetId) return "Enter the asset name.";
  if (!VALID_TYPES.includes(t.type)) return "Pick a transaction type.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return "Pick the date.";
  if (t.date > new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10)) return "The date can't be in the future.";
  const balance = classInfo(t.assetClass).balance;
  if (!balance && ["buy", "sell", "bonus", "split", "opening"].includes(t.type) && !(t.quantity > 0)) return "Enter a quantity above zero.";
  if (["buy", "sell", "deposit", "withdraw", "opening", "dividend", "interest"].includes(t.type) && !(t.price > 0))
    return balance || ["dividend", "interest"].includes(t.type) ? "Enter the amount." : "Enter the price per unit.";
  if (t.charges < 0) return "Charges can't be negative.";
  return null;
}

/** Finds the user's asset by id or by name + class, creating it if new. Updates price / value / deposit terms. */
async function resolveAsset(supabase: Awaited<ReturnType<typeof supabaseServer>>, userId: string, t: TxInput) {
  let id = t.assetId;
  let meta: AssetMeta = {};
  if (id) {
    const { data } = await supabase.from("assets").select("id, meta").eq("id", id).maybeSingle();
    if (!data) return { error: "That asset no longer exists." };
    meta = (data.meta as AssetMeta) ?? {};
  } else {
    const { data: found } = await supabase
      .from("assets")
      .select("id, meta")
      .eq("asset_class", t.assetClass)
      .ilike("name", t.assetName.trim())
      .limit(1);
    if (found?.length) {
      id = found[0].id;
      meta = (found[0].meta as AssetMeta) ?? {};
    } else {
      const { data, error } = await supabase
        .from("assets")
        .insert({ name: t.assetName.trim(), asset_class: t.assetClass, owner_id: userId })
        .select("id")
        .single();
      if (error) return { error: error.message };
      id = data.id;
    }
  }
  const next: AssetMeta = { ...meta };
  const balance = classInfo(t.assetClass).balance;
  if (t.currentPrice != null && t.currentPrice > 0) {
    if (balance) next.value_paise = paise(t.currentPrice);
    else {
      next.prev_price_paise = meta.price_paise ?? paise(t.currentPrice);
      next.price_paise = paise(t.currentPrice);
      next.price_date = t.date;
    }
  }
  if (t.deposit) next.deposit = t.deposit;
  if (JSON.stringify(next) !== JSON.stringify(meta)) {
    // only the owner can change a private asset; shared assets get prices from Phase 2 feeds
    await supabase.from("assets").update({ meta: next }).eq("id", id!);
  }
  return { id: id! };
}

export async function saveTransaction(t: TxInput, editId?: string): Promise<Result> {
  const problem = check(t);
  if (problem) return { error: problem };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };

  const asset = await resolveAsset(supabase, auth.user.id, t);
  if ("error" in asset) return { error: asset.error };

  const balance = !!classInfo(t.assetClass).balance;
  const qty = balance ? 1 : t.type === "split" ? t.quantity : ["dividend", "interest"].includes(t.type) ? 0 : t.quantity;
  const pricePaise = paise(t.price);
  const amountPaise = balance || ["dividend", "interest"].includes(t.type) ? pricePaise : t.type === "bonus" || t.type === "split" ? 0 : Math.round(qty * pricePaise);
  const row = {
    portfolio_id: t.portfolioId,
    asset_id: asset.id,
    type: t.type,
    trade_date: t.date,
    quantity: qty,
    price_paise: ["bonus", "split"].includes(t.type) ? 0 : pricePaise,
    amount_paise: amountPaise,
    charges_paise: paise(t.charges || 0),
    notes: t.notes?.trim() || null,
  };

  // never let a sale or withdrawal exceed what this portfolio holds on that date
  const { data: existing } = await supabase
    .from("transactions")
    .select("id, type, trade_date, quantity, price_paise, amount_paise, charges_paise")
    .eq("portfolio_id", t.portfolioId)
    .eq("asset_id", asset.id);
  const others: Tx[] = (existing ?? [])
    .filter((x) => x.id !== editId)
    .map((x) => ({ portfolioId: t.portfolioId, type: x.type, date: x.trade_date, quantity: Number(x.quantity), pricePaise: Number(x.price_paise), amountPaise: Number(x.amount_paise), chargesPaise: Number(x.charges_paise) }));
  const mine: Tx = { portfolioId: t.portfolioId, type: t.type, date: t.date, quantity: qty, pricePaise: row.price_paise, amountPaise, chargesPaise: row.charges_paise };
  const { warnings } = buildLots([...others, mine], balance);
  if (warnings.length) {
    return { error: balance ? "That is more than the balance on that date." : "You can't sell more than you held on that date." };
  }

  const q = editId
    ? supabase.from("transactions").update(row).eq("id", editId).select("id").single()
    : supabase.from("transactions").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: tx } = await supabase.from("transactions").select("portfolio_id, asset_id, type").eq("id", id).maybeSingle();
  if (!tx) return { error: "Already deleted." };
  // removing a purchase must not leave a later sale selling more than was held
  const { data: rest } = await supabase
    .from("transactions")
    .select("id, type, trade_date, quantity, price_paise, amount_paise, charges_paise, asset:assets(asset_class)")
    .eq("portfolio_id", tx.portfolio_id)
    .eq("asset_id", tx.asset_id);
  const cls = (rest?.[0]?.asset as unknown as { asset_class: string } | undefined)?.asset_class ?? "EQ";
  const remaining: Tx[] = (rest ?? [])
    .filter((x) => x.id !== id)
    .map((x) => ({ portfolioId: tx.portfolio_id, type: x.type, date: x.trade_date, quantity: Number(x.quantity), pricePaise: Number(x.price_paise), amountPaise: Number(x.amount_paise), chargesPaise: Number(x.charges_paise) }));
  if (buildLots(remaining, !!classInfo(cls).balance).warnings.length)
    return { error: "A later sale needs this purchase. Delete or change the sale first." };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

/** Sets today's price (and keeps the old one as previous close), or a balance-type value. */
export async function setAssetPrice(assetId: string, rupees: number, balance: boolean): Promise<Result> {
  if (!(rupees > 0)) return { error: "Enter a price above zero." };
  const supabase = await supabaseServer();
  const { data } = await supabase.from("assets").select("meta, owner_id").eq("id", assetId).maybeSingle();
  if (!data) return { error: "Asset not found." };
  if (!data.owner_id) return { error: "This asset's price comes from the daily price feed." };
  const meta = (data.meta as AssetMeta) ?? {};
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const next: AssetMeta = balance
    ? { ...meta, value_paise: paise(rupees) }
    : { ...meta, prev_price_paise: meta.price_date === today ? meta.prev_price_paise ?? meta.price_paise : meta.price_paise ?? paise(rupees), price_paise: paise(rupees), price_date: today };
  const { error } = await supabase.from("assets").update({ meta: next }).eq("id", assetId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

// ---------- rename / delete ----------
async function simpleUpdate(table: string, id: string, name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from(table).update({ name: clean }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "That name is already used here." : error.message };
  revalidatePath("/", "layout");
  return {};
}
export const renameFamily = async (id: string, name: string) => simpleUpdate("families", id, name);
export const renamePortfolio = async (id: string, name: string) => simpleUpdate("portfolios", id, name);
export const renameGroup = async (id: string, name: string) => simpleUpdate("portfolio_groups", id.replace(/^g:/, ""), name);

/** Deletes after the user typed the exact name. Families and portfolios take their transactions with them. */
export async function deleteThing(kind: "family" | "portfolio" | "group", id: string, typedName: string): Promise<Result> {
  const table = kind === "family" ? "families" : kind === "portfolio" ? "portfolios" : "portfolio_groups";
  const realId = id.replace(/^g:/, "");
  const supabase = await supabaseServer();
  const { data } = await supabase.from(table).select("name").eq("id", realId).maybeSingle();
  if (!data) return { error: "Not found." };
  if (data.name.trim() !== typedName.trim()) return { error: `Type "${data.name}" exactly to confirm.` };
  const { error } = await supabase.from(table).delete().eq("id", realId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

// ---------- opening balances from Excel (PRD S09, Phase 1 path) ----------
export interface OpeningRow {
  portfolio: string;
  assetClass: string;
  assetName: string;
  date: string;
  quantity: number;
  price: number; // per unit; for balance types the amount
  currentPrice?: number | null;
}

export async function importOpening(familyId: string, rows: OpeningRow[]): Promise<{ error?: string; added?: number; skipped?: number }> {
  if (!rows.length) return { error: "The sheet has no rows." };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };
  const { data: ports } = await supabase.from("portfolios").select("id, name").eq("family_id", familyId).eq("book", "inv");
  const portId = new Map((ports ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const prepared = [];
  for (const [i, r] of rows.entries()) {
    const pid = portId.get(r.portfolio.trim().toLowerCase());
    if (!pid) return { error: `Row ${i + 2}: no portfolio called "${r.portfolio}" in this family.` };
    const t: TxInput = {
      portfolioId: pid, assetClass: r.assetClass, assetName: r.assetName, type: "opening",
      date: r.date, quantity: r.quantity, price: r.price, charges: 0, currentPrice: r.currentPrice ?? null,
    };
    const problem = check(t);
    if (problem) return { error: `Row ${i + 2} (${r.assetName || "no name"}): ${problem}` };
    prepared.push(t);
  }

  const out = [];
  for (const t of prepared) {
    const asset = await resolveAsset(supabase, auth.user.id, t);
    if ("error" in asset) return { error: asset.error };
    const balance = !!classInfo(t.assetClass).balance;
    const qty = balance ? 1 : t.quantity;
    const pricePaise = paise(t.price);
    out.push({
      portfolio_id: t.portfolioId,
      asset_id: asset.id,
      type: "opening",
      trade_date: t.date,
      quantity: qty,
      price_paise: pricePaise,
      amount_paise: balance ? pricePaise : Math.round(qty * pricePaise),
      charges_paise: 0,
      // the same sheet imported twice adds nothing the second time
      source_ref: `opening:${asset.id}:${t.date}:${qty}:${pricePaise}`,
      notes: "Opening balance (Excel)",
    });
  }
  const { data, error } = await supabase
    .from("transactions")
    .upsert(out, { onConflict: "portfolio_id,source_ref", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { added: data?.length ?? 0, skipped: out.length - (data?.length ?? 0) };
}
