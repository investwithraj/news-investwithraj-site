// DLD (Dubai Land Department) data shapes.
//
// DLD publishes daily transaction data via dxbinteract.com + their open
// data portal. Until the live feed is wired up, the API route returns
// deterministic mock data that mirrors realistic DLD shapes so the UI
// can ship Day-1 and the ticker stays alive.
//
// When the real DLD API is hooked up (Q3 2026 target), the route's
// internals get replaced — UI doesn't change.

export interface DldDailyPulse {
  /** ISO date the pulse represents (YYYY-MM-DD UAE time) */
  date: string;
  /** Total transaction count for the day */
  txnCount: number;
  /** Total transaction volume in AED */
  volumeAed: number;
  /** Average transaction price in AED */
  avgPriceAed: number;
  /** Median per-sqft price in AED */
  medianPpsfAed: number;
  /** Hottest area (highest volume) */
  hottestArea: { name: string; volumeAed: number; txnCount: number };
  /** Top developer by volume */
  topDeveloper: { name: string; volumeAed: number; txnCount: number };
  /** Day-over-day percentage change in volume */
  dodVolumeChangePct: number;
  /** Source — "live" when DLD API wired, "mock" otherwise */
  source: "live" | "mock";
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
