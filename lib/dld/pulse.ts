// DLD daily pulse — REAL data only. No pseudo-random / mock figures.
//
// Two real sources, in priority order:
//   1. LIVE — the Dubai Pulse DLD open-data API (official; the same DLD
//      registry feed DXB Interact uses). OAuth client-credentials: set
//      DLD_API_KEY (client_id) + DLD_API_SECRET (client_secret) in env. Get
//      them by registering on dubaipulse.gov.ae and requesting access to the
//      `dld_transactions-open` dataset — the Key + Secret arrive by email.
//      We aggregate the most recent day's transactions into the pulse shape.
//   2. REFERENCE — the latest OFFICIAL published DLD print (real, cited),
//      used until the live key is wired.
//
// There is deliberately NO fabricated/random fallback: every figure on the
// ticker is a real DLD number — a live daily aggregate, or the cited weekly
// print below.

import type { DldDailyPulse } from "./types";

// ── REFERENCE: latest official DLD weekly print ───────────────────────────
// Dubai Land Department, week ending 18 May 2026 — AED 15.2B across 4,850
// transactions (residential 3,450 deals / AED 9.8B; plots 670 / AED 5.4B;
// mortgages AED 3.8B / 1,150). Source: DLD weekly report (PropertyNews.ae).
// Q1-2026 context, DLD official: AED 252B, +31% YoY.
// → Refresh this anchor from the DLD / WAM weekly report when it drifts.
const REF_VOLUME_AED = 15_200_000_000;
const REF_TXNS = 4_850;

export function getReferenceDldPulse(): DldDailyPulse {
  return {
    date: "2026-05-18",
    periodLabel: "week ending 18 May 2026",
    txnCount: REF_TXNS,
    volumeAed: REF_VOLUME_AED,
    avgPriceAed: Math.round(REF_VOLUME_AED / REF_TXNS),
    source: "reference",
    sourceNote: "DLD weekly print · 18 May 2026",
    fetchedAt: new Date().toISOString(),
    // medianPpsf / hottestArea / topDeveloper / dod% intentionally omitted —
    // the weekly headline doesn't publish them and we never fabricate.
  };
}

// ── LIVE: Dubai Pulse DLD open-data API ───────────────────────────────────
const PULSE_BASE = process.env.DLD_API_URL || "https://api.dubaipulse.gov.ae";
const PULSE_KEY = process.env.DLD_API_KEY || ""; // client_id
const PULSE_SECRET = process.env.DLD_API_SECRET || ""; // client_secret

async function getPulseToken(): Promise<string | null> {
  if (!PULSE_KEY || !PULSE_SECRET) return null;
  try {
    const res = await fetch(
      `${PULSE_BASE}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `client_id=${encodeURIComponent(PULSE_KEY)}&client_secret=${encodeURIComponent(PULSE_SECRET)}`,
        next: { revalidate: 21600 },
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; accessToken?: string };
    return j.access_token || j.accessToken || null;
  } catch {
    return null;
  }
}

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** DLD instance_date is typically DD-MM-YYYY — normalise to YYYY-MM-DD. */
function normDate(v: unknown): string {
  const s = String(v ?? "");
  const m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.slice(0, 10);
}

type Row = Record<string, unknown>;

/** Aggregate raw DLD transaction rows into the most-recent-day pulse. */
function aggregate(rows: Row[]): DldDailyPulse | null {
  const value = (r: Row) => num(r.actual_worth ?? r.trans_value ?? r.amount ?? r.worth);
  const date = (r: Row) => normDate(r.instance_date ?? r.transaction_date ?? r.date);
  const area = (r: Row) => String(r.area_name_en ?? r.area_en ?? r.area ?? "—").trim();
  const project = (r: Row) =>
    String(r.master_project_en ?? r.project_name_en ?? r.project_en ?? "").trim();
  const perSqm = (r: Row) => num(r.meter_sale_price ?? r.price_per_sqm);

  const allDates = rows.map(date).filter(Boolean).sort();
  const latest = allDates[allDates.length - 1];
  if (!latest) return null;

  // Freshness guard — never present a stale (or future-dated) batch as "live".
  const ageMs = Date.now() - new Date(latest).getTime();
  if (!(ageMs >= -86_400_000) || ageMs > 21 * 86_400_000) return null;

  const day = rows.filter((r) => date(r) === latest && value(r) > 0);
  if (day.length < 3) return null; // too thin to be a credible daily print

  const volumeAed = day.reduce((s, r) => s + value(r), 0);
  const txnCount = day.length;
  if (volumeAed <= 0) return null;

  // median PSF (per sqft) from meter_sale_price (per sqm → ÷ 10.7639)
  const psfs = day
    .map(perSqm)
    .filter((x) => x > 0)
    .map((x) => x / 10.7639)
    .sort((a, b) => a - b);
  const medianPpsfAed = psfs.length ? Math.round(psfs[Math.floor(psfs.length / 2)]) : undefined;

  const topBy = (key: (r: Row) => string) => {
    const m = new Map<string, { v: number; c: number }>();
    for (const r of day) {
      const k = key(r);
      if (!k || k === "—") continue;
      const e = m.get(k) ?? { v: 0, c: 0 };
      e.v += value(r);
      e.c += 1;
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v)[0];
  };
  const topArea = topBy(area);
  const topProj = topBy(project);

  return {
    date: latest,
    periodLabel: latest,
    txnCount,
    volumeAed,
    avgPriceAed: Math.round(volumeAed / txnCount),
    medianPpsfAed,
    hottestArea: topArea
      ? { name: topArea[0], volumeAed: topArea[1].v, txnCount: topArea[1].c }
      : undefined,
    topDeveloper: topProj
      ? { name: topProj[0], volumeAed: topProj[1].v, txnCount: topProj[1].c }
      : undefined,
    source: "live",
    sourceNote: "Dubai Pulse · DLD open data",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Live DLD pulse from the Dubai Pulse open-data API. Returns null on any
 * failure (missing keys, auth, network, empty/unexpected/stale payload) so the
 * route falls back to the cited reference print.
 *
 * NOTE: when DLD_API_KEY/SECRET are first set, run one live call and confirm
 * the dataset's paging/sort params + field names against the real response.
 * The mapping above uses the documented DLD open-data transaction schema
 * (instance_date · actual_worth · meter_sale_price · area_name_en ·
 * master_project_en); the limit/sort query params may need a small tweak.
 */
export async function fetchLiveDldPulse(): Promise<DldDailyPulse | null> {
  const token = await getPulseToken();
  if (!token) return null;
  try {
    const url = `${PULSE_BASE}/open/dld/dld_transactions-open-api?limit=2000&sort=instance_date%20desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const rows: Row[] = Array.isArray(json)
      ? (json as Row[])
      : ((json as { result?: Row[] }).result ??
        (json as { data?: Row[] }).data ??
        (json as { records?: Row[] }).records ??
        []);
    if (!rows.length) return null;
    return aggregate(rows);
  } catch {
    return null;
  }
}

/** Public — real live data if the Dubai Pulse key is wired, else the cited
 *  official reference print. Never fabricated. */
export async function getDldPulse(_date?: string): Promise<DldDailyPulse> {
  const live = await fetchLiveDldPulse();
  if (live) return live;
  return getReferenceDldPulse();
}
