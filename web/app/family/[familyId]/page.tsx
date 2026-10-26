import { notFound, redirect } from "next/navigation";
import { Shell, type ShellTx } from "@/components/Shell";
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

  const [{ data: families }, { data: portfolios }] = await Promise.all([
    supabase.from("families").select("id, name").order("created_at"),
    supabase.from("portfolios").select("id, family_id, name, type, book").order("sort").order("created_at"),
  ]);
  const family = families?.find((f) => f.id === familyId);
  if (!family) notFound();

  const book = sp.book === "fno" ? "fno" : "inv";
  const mine = (portfolios ?? []).filter((p) => p.family_id === familyId);
  const inBook = mine.filter((p) => p.book === book);
  const selected = sp.p && inBook.some((p) => p.id === sp.p) ? sp.p : book === "inv" ? "all" : inBook[0]?.id ?? "all";
  const scope = selected === "all" ? inBook.map((p) => p.id) : [selected];

  let tx: ShellTx[] = [];
  if (book === "inv" && scope.length) {
    const { data } = await supabase
      .from("transactions")
      .select("portfolio_id, type, trade_date, quantity, amount_paise, asset:assets(id, name, asset_class)")
      .in("portfolio_id", scope);
    tx = (data ?? []) as unknown as ShellTx[];
  }

  return (
    <Shell
      email={auth.user.email ?? ""}
      families={families ?? []}
      family={family}
      portfolios={portfolios ?? []}
      book={book}
      selected={selected}
      tab={sp.tab ?? "ALL"}
      tx={tx}
    />
  );
}
