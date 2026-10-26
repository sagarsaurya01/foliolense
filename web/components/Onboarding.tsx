"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFamily, loadDemoFamily, signOut } from "@/app/actions";
import { Logo } from "./Logo";
import { ThemeButton } from "./ThemeSwitch";

export function Onboarding({ email }: { email: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await createFamily(name);
      if (r.error) setError(r.error);
      else router.push(`/family/${r.id}`);
    });
  };
  const demo = () =>
    start(async () => {
      const r = await loadDemoFamily();
      if (r?.error) setError(r.error);
    });

  return (
    <div className="auth">
      <header className="top">
        <div className="top-in pad">
          <Logo />
          <nav className="menu">
            <ThemeButton />
          </nav>
          <form action={signOut}>
            <button className="btn" style={{ background: "transparent", color: "var(--brand-ink)", borderColor: "var(--brand-muted)" }}>
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="auth-card">
        <h1>Welcome to FolioLense</h1>
        <p className="mut" style={{ margin: 0 }}>Signed in as {email}. Start with a family: a group of portfolios you track together.</p>
        <form onSubmit={create}>
          <label className="field">
            Family name
            <input id="familyName" placeholder="e.g. Laddha Family" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn primary" disabled={pending} style={{ justifyContent: "center" }}>
            Create family
          </button>
        </form>
        <div className="err" role="alert">{error}</div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "grid", gap: 8 }}>
          <span className="mut" style={{ fontSize: 13 }}>Or look around first with the sample family from the prototype.</span>
          <button className="btn" onClick={demo} disabled={pending} style={{ justifyContent: "center" }}>
            {pending ? "Loading…" : "Load demo family"}
          </button>
        </div>
      </div>
    </div>
  );
}
