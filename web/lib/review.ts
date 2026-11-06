// Advisor "review lenses" computed from the family's real holdings. Only the lenses that the
// current data can answer honestly are here: allocation overview, concentration, liquidity and
// income. Personalised targets (needs age/risk), cost drag (needs expense ratios), MF overlap and
// quality/benchmark (need a data vendor) are deliberately left out until that data exists.
import { fyOf } from "./calc/gains";
import { shortRupees } from "./format";
import type { Holding, TxRow } from "./holdings";

export type Status = "green" | "amber" | "red";

export type Group = "Equity" | "Debt & cash" | "Gold" | "Retirement";
const GROUP: Record<string, Group> = {
  EQ: "Equity", MFE: "Equity", SIF: "Equity", PE: "Equity",
  MFD: "Debt & cash", FD: "Debt & cash", CD: "Debt & cash", BNK: "Debt & cash",
  GLD: "Gold",
  ULP: "Retirement", PPF: "Retirement", INS: "Retirement",
};
const GROUP_ORDER: Group[] = ["Equity", "Debt & cash", "Gold", "Retirement"];
const LIQUID = new Set(["EQ", "MFE", "MFD", "SIF", "GLD", "BNK"]); // sellable in roughly a week

export interface Lens {
  title: string;
  question: string;
  status: Status;
  metric: string;
  impactPaise?: number;
  reason: string;
  fix: string;
}
export interface Slice { group: Group; valuePaise: number; pct: number; }
export interface Review {
  totalPaise: number;
  slices: Slice[];
  equityPct: number;
  lenses: Lens[];
}

const valueOf = (h: Holding) => h.fig.currentPaise ?? h.fig.investedPaise;

export interface RiskProfile { age: number; level: "conservative" | "balanced" | "aggressive"; }

/** A starting-point equity target: (100 − age), nudged by risk comfort, clamped 10–90%. */
function targetEquity(r: RiskProfile): number {
  const base = 100 - r.age;
  const adj = r.level === "conservative" ? -10 : r.level === "aggressive" ? 10 : 0;
  return Math.max(10, Math.min(90, base + adj));
}

function allocationLens(risk: RiskProfile | null | undefined, equityPct: number, debtPaise: number, total: number): Lens {
  const debtPct = Math.round((debtPaise / total) * 100);
  if (!risk) {
    return {
      title: "Asset allocation",
      question: "What is my money split into?",
      status: equityPct > 80 || equityPct < 20 ? "amber" : "green",
      metric: `Equity ${equityPct.toFixed(0)}% · Debt & cash ${debtPct}%`,
      reason: equityPct > 80
        ? "You're heavily in equity — great in a rising market, but a fall will hurt more."
        : equityPct < 20
          ? "You're light on equity — safe, but long-term growth may lag inflation."
          : "Your equity-to-debt balance looks reasonable for a long-term investor.",
      fix: "Set your age and risk comfort in Preferences to get an exact target and rebalance amount.",
    };
  }
  const tgt = targetEquity(risk);
  const gap = equityPct - tgt; // positive = too much equity
  const off = Math.abs(gap);
  const rebalance = Math.round((off / 100) * total);
  const status: Status = off <= 7 ? "green" : off <= 15 ? "amber" : "red";
  return {
    title: "Asset allocation",
    question: "Is my mix right for my age and risk?",
    status,
    metric: `Equity ${equityPct.toFixed(0)}% vs ${tgt}% target`,
    impactPaise: off > 7 ? rebalance : undefined,
    reason: off <= 7
      ? "Your equity level is close to the target for your age and risk comfort."
      : gap > 0
        ? "You're carrying more equity than your profile suggests — a fall would hurt more."
        : "You're lighter on equity than your profile suggests — long-term growth may lag.",
    fix: off <= 7
      ? "No change needed — just rebalance once a year."
      : gap > 0
        ? `Move about ${shortRupees(rebalance)} from equity into debt to reach ${tgt}%.`
        : `Move about ${shortRupees(rebalance)} from debt into equity to reach ${tgt}%.`,
  };
}

export function computeReview(holdings: Holding[], rows: TxRow[], asOf: string, risk?: RiskProfile | null): Review {
  const priced = holdings.filter((h) => valueOf(h) > 0);
  const total = priced.reduce((s, h) => s + valueOf(h), 0) || 1;

  // allocation by broad group
  const byGroup = new Map<Group, number>();
  for (const h of priced) {
    const g = GROUP[h.cls] ?? "Debt & cash";
    byGroup.set(g, (byGroup.get(g) ?? 0) + valueOf(h));
  }
  const slices: Slice[] = GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g, valuePaise: byGroup.get(g)!, pct: (byGroup.get(g)! / total) * 100,
  }));
  const equityPct = (byGroup.get("Equity") ?? 0) / total * 100;

  // concentration: largest single holding, top 5
  const sorted = [...priced].sort((a, b) => valueOf(b) - valueOf(a));
  const topValue = sorted.length ? valueOf(sorted[0]) : 0;
  const topPct = (topValue / total) * 100;
  const top5Pct = (sorted.slice(0, 5).reduce((s, h) => s + valueOf(h), 0) / total) * 100;
  const singleStocks = sorted.filter((h) => h.cls === "EQ" || h.cls === "PE");
  const bigStock = singleStocks[0];
  const bigStockPct = bigStock ? (valueOf(bigStock) / total) * 100 : 0;

  // liquidity: reachable in ~1 week
  const liquidPaise = priced.filter((h) => LIQUID.has(h.cls)).reduce((s, h) => s + valueOf(h), 0);
  const liquidPct = (liquidPaise / total) * 100;

  // income: dividends + interest this FY, as a yield on current value
  const fy = fyOf(asOf);
  const incomePaise = rows
    .filter((r) => (r.type === "dividend" || r.type === "interest") && fyOf(r.trade_date) === fy)
    .reduce((s, r) => s + Number(r.amount_paise), 0);
  const yieldPct = (incomePaise / total) * 100;

  const lenses: Lens[] = [
    allocationLens(risk, equityPct, byGroup.get("Debt & cash") ?? 0, total),
    {
      title: "Concentration",
      question: "Am I too dependent on one holding?",
      status: bigStockPct > 15 || topPct > 20 ? "red" : bigStockPct > 10 || topPct > 15 ? "amber" : "green",
      metric: bigStock ? `${bigStock.name} = ${bigStockPct.toFixed(0)}% · top 5 = ${top5Pct.toFixed(0)}%` : `Top 5 = ${top5Pct.toFixed(0)}%`,
      impactPaise: bigStockPct > 10 && bigStock ? Math.round(valueOf(bigStock) - total * 0.1) : undefined,
      reason: bigStockPct > 15
        ? `A single holding is over 15% of everything you own — a lot riding on one name.`
        : topPct > 15
          ? "Your largest holding is a big slice of the whole portfolio."
          : "No single holding dominates — your money is spread out.",
      fix: bigStockPct > 10 ? "Trim the largest holding toward 10% and spread it across others." : "No action needed — keep it diversified.",
    },
    {
      title: "Liquidity",
      question: "Can I get cash quickly if I need it?",
      status: liquidPct >= 25 ? "green" : liquidPct >= 10 ? "amber" : "red",
      metric: `${(liquidPaise / 100 >= 1 ? liquidPct : 0).toFixed(0)}% reachable in ~1 week`,
      impactPaise: liquidPaise,
      reason: liquidPct >= 25
        ? "You can raise a good chunk of cash fast without breaking long-term money."
        : "Most of your money is in locked or slow-to-sell assets.",
      fix: liquidPct >= 25 ? "Keep 6 months of expenses this liquid." : "Build a liquid-fund or short-FD buffer for emergencies.",
    },
    {
      title: "Income",
      question: "What cash does this produce?",
      status: "green",
      metric: incomePaise > 0 ? `${yieldPct.toFixed(1)}% yield this year` : "No income booked yet this year",
      impactPaise: incomePaise > 0 ? incomePaise : undefined,
      reason: incomePaise > 0
        ? "Dividends and interest give you a steady cash stream on top of growth."
        : "No dividends or interest recorded this year — mostly growth assets, or income not yet entered.",
      fix: "Record dividend and interest credits so this stays accurate (import or add them).",
    },
  ];

  return { totalPaise: total, slices, equityPct, lenses };
}
