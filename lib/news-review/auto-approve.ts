// Deterministic evidence assessor and fail-closed publisher. Only drafts that
// satisfy every conservative source and figure gate can enter auto-publish.
//
// A draft is AUTO-APPROVABLE iff ALL of:
//   1. the 8-gate voice validator passes              (draft.validator.ok)
//   2. every evidence record proves it was explicitly dated and fresh at the
//      immutable direct-fetch/staging clock
//   3. risk-based publisher count passes (one Tier-A factual source; otherwise
//      two independent approved parent publishers)
//   4. EVERY figure in title/subtitle/TLDR/body/FAQ appears in fetched text
//   5. SAFETY GUARD: a statistical signal the figure parser did not capture
//      holds the draft rather than permitting a vacuous pass.
// Anything that fails any check → "manual". Deliberately conservative: a figure
// we cannot match is a reason to hold the draft.

import type {
  DraftArticle,
  NewsDraft,
  NewsDraftProvenance,
} from "./types";
import {
  findSourceByUrl,
  isOfficialDeveloperUrl,
  type SourceTier,
} from "@/lib/sources/registry";

export const DEFAULT_CORROBORATION_SOURCES = 2;
export const MAX_AUTO_NEWS_SOURCE_AGE_HOURS = 7 * 24;

export type EvidenceLane =
  | "official-update"
  | "fast-news"
  | "research-release"
  | "developer-announcement"
  | "corroborated-analysis";

export interface EvidencePolicy {
  lane: EvidenceLane;
  requiredPublisherCount: 1 | 2;
  reason: string;
}

const INVESTMENT_OR_FORECAST_CLAIM_RE =
  /\b(?:recommend(?:s|ed|ation)?|should\s+(?:buy|sell|avoid)|buy\s+call|sell\s+call|undervalued|overvalued|outperform|underperform|guaranteed|risk[- ]free|forecast(?:s|ed)?|projected\s+return|will\s+(?:rise|fall|increase|decline)\s+by)\b/i;
const DISPUTED_OR_MARKET_WIDE_CLAIM_RE =
  /\b(?:disput(?:e[ds]?|ing)|contest(?:ed|s|ing)?|deni(?:ed|es|al)|alleg(?:ed|es|ation|ations)|market-wide|across\s+the\s+(?:property|real\s+estate|housing)\s+market|market\s+(?:will|is\s+set\s+to|is\s+expected\s+to))\b/i;
const ATTRIBUTION_RE =
  /\b(?:according to|said|says|announced|reported|confirmed|stated|published|disclosed)\b/i;

export interface EvidenceRiskClassification {
  requiresCorroboration: boolean;
  reason: string | null;
}

export function articleEvidenceText(article: DraftArticle): string {
  const tldr = Array.isArray(article.tldr) ? article.tldr : [];
  const faq = Array.isArray(article.faq) ? article.faq : [];
  return [
    article.title,
    article.subtitle ?? "",
    ...tldr,
    article.body,
    ...faq.flatMap((entry) => [entry?.q ?? "", entry?.a ?? ""]),
  ].join("\n");
}

/** One complete claim-risk classifier for drafting, stored-draft assessment,
 * ledger minting and publication recomputation. */
export function classifyEvidenceRisk(
  article: DraftArticle,
): EvidenceRiskClassification {
  const text = articleEvidenceText(article);
  if (article.semaform?.howIdTradeIt || INVESTMENT_OR_FORECAST_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "investment conclusions and forecasts require corroboration",
    };
  }
  if (DISPUTED_OR_MARKET_WIDE_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "disputed or market-wide claims require independent corroboration",
    };
  }
  return { requiresCorroboration: false, reason: null };
}

/** Canonical publisher identity, based on the approved registry anchor rather
 * than the raw hostname. `graphics.reuters.com` and `www.reuters.com` are one
 * publisher and can never satisfy two-source corroboration. */
export function approvedPublisherDomain(url: string): string | null {
  const source = findSourceByUrl(url);
  if (!source || source.citable === false) return null;
  try {
    return new URL(source.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Direct evidence may follow redirects only within the same approved parent
 * publisher. A cross-publisher redirect changes attribution and is manual. */
export function approvedEvidencePublisherDomain(
  citedUrl: string,
  finalUrl: string | null | undefined,
): string | null {
  if (!finalUrl) return null;
  const citedPublisher = approvedPublisherDomain(citedUrl);
  const finalPublisher = approvedPublisherDomain(finalUrl);
  return citedPublisher && citedPublisher === finalPublisher
    ? citedPublisher
    : null;
}

type StoredEvidence = NonNullable<
  NewsDraftProvenance["fetchedEvidence"]
>[number];

export interface StoredEvidenceFreshness {
  ok: boolean;
  status:
    | "fresh"
    | "missing-date"
    | "invalid-date"
    | "missing-check"
    | "invalid-check"
    | "invalid-window"
    | "stale"
    | "future";
  detail: string;
}

function exactIsoMilliseconds(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return null;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value
    ? milliseconds
    : null;
}

/** Recompute the immutable staging-time freshness decision. Current publish
 * time is intentionally absent so a held-but-valid backlog does not age out. */
export function assessStoredEvidenceFreshness(
  evidence: StoredEvidence,
): StoredEvidenceFreshness {
  if (!evidence.sourcePublishedAt || !evidence.sourceDateSource) {
    return {
      ok: false,
      status: "missing-date",
      detail: "explicit source publication timestamp/date-source missing",
    };
  }
  if (!(["meta", "json-ld", "time"] as const).includes(evidence.sourceDateSource)) {
    return {
      ok: false,
      status: "invalid-date",
      detail: "source publication date provenance is invalid",
    };
  }
  const sourceMilliseconds = exactIsoMilliseconds(evidence.sourcePublishedAt);
  if (sourceMilliseconds === null) {
    return {
      ok: false,
      status: "invalid-date",
      detail: "source publication timestamp is not an exact ISO instant",
    };
  }
  if (!evidence.freshnessCheckedAt) {
    return {
      ok: false,
      status: "missing-check",
      detail: "original freshness-check timestamp missing",
    };
  }
  const checkedMilliseconds = exactIsoMilliseconds(evidence.freshnessCheckedAt);
  if (checkedMilliseconds === null) {
    return {
      ok: false,
      status: "invalid-check",
      detail: "original freshness-check timestamp is invalid",
    };
  }
  const fetchedMilliseconds = exactIsoMilliseconds(evidence.fetchedAt);
  if (
    fetchedMilliseconds === null ||
    fetchedMilliseconds !== checkedMilliseconds
  ) {
    return {
      ok: false,
      status: "invalid-check",
      detail: "freshness-check timestamp does not match the direct-fetch timestamp",
    };
  }
  const maxAgeHours = evidence.freshnessMaxAgeHours;
  if (
    typeof maxAgeHours !== "number" ||
    !Number.isFinite(maxAgeHours) ||
    maxAgeHours < 1 ||
    maxAgeHours > MAX_AUTO_NEWS_SOURCE_AGE_HOURS
  ) {
    return {
      ok: false,
      status: "invalid-window",
      detail: "freshness window missing or outside the immutable 1-168h bound",
    };
  }
  const ageHours = (checkedMilliseconds - sourceMilliseconds) / 3_600_000;
  if (ageHours < 0) {
    return {
      ok: false,
      status: "future",
      detail: `source timestamp is ${Math.abs(ageHours).toFixed(1)}h after the staging check`,
    };
  }
  if (ageHours > maxAgeHours) {
    return {
      ok: false,
      status: "stale",
      detail: `source was ${ageHours.toFixed(1)}h old at staging (maximum ${maxAgeHours}h)`,
    };
  }
  return {
    ok: true,
    status: "fresh",
    detail: `source was ${ageHours.toFixed(1)}h old at staging`,
  };
}

function evidenceTiers(urls: string[]): SourceTier[] {
  return urls
    .map((url) => findSourceByUrl(url)?.tier)
    .filter((tier): tier is SourceTier => Boolean(tier));
}

/** Choose the lightest defensible evidence rule for the article. The policy is
 * deliberately about claim risk, not a blanket source count. */
export function determineEvidencePolicy(
  article: DraftArticle,
  evidenceUrls: string[],
): EvidencePolicy {
  const body = articleEvidenceText(article);
  const risk = classifyEvidenceRisk(article);
  if (risk.requiresCorroboration) {
    return {
      lane: "corroborated-analysis",
      requiredPublisherCount: 2,
      reason: risk.reason ?? "high-risk claims require corroboration",
    };
  }

  const tiers = evidenceTiers(evidenceUrls);
  if (tiers.includes("government")) {
    return {
      lane: "official-update",
      requiredPublisherCount: 1,
      reason: "one fetched government or regulator source is authoritative for its own update",
    };
  }
  if (tiers.includes("national-press")) {
    return {
      lane: "fast-news",
      requiredPublisherCount: 1,
      reason: "one fetched verified national or international newsroom is sufficient for factual news",
    };
  }
  if (
    tiers.includes("institutional-research") &&
    (article.category === "market-pulse" || article.category === "macro") &&
    ATTRIBUTION_RE.test(body)
  ) {
    return {
      lane: "research-release",
      requiredPublisherCount: 1,
      reason: "one attributed institutional report is sufficient for reporting that report's findings",
    };
  }
  if (
    evidenceUrls.some(isOfficialDeveloperUrl) &&
    (article.category === "launch" || article.category === "developer-corporate") &&
    ATTRIBUTION_RE.test(body)
  ) {
    return {
      lane: "developer-announcement",
      requiredPublisherCount: 1,
      reason: "one attributed first-party developer release is sufficient for its own announcement",
    };
  }
  return {
    lane: "corroborated-analysis",
    requiredPublisherCount: DEFAULT_CORROBORATION_SOURCES,
    reason: "portal, regional or unattributed claims require independent corroboration",
  };
}

export interface AutoApproveAssessment {
  id: string;
  slug: string;
  title: string;
  verdict: "auto-approve" | "manual";
  gatesOk: boolean;
  citationCount: number;
  whitelistCount: number;
  allCitationsWhitelisted: boolean;
  fetchedEvidenceCount: number;
  evidenceLane: EvidenceLane;
  requiredPublisherCount: 1 | 2;
  figureCount: number;
  /** Figures present in publishable fields but absent from fetched evidence. */
  amberFigures: string[];
  /** Human-readable reasons a draft was held for manual review (empty = approve). */
  reasons: string[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Preserve the value and unit while normalising publisher typography such as
 * AED3.5 vs AED 3.5, 8,000 vs 8000, and 30 per cent vs 30%. */
export function normNumericEvidence(value: string): string {
  return norm(value)
    .replace(/\b(?:dhs?|aed)\b/g, "aed")
    .replace(/\b(?:per\s*cent|percent)\b/g, "%")
    .replace(/(?<=\d),(?=\d{3}\b)/g, "")
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-");
}

const CUR = String.raw`(?:AED|USD|US\$|\$|€|£|Dhs|Dh)`;
// A comma only counts as a thousands separator (comma + exactly 3 digits), so a
// year followed by a prose comma ("2026,") is NOT read as a comma-number.
const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
// Financial, measured and claim-bearing count units. The finite noun list
// catches material statements such as "7 towers" without treating every list
// or section number as a sourced statistic.
const UNIT = String.raw`(?:%|per\s?cent|percent|bps|pp|p\.a\.|per\s+annum|bn|billion|million|trillion|tn|sq\.?\s?ft|sqft|sq\.?\s?m|sqm|psf|km|kilomet(?:re|er)s?|met(?:re|er)s?|hectares?|acres?|towers?|buildings?|homes?|units?|apartments?|villas?|residences?|floors?|storeys?|stories|levels?|bedrooms?|rooms?|keys?|plots?|years?|months?|days?)`;

// currency? number range? unit?  — capture groups decide "meaningful".
const FIGURE_RE = new RegExp(
  `(${CUR})?\\s?(${NUM})((?:\\s*[-–]\\s*${NUM})?)\\s*(${UNIT}|[mk](?![a-z]))?`,
  "gi",
);
const LABELLED_COUNT_RE =
  /\b(?:phase|stage|plot|unit|tower|building)\s+(?:no\.?\s*)?\d+(?:\.\d+)?\b/gi;
const YEAR_RE = /\b(?:19|20)\d{2}\b/g;
const MONTH =
  String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const DATE_BEFORE_YEAR_RE = new RegExp(
  String.raw`(?:\b\d{1,2}\s+${MONTH}\s*|\b${MONTH}(?:\s+\d{1,2},?)?\s*)$`,
  "i",
);
const DATE_AFTER_YEAR_RE = new RegExp(String.raw`^\s+${MONTH}\b`, "i");

// A cheap independent detector of "this body has statistics" — used as a guard
// against the figure parser silently missing something (see check 5).
const STAT_SIGNAL_RE = new RegExp(
  `${CUR}\\s?\\d|\\d[\\d,]*(?:\\.\\d+)?\\s*${UNIT}|\\b(?:phase|stage|plot|unit|tower|building)\\s+(?:no\\.?\\s*)?\\d|\\d{1,3}(?:,\\d{3})+`,
  "i",
);

function withoutUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s)\]]+/gi, " ");
}

function yearIsOrdinaryCalendarDate(
  text: string,
  index: number,
): boolean {
  const before = text.slice(Math.max(0, index - 32), index);
  const after = text.slice(index + 4, index + 36);
  return (
    /\d{1,2}[/-]\d{1,2}[/-]$/.test(before) ||
    /^[/-]\d{1,2}[/-]\d{1,2}\b/.test(after) ||
    DATE_BEFORE_YEAR_RE.test(before) ||
    DATE_AFTER_YEAR_RE.test(after) ||
    /(?:19|20)\d{2}\s*[-\u2013\u2014]\s*$/.test(before) ||
    /^\s*[-\u2013\u2014]\s*(?:19|20)\d{2}\b/.test(after)
  );
}

/** Distinct claim-bearing figures found in publishable prose. Calendar dates
 * and ordinary section labels are excluded, while standalone claim years,
 * phases, measured values and finite property counts remain evidence-bound. */
export function extractFigures(value: string): string[] {
  const body = withoutUrls(value);
  const out = new Set<string>();
  for (const m of body.matchAll(FIGURE_RE)) {
    const [full, cur, num, range, unit] = m;
    const meaningful =
      Boolean(cur) ||
      Boolean(unit) ||
      Boolean(range && range.trim()) ||
      num.includes(",") ||
      num.includes(".");
    if (!meaningful) continue;
    const index = m.index ?? 0;
    const before = body.slice(Math.max(0, index - 24), index);
    const after = body.slice(index + full.length, index + full.length + 16);
    if (
      !cur &&
      !unit &&
      Boolean(range?.trim()) &&
      (/(?:section|article|chapter|clause|paragraph|page)s?\s*$/i.test(before) ||
        (/^(?:19|20)\d{2}\s*-\s*\d{1,2}$/.test(full.trim()) &&
          /^-\d{1,2}\b/.test(after)) ||
        (/^\d{1,2}\s*-\s*\d{1,2}$/.test(full.trim()) &&
          /^-(?:19|20)\d{2}\b/.test(after)))
    ) {
      continue;
    }
    // A bare range of two 4-digit years ("2023–2024") is a date span, not a
    // statistic needing a source — skip it.
    if (!cur && !unit && /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/.test(full.trim())) {
      continue;
    }
    const s = norm(full);
    if (s) out.add(s);
  }
  for (const match of body.matchAll(LABELLED_COUNT_RE)) {
    const figure = norm(match[0]);
    if (figure) out.add(figure);
  }
  for (const match of body.matchAll(YEAR_RE)) {
    const index = match.index ?? 0;
    if (!yearIsOrdinaryCalendarDate(body, index)) out.add(match[0]);
  }
  return [...out];
}

export function bodyHasStatSignal(value: string): boolean {
  return STAT_SIGNAL_RE.test(withoutUrls(value));
}

export function findUnsupportedFigures(
  body: string,
  evidenceText: string | string[],
): string[] {
  const evidenceTexts = Array.isArray(evidenceText)
    ? evidenceText
    : [evidenceText];
  const sourceFigures = new Set(
    evidenceTexts.flatMap((text) =>
      extractFigures(text).map(normNumericEvidence),
    ),
  );
  return extractFigures(body).filter(
    (figure) => !sourceFigures.has(normNumericEvidence(figure)),
  );
}

export function assessDraft(
  draft: Pick<NewsDraft, "id" | "article" | "validator" | "provenance">,
): AutoApproveAssessment {
  const reasons: string[] = [];
  const { article, validator, provenance } = draft;

  // 1 · the 8 gates
  const gatesOk = validator.ok;
  if (!gatesOk) {
    const blocked = validator.failures
      .filter((f) => f.severity === "block")
      .map((f) => f.name)
      .join(", ");
    reasons.push(`fails gates: ${blocked || "unknown"}`);
  }

  const citationUrls = new Set(article.citations.map((citation) => citation.url));
  const storedEvidence = provenance.fetchedEvidence ?? [];
  const evidenceChecks = storedEvidence.map((evidence) => ({
    evidence,
    freshness: assessStoredEvidenceFreshness(evidence),
    publisherDomain: approvedEvidencePublisherDomain(
      evidence.url,
      evidence.finalUrl,
    ),
  }));
  for (const { evidence, freshness, publisherDomain } of evidenceChecks) {
    if (!freshness.ok) {
      reasons.push(
        `evidence freshness failed for ${(evidence.finalUrl ?? evidence.url).slice(0, 240)}: ${freshness.detail}`,
      );
    }
    if (!publisherDomain) {
      reasons.push(
        `evidence publisher identity changed or final URL is missing: ${evidence.url.slice(0, 180)} -> ${(evidence.finalUrl ?? "missing").slice(0, 180)}`,
      );
    }
  }
  const fetchedEvidence = evidenceChecks
    .filter(({ freshness, publisherDomain }) => freshness.ok && publisherDomain)
    .map(({ evidence }) => evidence)
    .filter(
      (evidence) =>
        citationUrls.has(evidence.url) && norm(evidence.text).length >= 80,
    );
  const policy = determineEvidencePolicy(
    article,
    fetchedEvidence.map((evidence) => evidence.finalUrl ?? evidence.url),
  );

  // 2 · citations — all whitelisted, with the count selected by claim risk
  const citationCount = validator.metrics.citationCount;
  const whitelistCount = validator.metrics.citationsFromWhitelist;
  const allCitationsWhitelisted =
    citationCount > 0 && whitelistCount === citationCount;
  if (whitelistCount < policy.requiredPublisherCount) {
    reasons.push(
      `only ${whitelistCount} whitelisted citation(s) (need >= ${policy.requiredPublisherCount} for ${policy.lane})`,
    );
  }
  if (!allCitationsWhitelisted) {
    reasons.push(
      `${citationCount - whitelistCount} citation(s) not on the verified-source whitelist`,
    );
  }

  // 3 + 4 · every figure must trace to text fetched from the cited URL.
  // provenance.citedText is deliberately ignored because it is model output.
  const distinctEvidenceDomains = new Set(
    fetchedEvidence
      .map((evidence) =>
        approvedEvidencePublisherDomain(evidence.url, evidence.finalUrl),
      )
      .filter((domain): domain is string => Boolean(domain)),
  );
  const fetchedEvidenceCount = distinctEvidenceDomains.size;
  if (fetchedEvidenceCount < policy.requiredPublisherCount) {
    reasons.push(
      `only ${fetchedEvidenceCount} cited publisher domain(s) have fetched evidence text (need >= ${policy.requiredPublisherCount} for ${policy.lane})`,
    );
  }
  const sourceTexts = fetchedEvidence.map((evidence) => evidence.text);
  const claimText = articleEvidenceText(article);
  const figures = extractFigures(claimText);
  let amberFigures: string[];
  if (sourceTexts.length === 0 || sourceTexts.every((text) => !text.trim())) {
    amberFigures = figures;
    reasons.push(
      "no independently fetched source text on the draft — model citation markup cannot verify figures",
    );
  } else {
    amberFigures = findUnsupportedFigures(claimText, sourceTexts);
    if (amberFigures.length > 0) {
      reasons.push(
        `${amberFigures.length} unsourced figure(s): ${amberFigures
          .slice(0, 8)
          .join(" · ")}`,
      );
    }
  }

  // 5 · safety guard across every publishable field. If text clearly has
  // statistics but the parser found none, never approve on a vacuous pass.
  if (figures.length === 0 && bodyHasStatSignal(claimText)) {
    reasons.push(
      "article fields contain statistics the figure parser did not capture — holding for manual safety",
    );
  }

  return {
    id: draft.id,
    slug: article.slug,
    title: article.title,
    verdict: reasons.length === 0 ? "auto-approve" : "manual",
    gatesOk,
    citationCount,
    whitelistCount,
    allCitationsWhitelisted,
    fetchedEvidenceCount,
    evidenceLane: policy.lane,
    requiredPublisherCount: policy.requiredPublisherCount,
    figureCount: figures.length,
    amberFigures,
    reasons,
  };
}

export interface AutoApproveSummary {
  total: number;
  eligible: number;
  approved: number;
  published: number;
  failed: number;
  held: number;
  deferred: number;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Assess The Desk and, when explicitly enabled, publish a bounded batch. */
export async function runAutoApprove(opts: {
  site: string;
  secret: string;
  publish: boolean;
  publishLimit?: number;
  publishOrder?: "newest" | "backlog";
  backlogMinAgeHours?: number;
  backlogMaxAgeDays?: number;
  now?: Date;
  deploymentAttempts?: number;
  log?: (msg: string) => void;
}): Promise<AutoApproveSummary> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const base = opts.site.replace(/\/$/, "");
  const authHeaders = { "x-post-publish-secret": opts.secret };

  const res = await fetch(`${base}/api/news/draft`, {
    headers: authHeaders,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`draft list failed (${res.status})`);
  const { drafts } = (await res.json()) as { drafts: NewsDraft[] };

  const activeDrafts = drafts.filter((draft) => !draft.publication);
  const publishOrder = opts.publishOrder ?? "newest";
  const now = (opts.now ?? new Date()).getTime();
  const backlogMinAgeMs =
    Math.max(0, opts.backlogMinAgeHours ?? 12) * 60 * 60 * 1_000;
  const backlogMaxAgeMs =
    Math.max(1, opts.backlogMaxAgeDays ?? 21) * 24 * 60 * 60 * 1_000;
  const eligibleDrafts = activeDrafts
    .filter((draft) => {
      if (publishOrder !== "backlog") return true;
      const publishedAt = Date.parse(draft.article.publishedAt);
      if (!Number.isFinite(publishedAt)) return false;
      const age = now - publishedAt;
      return age >= backlogMinAgeMs && age <= backlogMaxAgeMs;
    })
    .sort((left, right) => {
      if (publishOrder === "backlog") {
        const scoreDifference = right.provenance.score - left.provenance.score;
        if (scoreDifference !== 0) return scoreDifference;
      }
      return right.article.publishedAt.localeCompare(left.article.publishedAt);
    });
  const assessments = eligibleDrafts.map(assessDraft);
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const held = assessments.filter((a) => a.verdict === "manual");
  const publishLimit = Math.max(1, Math.min(10, opts.publishLimit ?? 1));
  const selected = opts.publish ? approve.slice(0, publishLimit) : [];
  const deferred = opts.publish ? Math.max(0, approve.length - selected.length) : 0;

  if (publishOrder === "backlog") {
    log(
      `backlog window: ${eligibleDrafts.length}/${activeDrafts.length} active draft(s) are ${opts.backlogMinAgeHours ?? 12}h-${opts.backlogMaxAgeDays ?? 21}d old`,
    );
  }

  log(
    `auto-approve: ${activeDrafts.length} active draft(s) · ${approve.length} pass · ${held.length} held · ` +
      `mode ${opts.publish ? `PUBLISH (${publishOrder}, limit ${publishLimit})` : "REVIEW ONLY"} ` +
      `(risk-based evidence policy)`,
  );
  for (const a of approve) {
    log(`  ok  ${a.slug}  (${a.evidenceLane} · ${a.figureCount} figs · ${a.whitelistCount}/${a.citationCount} cites)`);
  }
  for (const a of held) log(`  hold ${a.slug} -> ${a.reasons.join("; ")}`);

  let published = 0;
  let failed = 0;
  for (const assessment of selected) {
    const response = await fetch(
      `${base}/api/news/draft/${encodeURIComponent(assessment.id)}/publish`,
      {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
        },
        body: "{}",
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      claimId?: string;
      commitSha?: string;
      idempotent?: boolean;
    };
    if (!response.ok || !payload.commitSha || !payload.claimId) {
      failed += 1;
      log(
        `  fail ${assessment.slug} -> ${payload.error ?? `publish returned ${response.status}`}`,
      );
      continue;
    }
    published += 1;
    log(
      `  live ${assessment.slug} -> commit ${payload.commitSha.slice(0, 8)}${payload.idempotent ? " (idempotent)" : ""}`,
    );

    // Finalise the durable queue receipt only after the canonical page proves
    // that the exact reviewed content is serving. A timeout leaves the commit
    // safely pending for a later verifier; it does not create a second commit.
    const attempts = Math.max(0, Math.min(20, opts.deploymentAttempts ?? 12));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await wait(15_000);
      const deployed = await fetch(
        `${base}/api/news/draft/${encodeURIComponent(assessment.id)}/deployment`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            claimId: payload.claimId,
            deploymentStatus: "READY",
            deployedCommitSha: payload.commitSha,
          }),
        },
      );
      if (deployed.ok) {
        log(`  verified ${assessment.slug} on the canonical newsroom`);
        break;
      }
      if (attempt === attempts) {
        const detail = (await deployed.json().catch(() => ({}))) as {
          error?: string;
        };
        log(
          `  pending ${assessment.slug} -> ${detail.error ?? "deployment verification timed out"}`,
        );
      }
    }
  }
  return {
    total: activeDrafts.length,
    eligible: eligibleDrafts.length,
    approved: approve.length,
    published,
    failed,
    held: held.length,
    deferred,
  };
}
