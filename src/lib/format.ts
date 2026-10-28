export const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "AED", "SAR", "INR", "CAD", "AUD", "SGD", "MYR"] as const;

export function formatBDT(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `৳${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Money in the invoice's own currency. BDT uses the taka sign; others show the currency code. */
export function formatMoney(value: number | string | null | undefined, currency: string | null | undefined = "BDT"): string {
  if (!currency || currency === "BDT") return formatBDT(value);
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Plain-text money for PDFs (the standard PDF font has no taka sign). */
export function formatMoneyPlain(value: number | string | null | undefined, currency: string | null | undefined = "BDT"): string {
  const n = Number(value ?? 0);
  return `${currency || "BDT"} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Today's date in Dhaka as YYYY-MM-DD (the server may run in another time zone). */
export function todayDhaka(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}
