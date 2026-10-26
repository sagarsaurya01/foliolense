// Display formatting. Money is held as integer paise everywhere; these only format.
const INR = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function rupees(paise: number | bigint): string {
  return INR.format(Number(paise) / 100);
}

// ₹1.75 Cr / ₹12.40 L / ₹45,210
export function shortRupees(paise: number): string {
  const r = paise / 100;
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(2)} L`;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(r)}`;
}

export function quantity(q: number): string {
  const decimals = Number.isInteger(q) ? 0 : 3;
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(q);
}

export function initials(email: string): string {
  const name = email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}
