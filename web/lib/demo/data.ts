// Curated demo dataset for the FolioLense product demo (not real data).
// A realistic Indian family so every dashboard card is full. All rupee amounts
// are whole rupees; formatting helpers below render them the Indian way.

export const DEMO_FAMILY = "Sharma Family";
export const DEMO_FY = "FY 2025-26";
export const DEMO_AS_OF = "28 Oct 2026";

export type Cls =
  | "Indian Equity"
  | "Mutual Fund"
  | "F&O"
  | "Fixed Deposit"
  | "PPF / EPF"
  | "NPS"
  | "Gold"
  | "Bonds"
  | "Insurance"
  | "Private Equity"
  | "Bank";

export interface Holding {
  id: string;
  member: string;
  name: string;
  cls: Cls;
  invested: number;
  current: number;
  units?: number;
  ltp?: number;
  note?: string;
}

export const MEMBERS = [
  { name: "Rajesh Sharma", role: "Self", age: 48 },
  { name: "Priya Sharma", role: "Spouse", age: 45 },
  { name: "Sharma HUF", role: "HUF", age: null as number | null },
  { name: "Aarav Sharma", role: "Son", age: 16 },
];

// ---- Holdings ---------------------------------------------------------------
export const HOLDINGS: Holding[] = [
  // Rajesh — direct equity
  { id: "e1", member: "Rajesh Sharma", name: "Reliance Industries", cls: "Indian Equity", units: 220, ltp: 2920, invested: 517000, current: 642400 },
  { id: "e2", member: "Rajesh Sharma", name: "HDFC Bank", cls: "Indian Equity", units: 300, ltp: 1690, invested: 444000, current: 507000 },
  { id: "e3", member: "Rajesh Sharma", name: "Infosys", cls: "Indian Equity", units: 260, ltp: 1560, invested: 369200, current: 405600 },
  { id: "e4", member: "Rajesh Sharma", name: "ITC", cls: "Indian Equity", units: 900, ltp: 445, invested: 355500, current: 400500 },
  { id: "e5", member: "Rajesh Sharma", name: "Tata Motors", cls: "Indian Equity", units: 500, ltp: 940, invested: 310000, current: 470000, note: "top gainer" },
  { id: "e6", member: "Rajesh Sharma", name: "Zomato", cls: "Indian Equity", units: 1500, ltp: 178, invested: 142500, current: 267000 },
  { id: "e7", member: "Rajesh Sharma", name: "Adani Enterprises", cls: "Indian Equity", units: 90, ltp: 2420, invested: 252000, current: 217800, note: "below cost" },
  { id: "e8", member: "Rajesh Sharma", name: "Yes Bank", cls: "Indian Equity", units: 4000, ltp: 19, invested: 88000, current: 76000, note: "below cost" },

  // Priya — mutual funds (SIPs)
  { id: "m1", member: "Priya Sharma", name: "Parag Parikh Flexi Cap", cls: "Mutual Fund", invested: 720000, current: 1058000 },
  { id: "m2", member: "Priya Sharma", name: "Mirae Asset Large Cap", cls: "Mutual Fund", invested: 480000, current: 604000 },
  { id: "m3", member: "Priya Sharma", name: "SBI Small Cap", cls: "Mutual Fund", invested: 360000, current: 566000 },
  { id: "m4", member: "Priya Sharma", name: "Axis Bluechip", cls: "Mutual Fund", invested: 300000, current: 318000, note: "lagging" },
  { id: "m5", member: "Priya Sharma", name: "HDFC Balanced Advantage", cls: "Mutual Fund", invested: 420000, current: 503000 },
  { id: "m6", member: "Priya Sharma", name: "UTI Nifty 50 Index", cls: "Mutual Fund", invested: 300000, current: 402000 },

  // Rajesh — F&O (net open; realised shown in Hindsight)
  { id: "f1", member: "Rajesh Sharma", name: "Nifty / Bank Nifty options", cls: "F&O", invested: 0, current: 0, note: "net squared off; see realised" },

  // Sharma HUF + family — deposits, gold, retirement
  { id: "d1", member: "Sharma HUF", name: "HDFC Bank FD · 7.1%", cls: "Fixed Deposit", invested: 800000, current: 842000 },
  { id: "d2", member: "Sharma HUF", name: "SGB Gold (3 tranches)", cls: "Gold", invested: 460000, current: 712000 },
  { id: "d3", member: "Sharma HUF", name: "RBI Floating Rate Bond", cls: "Bonds", invested: 500000, current: 534000 },
  { id: "p1", member: "Rajesh Sharma", name: "PPF", cls: "PPF / EPF", invested: 950000, current: 1180000 },
  { id: "p2", member: "Rajesh Sharma", name: "EPF", cls: "PPF / EPF", invested: 1040000, current: 1310000 },
  { id: "n1", member: "Rajesh Sharma", name: "NPS Tier-1 (75% equity)", cls: "NPS", invested: 520000, current: 686000 },
  { id: "d4", member: "Priya Sharma", name: "SBI FD · 6.8%", cls: "Fixed Deposit", invested: 400000, current: 418000 },

  // remaining asset types, so the demo shows every option FolioLense supports
  { id: "i1", member: "Rajesh Sharma", name: "HDFC Life ULIP", cls: "Insurance", invested: 300000, current: 352000 },
  { id: "pe1", member: "Sharma HUF", name: "Unlisted startup (angel)", cls: "Private Equity", invested: 500000, current: 740000 },
  { id: "b1", member: "Rajesh Sharma", name: "Savings + sweep balance", cls: "Bank", invested: 325000, current: 325000 },
];

// ---- Derived totals ---------------------------------------------------------
export const totalInvested = HOLDINGS.reduce((s, h) => s + h.invested, 0);
export const totalCurrent = HOLDINGS.reduce((s, h) => s + h.current, 0);
export const totalGain = totalCurrent - totalInvested;
export const totalGainPct = (totalGain / totalInvested) * 100;

export interface Slice { cls: Cls; current: number; pct: number; }
export const allocation: Slice[] = (() => {
  const by = new Map<Cls, number>();
  for (const h of HOLDINGS) by.set(h.cls, (by.get(h.cls) ?? 0) + h.current);
  return [...by.entries()]
    .map(([cls, current]) => ({ cls, current, pct: (current / totalCurrent) * 100 }))
    .sort((a, b) => b.current - a.current);
})();

export interface MemberRow { name: string; role: string; current: number; gain: number; pct: number; }
export const byMember: MemberRow[] = MEMBERS.map((m) => {
  const hs = HOLDINGS.filter((h) => h.member === m.name);
  const current = hs.reduce((s, h) => s + h.current, 0);
  const invested = hs.reduce((s, h) => s + h.invested, 0);
  return { name: m.name, role: m.role, current, gain: current - invested, pct: (current / totalCurrent) * 100 };
}).filter((r) => r.current > 0);

// ---- Hindsight (year-1 story, scripted but consistent) ----------------------
export const hindsight = {
  fy: DEMO_FY,
  realised: 468000, // booked gains this FY (equity + F&O net)
  unrealisedForYear: 712000, // growth in open positions this FY
  get gainThisYear() { return this.realised + this.unrealisedForYear; },
  estTax: 118000,
  inflationPct: 5.8,
  // "Was it worth the effort" — same money over the same dates
  returns: { you: 14.2, fd: 7.1, nifty: 11.5 },
  // Where did the gain come from
  winners: [
    { name: "Parag Parikh Flexi Cap", member: "Priya", gain: 338000 },
    { name: "SBI Small Cap", member: "Priya", gain: 206000 },
    { name: "Tata Motors", member: "Rajesh", gain: 160000 },
  ],
  losers: [
    { name: "Adani Enterprises", member: "Rajesh", gain: -34200 },
    { name: "Yes Bank", member: "Rajesh", gain: -12000 },
    { name: "Axis Bluechip", member: "Priya", gain: 18000 },
  ],
  // Did my gut work
  decisions: [
    { name: "Sold Tata Motors (half) at ₹820", verdict: "behind" as const, note: "It ran to ₹940 — holding would have earned ₹60,000 more." },
    { name: "Added HDFC Bank in the March dip", verdict: "ahead" as const, note: "Up ₹63,000 since; better than buying the index that day." },
    { name: "Booked Reliance F&O early", verdict: "early" as const, note: "Too soon to judge — position is still moving." },
  ],
  soldEarly: [
    { name: "Tata Motors (partial)", rs: 60000 },
    { name: "Dixon Technologies", rs: 41000 },
  ],
  heldLong: [
    { name: "Yes Bank", rs: 28000, note: "flat-to-down for 3 years" },
    { name: "Vodafone Idea", rs: 15000, note: "no recovery" },
  ],
  discipline: {
    score: 78,
    sipsKept: 11,
    sipsStopped: 1,
    boughtInDip: 3,
    panicSells: 1,
    events: [
      "Kept 11 of 12 monthly SIPs running through the year",
      "Added in the March correction instead of selling",
      "One panic sell during the August dip (Zomato, later recovered)",
    ],
  },
  luckSkill: {
    marketPct: 64,
    selectionPct: 36,
    sentence: "About two-thirds of this year's gain came from the market rising; one-third from your picks. One year is too short to call it skill.",
  },
};

// ---- Advisor view -----------------------------------------------------------
export type Status = "green" | "amber" | "red";

export const FRAMEWORKS = [
  "Age-based allocation",
  "Core & satellite",
  "Goal buckets",
  "Factor tilt",
  "Low-cost index",
  "All-weather",
];

export interface Lens {
  n: number;
  title: string;
  question: string;
  status: Status;
  impact?: number;
  metric: string;
  reason: string;
  fix: string;
}

export const LENSES: Lens[] = [
  { n: 1, title: "Asset allocation", question: "Is my mix right for my age and goals?", status: "amber", impact: 1800000, metric: "Equity 61% vs 55% target", reason: "At 48 you're slightly equity-heavy for your risk profile; debt is a touch light.", fix: "Move about ₹6L from small-cap into short-duration debt over 3 months." },
  { n: 2, title: "Concentration", question: "Am I too dependent on one name or sector?", status: "red", impact: 760000, metric: "Banks + financials = 34% of equity", reason: "HDFC Bank, Yes Bank and bank-heavy funds overlap into one sector bet.", fix: "Trim bank exposure toward 20%; add a diversified or consumption fund." },
  { n: 3, title: "MF overlap", question: "Do my funds own the same stocks?", status: "amber", metric: "41% overlap across 3 large-caps", reason: "Mirae, Axis and UTI Nifty hold many of the same top names — you're paying 3 fees for 1 bet.", fix: "Keep one large-cap, redirect the other SIP to a flexi or mid-cap." },
  { n: 4, title: "Cost drag", question: "What do I lose to fees and regular plans?", status: "red", impact: 214000, metric: "₹21,400 / yr, ₹2.14L over 10 yrs", reason: "Two funds are regular plans; the direct versions cost ~1% less each year.", fix: "Switch both to direct plans — same fund, lower expense ratio." },
  { n: 5, title: "Benchmark & peers", question: "Is each holding beating its index?", status: "amber", metric: "Axis Bluechip: −3.1% vs Nifty 100", reason: "One fund has trailed its benchmark for 3 years and sits in the bottom quartile.", fix: "Replace Axis Bluechip with a category leader or an index fund." },
  { n: 6, title: "Risk", question: "How far can this portfolio fall?", status: "amber", impact: 3600000, metric: "~30% drop ≈ −₹36L in a crash", reason: "Small-cap and single stocks lift volatility above your stated comfort.", fix: "The debt shift in lens 1 cuts the worst-case fall by about a third." },
  { n: 7, title: "Quality & valuation", question: "Are my stocks healthy?", status: "red", metric: "2 names flagged", reason: "Yes Bank: weak profitability; Adani Ent: rich valuation vs sector.", fix: "Review both; set an exit level rather than averaging down." },
  { n: 8, title: "Liquidity", question: "Can I get cash when I need it?", status: "green", metric: "₹18.6L reachable in 1 week", reason: "Enough liquid equity and FDs for an emergency without breaking long-term money.", fix: "No action — keep 6 months of expenses this liquid." },
  { n: 9, title: "Income", question: "What cash does this produce?", status: "green", impact: 142000, metric: "₹1.42L / yr · ~1.2% yield", reason: "Dividends, FD and bond interest give a steady, if small, income stream.", fix: "On track; the floating-rate bond will step up if rates rise." },
  { n: 10, title: "Behaviour", question: "Do I churn or panic?", status: "green", metric: "Discipline 78/100", reason: "SIPs mostly kept, few panic sells — behaviour is a strength here.", fix: "Keep automating SIPs so one bad month doesn't break the habit." },
];

export interface Gap { area: string; title: string; severity: Status; estRs?: number; why: string; fix: string; }
export const GAPS: Gap[] = [
  { area: "Protection", title: "Term life cover looks short", severity: "red", estRs: 15000000, why: "A ₹1.5Cr term cover is missing for the family's main earner — the biggest single risk.", fix: "Buy ₹1.5Cr term till age 60; ~₹18,000/yr at 48." },
  { area: "Protection", title: "No health cover for parents", severity: "red", why: "One hospital stay could undo a year of gains.", fix: "Add a ₹10L family-floater or senior-citizen policy." },
  { area: "Emergency", title: "Emergency fund a bit thin", severity: "amber", estRs: 300000, why: "Liquid money covers ~4 months; 6 is safer.", fix: "Park ₹3L more in a liquid fund or sweep-in FD." },
  { area: "Tax", title: "80C not fully used", severity: "amber", estRs: 46000, why: "₹46,000 of the ₹1.5L 80C limit is unused this year.", fix: "Top up PPF or ELSS before 31 March." },
  { area: "Estate", title: "Nominees not set everywhere", severity: "amber", why: "Some folios and the demat have no nominee on record.", fix: "Add nominees across all accounts — a 10-minute job." },
  { area: "Goals", title: "Child-education goal unfunded", severity: "amber", estRs: 2500000, why: "Aarav's higher education is ~2 years away with no earmarked corpus.", fix: "Start a ₹25,000/mo SIP in a short-duration + hybrid mix." },
];

export interface Goal { name: string; target: number; have: number; years: number; monthly: number; }
export const GOALS: Goal[] = [
  { name: "Aarav's education", target: 2500000, have: 400000, years: 2, monthly: 25000 },
  { name: "Retirement (age 60)", target: 50000000, have: 24000000, years: 12, monthly: 45000 },
  { name: "Home renovation", target: 1500000, have: 900000, years: 1, monthly: 50000 },
];

export const NEXT_ACTIONS = [
  { title: "Buy ₹1.5Cr term insurance", impact: "Covers the family's biggest risk", kind: "red" as Status },
  { title: "Switch 2 funds to direct plans", impact: "Saves ₹21,400 every year", kind: "amber" as Status },
  { title: "Trim bank exposure to 20%", impact: "Cuts a ₹7.6L concentration risk", kind: "amber" as Status },
];

export const lensCount = (s: Status) => LENSES.filter((l) => l.status === s).length;

// ---- CA view ----------------------------------------------------------------
export const capitalGains = {
  fy: DEMO_FY,
  rows: [
    { kind: "Equity — short term (STCG)", gain: 184000, rate: "20%", tax: 36800 },
    { kind: "Equity — long term (LTCG)", gain: 212000, rate: "12.5% over ₹1.25L", tax: 10875 },
    { kind: "Equity MF — long term", gain: 96000, rate: "12.5%", tax: 0 },
    { kind: "Debt / bonds — at slab", gain: 18000, rate: "slab", tax: 5400 },
    { kind: "F&O — business income", gain: 162000, rate: "slab", tax: 48600 },
  ],
  ltcgExemptUsed: 125000,
};
export const harvest = {
  headroomRs: 29000, // unused LTCG exemption
  text: "You can still book about ₹29,000 of long-term equity gains before 31 March tax-free, using the remaining ₹1.25L 112A exemption.",
};
export const income = {
  dividends: 48000,
  interest: 94000,
  tdsDeducted: 12400,
  ais: "matched to AIS / 26AS",
};
export const regime = {
  old: { tax: 318000, note: "with 80C, 80D, NPS, home-loan interest" },
  new: { tax: 352000, note: "lower slabs, no deductions" },
  savesOld: 34000,
};
export interface CalItem { date: string; label: string; kind: "sip" | "tax" | "maturity" | "premium" | "corp"; }
export const calendar: CalItem[] = [
  { date: "05 Nov", label: "PPF deposit reminder (before the 5th)", kind: "sip" },
  { date: "15 Dec", label: "Advance tax — 3rd instalment", kind: "tax" },
  { date: "20 Dec", label: "HDFC Bank FD matures — ₹8.42L", kind: "maturity" },
  { date: "02 Jan", label: "Term + health premium due", kind: "premium" },
  { date: "10 Jan", label: "Reliance dividend record date", kind: "corp" },
  { date: "15 Mar", label: "Advance tax — final instalment", kind: "tax" },
  { date: "28 Mar", label: "Tax-harvest window closes", kind: "tax" },
];
export interface FamilyRow { name: string; role: string; assets: number; loans: number; nominee: string; }
export const familyTable: FamilyRow[] = [
  { name: "Rajesh Sharma", role: "Self", assets: 6162000, loans: 1800000, nominee: "Priya Sharma" },
  { name: "Priya Sharma", role: "Spouse", assets: 3869000, loans: 0, nominee: "Rajesh Sharma" },
  { name: "Sharma HUF", role: "HUF", assets: 2088000, loans: 0, nominee: "Not set" },
  { name: "Aarav Sharma", role: "Son (minor)", assets: 0, loans: 0, nominee: "—" },
];
export const familyNetWorth = familyTable.reduce((s, r) => s + r.assets - r.loans, 0);
export const totalCapGainsTax = capitalGains.rows.reduce((s, r) => s + r.tax, 0);

// ---- Formatting (Indian) ----------------------------------------------------
const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inr = (rs: number) => "₹" + inrFmt.format(Math.round(rs));
export const inrSigned = (rs: number) => (rs >= 0 ? "+" : "−") + "₹" + inrFmt.format(Math.abs(Math.round(rs)));
export function inrShort(rs: number): string {
  const a = Math.abs(rs);
  const s = rs < 0 ? "−₹" : "₹";
  if (a >= 1e7) return s + (a / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return s + (a / 1e5).toFixed(2) + " L";
  if (a >= 1e3) return s + (a / 1e3).toFixed(0) + "K";
  return s + Math.round(a);
}
