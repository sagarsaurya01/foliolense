"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAmountFormat, setDefaultView, setRisk, type AmountFmt, type RiskLevel } from "@/app/actions";

export interface Prefs {
  amountFmt: AmountFmt;
  risk: { age: number; level: RiskLevel } | null;
  landing: { familyId: string; book: "inv" | "fno" } | null;
}

const segStyle = (on: boolean): React.CSSProperties => ({
  flex: 1, border: 0, padding: "5px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
  background: on ? "var(--brand)" : "transparent", color: on ? "var(--brand-ink)" : "var(--muted)",
});

export function Preferences({ families, prefs }: { families: { id: string; name: string }[]; prefs: Prefs }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [fmt, setFmt] = useState<AmountFmt>(prefs.amountFmt);
  const [age, setAge] = useState(prefs.risk?.age ? String(prefs.risk.age) : "");
  const [level, setLevel] = useState<RiskLevel | "">(prefs.risk?.level ?? "");
  const [fam, setFam] = useState(prefs.landing?.familyId ?? "");
  const [book, setBook] = useState<"inv" | "fno">(prefs.landing?.book ?? "inv");

  const save = (fn: () => Promise<unknown>) => start(() => { void fn().then(() => router.refresh()); });

  return (
    <div style={{ padding: "8px 10px", display: "grid", gap: 14, minWidth: 230 }}>
      {/* Display amounts */}
      <div style={{ display: "grid", gap: 6 }}>
        <span className="label">Display amounts</span>
        <div className="seg" role="group" aria-label="Display amounts">
          {(["full", "short"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={fmt === m} style={segStyle(fmt === m)}
              onClick={() => { setFmt(m); save(() => setAmountFormat(m)); }}>
              {m === "full" ? "Full ₹1,23,456" : "Short ₹1.2 L"}
            </button>
          ))}
        </div>
      </div>

      {/* Risk profile */}
      <div style={{ display: "grid", gap: 6 }}>
        <span className="label">Risk profile</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="inp" type="number" min={18} max={99} placeholder="Age" value={age}
            onChange={(e) => setAge(e.target.value)} style={{ width: 70 }} />
          <div className="seg" role="group" aria-label="Risk level" style={{ flex: 1 }}>
            {(["conservative", "balanced", "aggressive"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={level === l} style={segStyle(level === l)}
                onClick={() => setLevel(l)}>
                {l === "conservative" ? "Low" : l === "balanced" ? "Medium" : "High"}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" style={{ justifyContent: "center" }} disabled={!age || !level}
          onClick={() => level && save(() => setRisk(Number(age), level))}>
          Save profile
        </button>
        <span className="mut" style={{ fontSize: 11 }}>Unlocks your target mix &amp; goals in Review.</span>
      </div>

      {/* Default view */}
      <div style={{ display: "grid", gap: 6 }}>
        <span className="label">Default view on open</span>
        <select className="inp" value={fam} onChange={(e) => setFam(e.target.value)}>
          <option value="">First family (default)</option>
          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Default book">
          {(["inv", "fno"] as const).map((b) => (
            <button key={b} type="button" aria-pressed={book === b} style={segStyle(book === b)} onClick={() => setBook(b)}>
              {b === "inv" ? "Investments" : "F&O"}
            </button>
          ))}
        </div>
        <button className="btn" style={{ justifyContent: "center" }}
          onClick={() => save(() => setDefaultView(fam, book))}>
          Save default view
        </button>
      </div>
    </div>
  );
}
