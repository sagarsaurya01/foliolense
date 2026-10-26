// The 12 asset-class tabs (PRD S06). Balance-type classes have no quantity or unit price.
export type AssetClass = "EQ" | "MFE" | "MFD" | "SIF" | "BNK" | "ULP" | "INS" | "PE" | "FD" | "CD" | "PPF" | "GLD";

export const ASSET_CLASSES: { code: AssetClass; chip: string; name: string; balance?: true }[] = [
  { code: "EQ", chip: "EQ", name: "Stocks & ETFs" },
  { code: "MFE", chip: "MF", name: "Mutual Funds (Equity)" },
  { code: "MFD", chip: "MF", name: "Mutual Funds (Debt)" },
  { code: "SIF", chip: "SIF", name: "SIF" },
  { code: "BNK", chip: "BNK", name: "Banks", balance: true },
  { code: "ULP", chip: "ULP", name: "NPS / ULIP", balance: true },
  { code: "INS", chip: "INS", name: "Insurance", balance: true },
  { code: "PE", chip: "PE", name: "Private Equity" },
  { code: "FD", chip: "FD", name: "FDs", balance: true },
  { code: "CD", chip: "CD", name: "Deposits / Loans", balance: true },
  { code: "PPF", chip: "PPF", name: "PPF / EPF", balance: true },
  { code: "GLD", chip: "GLD", name: "Gold" },
];

export const classInfo = (code: string) => ASSET_CLASSES.find((c) => c.code === code) ?? ASSET_CLASSES[0];

export const PORTFOLIO_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "huf", label: "HUF" },
  { value: "company", label: "Company" },
  { value: "other", label: "Other" },
] as const;

export const typeLabel = (t: string) => PORTFOLIO_TYPES.find((x) => x.value === t)?.label ?? t;
