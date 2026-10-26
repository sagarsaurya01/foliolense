import { redirect } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";
import { supabaseServer } from "@/lib/supabase/server";

// Home: open the first family, or offer to create one.
export default async function Home() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");

  const { data: families, error } = await supabase.from("families").select("id").order("created_at").limit(1);
  if (error) {
    return (
      <main className="empty" style={{ minHeight: "100vh" }}>
        <b style={{ color: "var(--ink)" }}>The database isn&apos;t set up yet.</b>
        <span>Run supabase/migrations/0001_init.sql in the Supabase SQL Editor, then reload.</span>
        <code className="note">{error.message}</code>
      </main>
    );
  }
  if (families.length) redirect(`/family/${families[0].id}`);
  return <Onboarding email={auth.user.email ?? ""} />;
}
