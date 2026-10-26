"use client";

import { useEffect, useState } from "react";
import { setTheme, type Theme } from "@/app/actions";

function current(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  void setTheme(theme);
}

const isDarkNow = () =>
  current() === "dark" || (current() === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

// One-click sun/moon button for the top bar: flips between light and dark.
export function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(isDarkNow()), []);
  return (
    <button
      type="button"
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        apply(dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" />
          </g>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.5 10.2A6 6 0 0 1 5.8 2.5 6 6 0 1 0 13.5 10.2z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

// System / Light / Dark choice for the user menu.
export function ThemeChoice() {
  const [theme, set] = useState<Theme>("system");
  useEffect(() => set(current()), []);
  return (
    <div style={{ padding: "6px 10px", display: "grid", gap: 6 }}>
      <span className="label">Theme</span>
      <div className="seg" role="group" aria-label="Theme">
        {(["system", "light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => {
              apply(t);
              set(t);
            }}
            style={{
              flex: 1,
              border: 0,
              padding: "5px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: theme === t ? "var(--brand)" : "transparent",
              color: theme === t ? "var(--brand-ink)" : "var(--muted)",
            }}
          >
            {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>
    </div>
  );
}
