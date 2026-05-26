// FX rates — AED base, target currencies for UAE UHNW audience.
// Uses exchangerate.host free tier (no API key required, ECB-derived rates).
//
// Caching strategy: refresh every 1 hour. Fallback to hard-coded ~realistic
// snapshot rates if the API is down (so prices never render as broken).

export type Currency = "AED" | "USD" | "EUR" | "GBP" | "INR" | "SGD" | "HKD" | "CHF" | "JPY";

/** Currency display metadata. */
export const CURRENCY_META: Record<Currency, {
  code: Currency;
  label: string;
  symbol: string;
  flag: string;
  /** Locale used for Intl.NumberFormat */
  locale: string;
  /** Decimal digits to show */
  digits: number;
}> = {
  AED: { code: "AED", label: "UAE Dirham", symbol: "AED", flag: "AE", locale: "en-AE", digits: 0 },
  USD: { code: "USD", label: "US Dollar", symbol: "$", flag: "US", locale: "en-US", digits: 0 },
  EUR: { code: "EUR", label: "Euro", symbol: "€", flag: "EU", locale: "de-DE", digits: 0 },
  GBP: { code: "GBP", label: "Pound Sterling", symbol: "£", flag: "GB", locale: "en-GB", digits: 0 },
  INR: { code: "INR", label: "Indian Rupee", symbol: "₹", flag: "IN", locale: "en-IN", digits: 0 },
  SGD: { code: "SGD", label: "Singapore Dollar", symbol: "S$", flag: "SG", locale: "en-SG", digits: 0 },
  HKD: { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", flag: "HK", locale: "en-HK", digits: 0 },
  CHF: { code: "CHF", label: "Swiss Franc", symbol: "CHF", flag: "CH", locale: "de-CH", digits: 0 },
  JPY: { code: "JPY", label: "Japanese Yen", symbol: "¥", flag: "JP", locale: "ja-JP", digits: 0 },
};

/** Fallback rates (against AED) — realistic snapshot, used if the API is down. */
const FALLBACK_RATES: Record<Currency, number> = {
  AED: 1,
  USD: 0.2722,
  EUR: 0.2492,
  GBP: 0.2130,
  INR: 22.95,
  SGD: 0.3680,
  HKD: 2.1130,
  CHF: 0.2410,
  JPY: 41.20,
};

export interface FxSnapshot {
  /** ISO timestamp when fetched */
  fetchedAt: string;
  /** Source: live = real API, fallback = hard-coded snapshot */
  source: "live" | "fallback";
  /** Rates with AED as base. rates[USD] = how many USD per 1 AED. */
  rates: Record<Currency, number>;
}

/** Server-side fetch from exchangerate.host. */
export async function fetchFxRates(): Promise<FxSnapshot> {
  try {
    const symbols = Object.keys(CURRENCY_META).filter((c) => c !== "AED").join(",");
    const res = await fetch(
      `https://api.exchangerate.host/latest?base=AED&symbols=${symbols}`,
      { next: { revalidate: 3600 } } // 1 hour
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { rates?: Partial<Record<Currency, number>>; success?: boolean };
    if (!data.rates) throw new Error("missing rates");

    const live: Record<Currency, number> = { ...FALLBACK_RATES };
    for (const [k, v] of Object.entries(data.rates)) {
      if (typeof v === "number" && k in CURRENCY_META) {
        live[k as Currency] = v;
      }
    }
    live.AED = 1;
    return {
      fetchedAt: new Date().toISOString(),
      source: "live",
      rates: live,
    };
  } catch {
    return {
      fetchedAt: new Date().toISOString(),
      source: "fallback",
      rates: FALLBACK_RATES,
    };
  }
}

/** Convert AED amount → target currency using a snapshot's rates. */
export function convertAedTo(amount: number, target: Currency, snapshot: FxSnapshot): number {
  if (target === "AED") return amount;
  const rate = snapshot.rates[target];
  if (!rate || rate <= 0) return amount;
  return amount * rate;
}

/** Format a number with the right locale + symbol. Compact for >=1M values. */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options: { compact?: boolean } = {}
): string {
  const meta = CURRENCY_META[currency];
  const compact = options.compact ?? amount >= 1_000_000;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency",
      currency: meta.code === "AED" ? "AED" : meta.code,
      maximumFractionDigits: meta.digits,
      notation: compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${meta.symbol}${amount.toFixed(meta.digits)}`;
  }
}
