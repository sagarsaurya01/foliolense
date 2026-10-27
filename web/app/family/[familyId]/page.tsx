import { notFound, redirect } from "next/navigation";
import { Shell, type ShellGroup } from "@/components/Shell";
import type { AssetOption } from "@/components/TxDialog";
import { todayIST, type TxRow } from "@/lib/holdings";
import { supabaseServer } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ p?: string; book?: string; tab?: string }>;
};

export default async function FamilyPage({ params, searchParams }: Props) {
  const { familyId } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");

  const [{ data: families }, { data: portfolios }, { data: groupRows }, { data: assets }] = await Promise.all([
    supabase.from("families").select("id, name").order("created_at"),
    supabase.from("portfolios").select("id, family_id, name, type, book").order("sort").order("created_at"),
    supabase
      .from("portfolio_groups")
      .select("id, name, members:portfolio_group_members(portfolio_id)")
      .eq("family_id", familyId)
      .order("sort")
      .order("created_at"),
    supabase.from("assets").select("id, name, asset_class").order("name").limit(5000),
  ]);
  const family = families?.find((f) => f.id === familyId);
  if (!family) notFound();

  const book = sp.book === "fno" ? "fno" : "inv";
  const mine = (portfolios ?? []).filter((p) => p.family_id === familyId);
  const inBook = mine.filter((p) => p.book === book);
  const groups: ShellGroup[] = (groupRows ?? []).map((g) => ({
    id: `g:${g.id}`,
    name: g.name,
    members: (g.members as { portfolio_id: string }[]).map((m) => m.portfolio_id),
  }));
  const group = book === "inv" ? groups.find((g) => g.id === sp.p) : undefined;
  const selected = group ? group.id : sp.p && inBook.some((p) => p.id === sp.p) ? sp.p : book === "inv" ? "all" : inBook[0]?.id ?? "all";
  const scope = group ? group.members : selected === "all" ? inBook.map((p) => p.id) : [selected];

  let rows: TxRow[] = [];
  const feed: [string, { close_paise: number; prev_close_paise: number | null; price_date: string }][] = [];
  if (book === "inv" && scope.length) {
    const { data } = await supabase
      .from("transactions")
      .select("id, portfolio_id, asset_id, type, trade_date, quantity, price_paise, amount_paise, charges_paise, notes, asset:assets(id, name, asset_class, isin, meta)")
      .in("portfolio_id", scope)
      .order("trade_date")
      .limit(50000);
    rows = (data ?? []) as unknown as TxRow[];
    // daily prices for the linked holdings (by ISIN)
    const isins = [...new Set(rows.map((r) => r.asset.isin).filter(Boolean))] as string[];
    if (isins.length) {
      const { data: fp } = await supabase
        .from("instrument_prices")
        .select("isin, close_paise, prev_close_paise, price_date")
        .in("isin", isins);
      (fp ?? []).forEach((p) => feed.push([p.isin, { close_paise: p.close_paise, prev_close_paise: p.prev_close_paise, price_date: p.price_date }]));
    }
  }
  const { data: idx } = await supabase.from("index_prices").select("index_code, close, prev_close, price_date").order("price_date", { ascending: false }).limit(12);

  return (
    <Shell
      email={auth.user.email ?? ""}
      families={families ?? []}
      family={family}
      portfolios={portfolios ?? []}
      groups={groups}
      book={book}
      selected={selected}
      tab={sp.tab ?? "ALL"}
      rows={rows}
      feed={feed}
      indices={(idx ?? []) as { index_code: string; close: number; prev_close: number | null; price_date: string }[]}
      assets={(assets ?? []) as AssetOption[]}
      asOf={todayIST()}
    />
  );
}
