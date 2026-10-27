"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export interface FnoTradeInput {
  underlying: string;
  instrument: "FUT" | "CE" | "PE";
  expiry: string;
  strike_paise: number | null;
  segment: "stock" | "other";
  date: string;
  side: "buy" | "sell";
  quantity: number;
  price_paise: number;
  source_ref: string;
}

/** Writes parsed F&O trades into one F&O portfolio, skipping ones already imported. */
export async function importFnoTrades(
  portfolioId: string,
  template: string,
  fileName: string,
  trades: FnoTradeInput[],
): Promise<{ error?: string; added?: number; skipped?: number }> {
  if (!trades.length) return { error: "Nothing to import." };
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };

  const { data: imp, error: impErr } = await supabase
    .from("imports")
    .insert({ owner_id: auth.user.id, template, file_name: fileName, portfolio_id: portfolioId, status: "parsing" })
    .select("id")
    .single();
  if (impErr) return { error: impErr.message };

  const { data: existing } = await supabase.from("fno_trades").select("source_ref").eq("portfolio_id", portfolioId).not("source_ref", "is", null);
  const seen = new Set((existing ?? []).map((x) => x.source_ref));

  const rows = trades
    .filter((t) => {
      if (seen.has(t.source_ref)) return false; // already in the portfolio, or a duplicate within this file
      seen.add(t.source_ref);
      return true;
    })
    .map((t) => ({
      portfolio_id: portfolioId,
      underlying: t.underlying,
      instrument: t.instrument,
      expiry: t.expiry,
      strike_paise: t.strike_paise,
      segment: t.segment,
      trade_date: t.date,
      side: t.side,
      quantity: t.quantity,
      price_paise: t.price_paise,
      import_id: imp.id,
      source_ref: t.source_ref,
    }));

  let added = 0;
  if (rows.length) {
    const { data, error } = await supabase.from("fno_trades").insert(rows).select("id");
    if (error) {
      await supabase.from("imports").delete().eq("id", imp.id);
      return { error: error.message };
    }
    added = data?.length ?? 0;
  }
  await supabase.from("imports").update({ status: "completed", stats: { added, skipped: trades.length - added } }).eq("id", imp.id);
  revalidatePath("/", "layout");
  return { added, skipped: trades.length - added };
}

export async function createFnoPortfolio(familyId: string, name: string): Promise<{ error?: string; id?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ family_id: familyId, name: clean, type: "individual", book: "fno" })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "A portfolio with that name already exists." : error.message };
  revalidatePath("/", "layout");
  return { id: data.id };
}
