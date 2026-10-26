"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { classInfo } from "@/lib/assetClasses";
import { DEMO_FAMILY_NAME, DEMO_FNO_PORTFOLIO, DEMO_PORTFOLIOS } from "@/lib/demo";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { error?: string };

const toPaise = (rupees: number) => Math.round(rupees * 100);

export async function createFamily(name: string): Promise<Result & { id?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a family name." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("families").insert({ name: clean }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { id: data.id };
}

export async function createPortfolio(familyId: string, name: string, type: string, book: string): Promise<Result & { id?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a portfolio name." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ family_id: familyId, name: clean, type, book })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "A portfolio with that name already exists in this family." : error.message };
  }
  revalidatePath("/", "layout");
  return { id: data.id };
}

// A group is a named set of portfolios in one family, shown combined (like Family Group, over fewer members).
export async function createGroup(familyId: string, name: string, portfolioIds: string[]): Promise<Result & { id?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a group name." };
  if (portfolioIds.length < 2) return { error: "Pick at least two portfolios for the group." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("portfolio_groups").insert({ family_id: familyId, name: clean }).select("id").single();
  if (error) return { error: error.code === "23505" ? "A group with that name already exists in this family." : error.message };
  const { error: mErr } = await supabase
    .from("portfolio_group_members")
    .insert(portfolioIds.map((portfolio_id) => ({ group_id: data.id, portfolio_id })));
  if (mErr) {
    await supabase.from("portfolio_groups").delete().eq("id", data.id);
    return { error: mErr.message };
  }
  revalidatePath("/", "layout");
  return { id: data.id };
}

// Creates the prototype's sample family in the signed-in account, so the app can be compared with the prototype.
export async function loadDemoFamily(): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in first." };

  const { data: existing } = await supabase.from("families").select("id").eq("name", DEMO_FAMILY_NAME).maybeSingle();
  if (existing) redirect(`/family/${existing.id}`);

  const { data: fam, error: famErr } = await supabase.from("families").insert({ name: DEMO_FAMILY_NAME }).select("id").single();
  if (famErr) return { error: famErr.message };

  const { data: ports, error: pErr } = await supabase
    .from("portfolios")
    .insert([
      ...DEMO_PORTFOLIOS.map((p, i) => ({ family_id: fam.id, name: p.name, type: p.type, book: "inv", sort: i })),
      { family_id: fam.id, name: DEMO_FNO_PORTFOLIO, type: "individual", book: "fno", sort: 0 },
    ])
    .select("id, name");
  if (pErr) return { error: pErr.message };

  // one private asset per distinct name
  const names = new Map<string, string>();
  DEMO_PORTFOLIOS.forEach((p) => p.holdings.forEach((x) => names.set(x.name, x.cls)));
  const { data: assets, error: aErr } = await supabase
    .from("assets")
    .insert([...names].map(([name, cls]) => ({ name, asset_class: cls, owner_id: auth.user!.id })))
    .select("id, name");
  if (aErr) return { error: aErr.message };
  const assetId = new Map(assets.map((a) => [a.name, a.id]));
  const portId = new Map(ports.map((p) => [p.name, p.id]));

  const rows = DEMO_PORTFOLIOS.flatMap((p) =>
    p.holdings.flatMap((x) =>
      x.lots.map(([date, qty, price], i) => {
        const balance = classInfo(x.cls).balance;
        return {
          portfolio_id: portId.get(p.name)!,
          asset_id: assetId.get(x.name)!,
          type: balance ? "deposit" : "buy",
          trade_date: date,
          quantity: qty,
          price_paise: toPaise(price),
          amount_paise: toPaise(qty * price),
          source_ref: `demo:${x.name}:${i}`,
          notes: "Demo data",
        };
      }),
    ),
  );
  const { error: tErr } = await supabase.from("transactions").insert(rows);
  if (tErr) return { error: tErr.message };

  revalidatePath("/", "layout");
  redirect(`/family/${fam.id}`);
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
