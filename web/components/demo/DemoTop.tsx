"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/demo", label: "Overview", hint: "Portfolio" },
  { href: "/demo/advisor", label: "Review", hint: "Lenses" },
  { href: "/demo/ca", label: "Tax", hint: "Capital gains" },
];

export function DemoTop() {
  const path = usePathname();
  return (
    <header className="demo-top">
      <div className="demo-top-in">
        <Link href="/demo" className="auth-logo sm" aria-label="FolioLense home" style={{ color: "var(--brand-ink)" }}>
          <span className="auth-mark" style={{ width: 24, height: 24 }} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M4 15l4-4 3 3 5-6 4 4" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Folio<b>Lense</b>
        </Link>

        <nav className="demo-tabs">
          {TABS.map((t) => {
            const active = t.href === "/demo" ? path === "/demo" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className="demo-tab" aria-current={active || undefined}>
                {t.label}
                <small>{t.hint}</small>
              </Link>
            );
          })}
        </nav>

        <div className="demo-top-right">
          <span className="demo-badge">Demo data</span>
        </div>
      </div>
    </header>
  );
}
