// Deterministic evidence assessor and fail-closed publisher. Only drafts that
// satisfy every conservative source and figure gate can enter auto-publish.
//
// A draft is AUTO-APPROVABLE iff ALL of:
//   1. the 8-gate voice validator passes              (draft.validator.ok)
//   2. every evidence record proves it was explicitly dated and fresh at the
//      immutable direct-fetch/staging clock
//   3. risk-based publisher count passes (one tightly attributed first-party
//      own update; otherwise two independent approved parent publishers)
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
  type VerifiedSource,
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
  /\b(?:recommend(?:s|ed|ation)?|should\s+(?:buy|sell|avoid)|buy\s+call|sell\s+call|undervalued|overvalued|outperform|underperform|guaranteed|risk[- ]free|forecast(?:s|ed)?|projected\s+return|will\s+(?:rise|fall|increase|decline)\s+by|analysts?\s+(?:expect|predict|forecast)|prices?\s+(?:will|are\s+(?:set|expected)\s+to)\s+(?:rise|fall|increase|decline))\b/i;
const DISPUTED_OR_MARKET_WIDE_CLAIM_RE =
  /\b(?:disput(?:e[ds]?|ing)|contest(?:ed|s|ing)?|challeng(?:e[ds]?|ing)|critics?\s+(?:challeng(?:e[ds]?|ing)|disput(?:e[ds]?|ing)|contest(?:ed|s|ing)?)|deni(?:ed|es|al)|alleg(?:ed|es|ation|ations)|market-wide|across\s+the\s+(?:property|real\s+estate|housing)\s+market|(?:property|real\s+estate|housing)\s+market\s+(?:grew|rose|fell|declined|increased|decreased)|market\s+(?:will|is\s+set\s+to|is\s+expected\s+to))\b/i;
const OWN_UPDATE_VERB =
  String.raw`(?:announc(?:e[ds]?|ing)|report(?:s|ed|ing)?|publish(?:es|ed|ing)?|confirm(?:s|ed|ing)?|stat(?:e[ds]?|ing)|disclos(?:e[ds]?|ing)|releas(?:e[ds]?|ing)|file(?:s|d|ing)|record(?:s|ed|ing)?|said|says)`;

export interface EvidenceRiskClassification {
  requiresCorroboration: boolean;
  reason: string | null;
}

export function articleEvidenceText(article: DraftArticle): string {
  const tldr = Array.isArray(article.tldr) ? article.tldr : [];
  const faq = Array.isArray(article.faq) ? article.faq : [];
  const semaform = article.semaform;
  const viewsFrom = Array.isArray(semaform?.viewsFrom)
    ? semaform.viewsFrom
    : [];
  const trade = semaform?.howIdTradeIt;
  return [
    article.title,
    article.subtitle ?? "",
    article.metaDescription ?? "",
    ...tldr,
    article.body,
    ...faq.flatMap((entry) => [entry?.q ?? "", entry?.a ?? ""]),
    semaform?.theTake ?? "",
    ...viewsFrom.flatMap((view) => [
      view?.source ?? "",
      view?.role ?? "",
      view?.view ?? "",
    ]),
    semaform?.realityCheck ?? "",
    semaform?.whatHappensNext ?? "",
    trade?.action ?? "",
    trade?.reasoning ?? "",
    trade?.horizon ?? "",
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceAttributionAliases(source: VerifiedSource): string[] {
  const parentheticalTrimmed = source.name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const suffixTrimmed = parentheticalTrimmed
    .replace(
      /\s+(?:dubai|mena|uae|properties|property|group|pjsc|llc)$/i,
      "",
    )
    .trim();
  const words = parentheticalTrimmed.match(/[A-Za-z0-9]+/g) ?? [];
  const acronym = words
    .filter((word) => !/^(?:the|of|and)$/i.test(word))
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word[0]))
    .join("");
  const firstTwo = words.slice(0, 2).join(" ");
  let hostLabel = "";
  try {
    hostLabel = new URL(source.url).hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[-_]+/g, " ");
  } catch {
    // Registry URLs are static, but an invalid entry must never widen policy.
  }
  return [
    source.name,
    parentheticalTrimmed,
    suffixTrimmed,
    acronym,
    firstTwo,
    hostLabel,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length >= 2)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function articleAttributesOwnUpdate(
  article: DraftArticle,
  source: VerifiedSource,
): boolean {
  const aliasPatterns = sourceAttributionAliases(source).map((alias) =>
    escapeRegExp(alias).replace(/\s+/g, String.raw`\s+`),
  );
  if (aliasPatterns.length === 0) return false;
  const alias = `(?:${aliasPatterns.join("|")})`;
  const attribution = new RegExp(
    String.raw`\b(?:according\s+to\s+(?:the\s+)?${alias}(?:['\u2019]s)?|${alias}(?:['\u2019]s)?\s+(?:${OWN_UPDATE_VERB}|own\s+(?:update|report|release)))\b`,
    "i",
  );
  return attribution.test(articleEvidenceText(article));
}

/** Choose the lightest defensible evidence rule for the article. The policy is
 * deliberately about claim risk, not a blanket source count. */
export function determineEvidencePolicy(
  article: DraftArticle,
  evidenceUrls: string[],
): EvidencePolicy {
  const risk = classifyEvidenceRisk(article);
  if (risk.requiresCorroboration) {
    return {
      lane: "corroborated-analysis",
      requiredPublisherCount: 2,
      reason: risk.reason ?? "high-risk claims require corroboration",
    };
  }

  const publisherDomains = new Set(
    evidenceUrls
      .map(approvedPublisherDomain)
      .filter((domain): domain is string => Boolean(domain)),
  );
  const source = evidenceUrls
    .map((url) => findSourceByUrl(url))
    .find((candidate): candidate is VerifiedSource => Boolean(candidate));
  const tightlyAttributedOwnUpdate =
    publisherDomains.size === 1 &&
    source !== undefined &&
    articleAttributesOwnUpdate(article, source);

  if (tightlyAttributedOwnUpdate && source?.tier === "government") {
    return {
      lane: "official-update",
      requiredPublisherCount: 1,
      reason:
        "one explicitly attributed government or regulator source is authoritative for its own update",
    };
  }
  if (
    tightlyAttributedOwnUpdate &&
    source?.tier === "institutional-research" &&
    (article.category === "market-pulse" || article.category === "macro") &&
    publisherDomains.size === 1
  ) {
    return {
      lane: "research-release",
      requiredPublisherCount: 1,
      reason:
        "one explicitly attributed institutional source is sufficient for reporting its own release",
    };
  }
  if (
    tightlyAttributedOwnUpdate &&
    evidenceUrls.every(isOfficialDeveloperUrl) &&
    (article.category === "launch" || article.category === "developer-corporate") &&
    publisherDomains.size === 1
  ) {
    return {
      lane: "developer-announcement",
      requiredPublisherCount: 1,
      reason:
        "one explicitly attributed first-party developer source is sufficient for its own announcement",
    };
  }
  return {
    lane: "corroborated-analysis",
    requiredPublisherCount: DEFAULT_CORROBORATION_SOURCES,
    reason:
      "national-press, market-wide, portal or otherwise ambiguous reporting requires independent corroboration",
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
    .replace(/[\u2013\u2014\u2212]/g, "-");
}

const CUR = String.raw`(?:AED|USD|US\$|\$|\u20ac|\u00a3|Dhs?|Dh)`;
const UNSIGNED_NUM =
  String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;
const SIGNED_NUM = String.raw`[+\-\u2212]?${UNSIGNED_NUM}`;
const MONTH =
  String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const COMPOUND_UNIT =
  String.raw`(?:basis\s+points?|square\s+(?:metres?|meters?|feet|foot)|sq\.?\s*(?:m|ft)|per\s*cent|per\s+annum)`;
const GENERIC_WORD =
  String.raw`(?!(?:and|or|to|in|of|for|from|by|at|on|with|as|is|was|were|are|the|a|an)\b)[A-Za-z][A-Za-z-]*`;
const TRAILING_DESCRIPTOR =
  String.raw`(?:%|percent|bps|pp|p\.a\.|bn|billion|million|trillion|tn|mn|sqm|sqft|psf|km|m|k|${COMPOUND_UNIT}|${GENERIC_WORD})`;

const EXCLUDED_DIGIT_PATTERNS = [
  /https?:\/\/[^\s)\]]+/gi,
  /\b(?:19|20)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+\-]\d{2}:\d{2})?\b/gi,
  /\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g,
  /\b\d{1,2}[-/]\d{1,2}[-/](?:19|20)\d{2}\b/g,
  new RegExp(
    String.raw`\b(?:\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}|${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?,?)\s+(?:19|20)\d{2}\b`,
    "gi",
  ),
  new RegExp(String.raw`\b${MONTH}\s+(?:19|20)\d{2}\b`, "gi"),
  /\b(?:19|20)\d{2}\s*[-\u2013\u2014]\s*(?:19|20)\d{2}\b/g,
  /\b(?:section|article|chapter|clause|paragraph|pages?|figure|table|appendix|steps?|items?)\s+(?:no\.?\s*)?\d+(?:\.\d+)*(?:\s*[-\u2013\u2014]\s*\d+(?:\.\d+)*)?\b/gi,
  /\[\d+(?:\s*[-,]\s*\d+)*\]/g,
  /(?:^|\n)\s*(?:\(\d+\)|\d+[.)])(?=\s)/g,
];

const PERIOD_SPAN_RE =
  /\b(?:H[12]|Q[1-4])(?:\s*(?:\/|&|,|\band\b)\s*(?:H[12]|Q[1-4]))*(?:\s+(?:19|20)\d{2})?\b/gi;
const LABELLED_DIGIT_RE = new RegExp(
  String.raw`(?<![-A-Za-z0-9])(?:phase|stage|tranche|plot|unit|tower|building|release|version)\s+(?:no\.?\s*)?${UNSIGNED_NUM}\b`,
  "gi",
);
const RATIO_OR_FRACTION_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])${SIGNED_NUM}\s*(?::|\/|\bin\b)\s*${UNSIGNED_NUM}(?![A-Za-z0-9])`,
  "gi",
);
const RANGE_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])${SIGNED_NUM}\s*(?:[-\u2013\u2014]|\bto\b)\s*${SIGNED_NUM}(?:\s*${TRAILING_DESCRIPTOR})?(?![A-Za-z0-9])`,
  "gi",
);
const GENERAL_DIGIT_SPAN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9])(?:${CUR}\s*)?${SIGNED_NUM}(?:(?:\s*${COMPOUND_UNIT})|(?:\s*(?:%|percent|bps|pp|p\.a\.|bn|billion|million|trillion|tn|mn|sqm|sqft|psf|km))|(?:\s*-\s*${GENERIC_WORD})|(?:\s+${GENERIC_WORD}))?(?![A-Za-z0-9])`,
  "gi",
);

function maskPattern(value: string, pattern: RegExp): string {
  return value.replace(pattern, (match) => " ".repeat(match.length));
}

function claimBearingNumericText(value: string): string {
  return EXCLUDED_DIGIT_PATTERNS.reduce(
    (text, pattern) => maskPattern(text, pattern),
    value,
  );
}

/** Every remaining digit-bearing span is evidence-bound after explicit safe
 * exclusions for URLs, ordinary calendar dates and navigation labels. Ordered
 * matching preserves periods, ratios, ranges, signs and noun/unit context. */
export function extractFigures(value: string): string[] {
  let unclaimed = claimBearingNumericText(value);
  const out = new Set<string>();
  for (const pattern of [
    PERIOD_SPAN_RE,
    LABELLED_DIGIT_RE,
    RATIO_OR_FRACTION_RE,
    RANGE_RE,
    GENERAL_DIGIT_SPAN_RE,
  ]) {
    unclaimed = unclaimed.replace(pattern, (match) => {
      const figure = norm(match);
      if (figure) out.add(figure);
      return " ".repeat(match.length);
    });
  }
  return [...out];
}

export function bodyHasStatSignal(value: string): boolean {
  return /\d/.test(claimBearingNumericText(value));
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
