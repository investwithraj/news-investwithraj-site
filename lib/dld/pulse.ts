// DLD daily pulse — deterministic mock for now, swap to live feed when wired.
//
// Mock generates realistic shape based on date (so it's stable per day but
// drifts naturally). Hottest areas + top developers cycle through a realistic
// rotation of names actually visible in 2026 DLD data.

import type { DldDailyPulse } from "./types";

const HOT_AREA_ROTATION = [
  "Business Bay",
  "Dubai Marina",
  "Downtown Dubai",
  "Palm Jumeirah",
  "Dubai Hills Estate",
  "Jumeirah Village Circle",
  "Damac Lagoons",
  "MBR City",
  "Al Furjan",
  "Sobha Hartland",
  "Dubai Creek Harbour",
  "Jumeirah Lake Towers",
  "Saadiyat Island",
  "Yas Island",
  "Hudayriyat Island",
];

const TOP_DEV_ROTATION = [
  "Emaar Properties",
  "Damac Properties",
  "Nakheel",
  "Aldar Properties",
  "Sobha Realty",
  "Dubai Properties",
  "Meraas",
  "Modon Properties",
  "Azizi Developments",
  "Danube Properties",
];

/** Pseudo-random but date-stable hash for mock data. */
function dateSeed(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h << 5) - h + dateStr.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Returns mock DLD pulse for a given date (default = today UAE). */
export function getMockDldPulse(date?: string): DldDailyPulse {
  const d = date || new Date().toISOString().slice(0, 10);
  const seed = dateSeed(d);

  // Realistic 2026 baseline ~600-800 txns/day, ~AED 2.5-3.5B
  const txnCount = 580 + (seed % 280);
  const avgPriceAed = 3_200_000 + ((seed % 41) * 50_000);
  const volumeAed = txnCount * avgPriceAed;
  const medianPpsfAed = 1450 + (seed % 350);
  const dodVolumeChangePct = ((seed % 21) - 10) + (Math.sin(seed) * 5); // -15% to +15%
  const hotIdx = seed % HOT_AREA_ROTATION.length;
  const devIdx = (seed >> 4) % TOP_DEV_ROTATION.length;

  return {
    date: d,
    txnCount,
    volumeAed,
    avgPriceAed,
    medianPpsfAed,
    hottestArea: {
      name: HOT_AREA_ROTATION[hotIdx],
      volumeAed: volumeAed * (0.08 + (seed % 7) * 0.01),
      txnCount: Math.round(txnCount * (0.07 + (seed % 9) * 0.005)),
    },
    topDeveloper: {
      name: TOP_DEV_ROTATION[devIdx],
      volumeAed: volumeAed * (0.12 + (seed % 8) * 0.01),
      txnCount: Math.round(txnCount * (0.10 + (seed % 7) * 0.008)),
    },
    dodVolumeChangePct: Number(dodVolumeChangePct.toFixed(1)),
    source: "mock",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Live DLD pulse fetcher — placeholder. When dxbinteract / DLD open data
 * API is wired (Q3 2026 plan), replace this body with the real fetch.
 * Returns null on any error so the route falls back to mock.
 */
export async function fetchLiveDldPulse(): Promise<DldDailyPulse | null> {
  const apiKey = process.env.DLD_API_KEY;
  const apiUrl = process.env.DLD_API_URL;
  if (!apiKey || !apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/daily-summary`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 21600 }, // 6h
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DldDailyPulse>;
    if (!data.date || typeof data.txnCount !== "number") return null;
    return {
      ...(data as DldDailyPulse),
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Public — returns live data if available, else mock. */
export async function getDldPulse(date?: string): Promise<DldDailyPulse> {
  const live = await fetchLiveDldPulse();
  if (live) return live;
  return getMockDldPulse(date);
}
