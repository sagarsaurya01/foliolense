"use server";

import { revalidatePath } from "next/cache";
import { classInfo } from "@/lib/assetClasses";
import { supabaseServer } from "@/lib/supabase/server";

// One parsed line from a statement (worker or in-browser parser), before it becomes a transaction.
export interface ImportRow {
  date: string;
  type: "buy" | "sell" | "dividend" | "merge_in" | "merge_out";
  isin?: string | null;
  amfi_code?: string | null;
  symbol?: string | null;
  name: string;
  cls?: string; // defaults EQ; CAS fund rows pass MFE
  units: number;
  nav_paise: number;
  amount_paise: number;
  charges_paise?: number;
  source_ref: string;
}

export interface TieOut {
  name: string;
  isin?: string | null;
  close_value_paise: number;
}

const paiseOk = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Writes an import: matches each row to an asset (by ISIN, then symbol/AMFI, then name, else
 * creates one — storing the ISIN so the price feed links it automatically), skips rows already
 * imported (same source_ref), and tags everything with an import_id so it can be undone.
 */
export async function importTransactions(
  portfolioId: string,
  template: string,
  fileName: string,
  fileSha: string,
  rows: ImportRow[],
): Promise<{ error?: string; added?: number; skipped?: number; importId?: string; duplicateFile?: boolean }> {
  if (!rows.length) return { error: "Nothing to import." };
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return { error: `Bad date "${r.date}" for ${r.name}.` };
    if (!paiseOk(r.amount_paise)) return { error: `Bad amount for ${r.name}.` };
  }
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in again." };
  const uid = auth.user.id;

  // same file already imported?
  if (fileSha) {
    const { data: prev } = await supabase.from("imports").select("id").eq("owner_id", uid).eq("file_sha256", fileSha).eq("status", "completed").maybeSingle();
    if (prev) return { duplicateFile: true };
  }

  const { data: imp, error: impErr } = await supabase
    .from("imports")
    .insert({ owner_id: uid, template, file_name: fileName, file_sha256: fileSha || null, status: "parsing" })
    .select("id")
    .single();
  if (impErr) return { error: impErr.message };
  const importId = imp.id as string;

  // resolve each distinct asset once
  const assetCache = new Map<string, string>();
  async function resolveAsset(r: ImportRow): Promise<string | { error: string }> {
    const cls = r.cls ?? "EQ";
    const key = `${cls}|${r.isin ?? ""}|${r.name.toLowerCase()}`;
    const hit = assetCache.get(key);
    if (hit) return hit;
    let found: { id: string } | null = null;
    if (r.isin) {
      const { data } = await supabase.from("assets").select("id").eq("owner_id", uid).eq("isin", r.isin).limit(1);
      found = data?.[0] ?? null;
    }
    if (!found) {
      const { data } = await supabase.from("assets").select("id").eq("owner_id", uid).eq("asset_class", cls).ilike("name", r.name.trim()).limit(1);
      found = data?.[0] ?? null;
      // an existing match with no ISIN gets the statement's ISIN, so the price feed can link it
      if (found && r.isin) await supabase.from("assets").update({ isin: r.isin, nse_symbol: r.symbol ?? null, amfi_code: r.amfi_code ?? null }).eq("id", found.id);
    }
    if (!found) {
      const { data, error } = await supabase
        .from("assets")
        .insert({ name: r.name.trim(), asset_class: cls, owner_id: uid, isin: r.isin ?? null, nse_symbol: r.symbol ?? null, amfi_code: r.amfi_code ?? null })
        .select("id")
        .single();
      if (error) return { error: error.message };
      found = { id: data.id };
    }
    assetCache.set(key, found.id);
    return found.id;
  }

  // which source_refs already exist in this portfolio -> skip (Fully Assigned)
  const { data: existing } = await supabase.from("transactions").select("source_ref").eq("portfolio_id", portfolioId).not("source_ref", "is", null);
  const seen = new Set((existing ?? []).map((x) => x.source_ref));

  const toInsert: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (seen.has(r.source_ref)) continue;
    const a = await resolveAsset(r);
    if (typeof a !== "string") {
      await supabase.from("imports").delete().eq("id", importId);
      return { error: a.error };
    }
    const balance = !!classInfo(r.cls ?? "EQ").balance;
    toInsert.push({
      portfolio_id: portfolioId,
      asset_id: a,
      type: r.type,
      trade_date: r.date,
      quantity: balance ? 1 : r.type === "dividend" ? 0 : r.units,
      price_paise: r.nav_paise,
      amount_paise: r.amount_paise,
      charges_paise: r.charges_paise ?? 0,
      import_id: importId,
      source_ref: r.source_ref,
      notes: `Imported: ${template}`,
    });
  }

  let added = 0;
  if (toInsert.length) {
    const { data, error } = await supabase.from("transactions").insert(toInsert).select("id");
    if (error) {
      await supabase.from("imports").delete().eq("id", importId); // cascades the rows just made
      return { error: error.message };
    }
    added = data?.length ?? 0;
  }
  await supabase.from("imports").update({ status: "completed", stats: { added, skipped: rows.length - added } }).eq("id", importId);
  revalidatePath("/", "layout");
  return { added, skipped: rows.length - added, importId };
}

/** Deletes exactly the transactions a past import added. */
export async function undoImport(importId: string): Promise<{ error?: string; removed?: number }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("transactions").delete().eq("import_id", importId).select("id");
  if (error) return { error: error.message };
  await supabase.from("imports").update({ status: "undone" }).eq("id", importId);
  revalidatePath("/", "layout");
  return { removed: data?.length ?? 0 };
}
