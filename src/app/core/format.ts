const inrFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/** ₹12,500 — Indian grouping, no paise. */
export const inr = (n: number) => inrFormat.format(Math.round(n || 0));
/** ₹1,284.50 for a bill with paise, ₹18,000 for one without. */
export const inrExactly = (n: number) => (Number.isInteger(n || 0) ? inr(n) : inrExact.format(n));
export const num = (n: number) => numberFormat.format(Math.round(n || 0));
export const dec1 = (n: number) => oneDecimal.format(n || 0);

export function round1(n: number): number {
  return Math.round((n || 0) * 10) / 10;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function newId(): string {
  return crypto.randomUUID();
}
