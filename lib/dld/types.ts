// DLD (Dubai Land Department) data shapes.
//
// Data is REAL: either a live aggregate from the Dubai Pulse DLD open-data API
// (source: "live") or the latest cited official DLD print (source: "reference").
// Optional metrics are present only when the source actually provides them —
// the ticker omits any field left undefined rather than inventing a value.

export interface DldDailyPulse {
  /** ISO date the pulse represents (YYYY-MM-DD UAE time) */
  date: string;
  /** Human label for the period — "today" / ISO date (live) or "week ending …" (reference) */
  periodLabel?: string;
  /** Total transaction count */
  txnCount: number;
  /** Total transaction volume in AED */
  volumeAed: number;
  /** Average transaction price in AED */
  avgPriceAed: number;
  /** Median per-sqft price in AED — optional (only when size data is available) */
  medianPpsfAed?: number;
  /** Hottest area (highest volume) — optional */
  hottestArea?: { name: string; volumeAed: number; txnCount: number };
  /** Top project/developer by volume — optional */
  topDeveloper?: { name: string; volumeAed: number; txnCount: number };
  /** Day-over-day percentage change in volume — optional */
  dodVolumeChangePct?: number;
  /** "live" = Dubai Pulse DLD open-data API · "reference" = latest cited official DLD print */
  source: "live" | "reference";
  /** Short human label shown in the ticker's AS-OF slot (e.g. "Dubai Pulse · DLD open data") */
  sourceNote?: string;
  /** ISO timestamp when the data was last refreshed */
  fetchedAt: string;
}

/** Format AED amount to compact human notation. */
export function formatAed(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}
