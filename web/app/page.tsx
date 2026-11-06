import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";
import { supabaseServer } from "@/lib/supabase/server";

// Home: open the first family, or offer to create one.
export default async function Home() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");

  const { data: families, error } = await supabase.from("families").select("id").order("created_at");
  if (error) {
    return (
      <main className="empty" style={{ minHeight: "100vh" }}>
        <b style={{ color: "var(--ink)" }}>The database isn&apos;t set up yet.</b>
        <span>Run supabase/migrations/0001_init.sql in the Supabase SQL Editor, then reload.</span>
        <code className="note">{error.message}</code>
      </main>
    );
  }
  if (families.length) {
    // "Default view on open" preference, if it still points to a real family
    let landing: { familyId?: string; book?: string } | null = null;
    try { landing = JSON.parse((await cookies()).get("landing")?.value ?? "null"); } catch { landing = null; }
    const target = landing?.familyId && families.some((f) => f.id === landing!.familyId) ? landing.familyId : families[0].id;
    const book = landing?.book === "fno" && landing.familyId === target ? "?book=fno" : "";
    redirect(`/family/${target}${book}`);
  }
  return <Onboarding email={auth.user.email ?? ""} />;
}
