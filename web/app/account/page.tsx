import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountForms } from "@/components/AccountForms";
import { Logo } from "@/components/Logo";
import { ThemeButton } from "@/components/ThemeSwitch";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "My Account · FolioLense" };

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/sign-in");
  const [{ count: families }, { count: portfolios }] = await Promise.all([
    supabase.from("families").select("id", { count: "exact", head: true }),
    supabase.from("portfolios").select("id", { count: "exact", head: true }),
  ]);
  return (
    <div className="auth">
      <header className="top">
        <div className="top-in pad">
          <Logo />
          <nav className="menu">
            <ThemeButton />
          </nav>
        </div>
      </header>
      <main className="pad" style={{ paddingBlock: 24, display: "grid", gap: 16, maxWidth: 720, width: "100%", margin: "0 auto" }}>
        <Link className="link" href="/">← Back to portfolios</Link>
        <h1 style={{ fontFamily: "var(--f-display)", margin: 0 }}>My Account</h1>
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 24px", margin: 0 }}>
          <dt className="mut">Email</dt><dd style={{ margin: 0 }}>{auth.user.email}</dd>
          <dt className="mut">Plan</dt><dd style={{ margin: 0 }}>Personal</dd>
          <dt className="mut">Families</dt><dd className="num" style={{ margin: 0 }}>{families ?? 0}</dd>
          <dt className="mut">Portfolios</dt><dd className="num" style={{ margin: 0 }}>{portfolios ?? 0}</dd>
          <dt className="mut">Member since</dt><dd style={{ margin: 0 }}>{new Date(auth.user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</dd>
        </dl>
        <AccountForms />
      </main>
    </div>
  );
}
