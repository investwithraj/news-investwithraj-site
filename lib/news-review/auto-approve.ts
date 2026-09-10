// Deterministic evidence assessor and fail-closed publisher. Only drafts that
// satisfy every conservative source and figure gate can enter auto-publish.
//
// A draft is AUTO-APPROVABLE iff ALL of:
//   1. the 8-gate voice validator passes              (draft.validator.ok)
//   2. every evidence record proves it was explicitly dated and fresh at the
//      immutable direct-fetch/staging clock
//   3. every unattended publication rechecks draft and evidence recency at its
//      actual publication clock, without silently refetching or rewriting it
//   4. evidence satisfies the risk-based publisher policy: a strictly
//      attributed official fact may use its one authoritative primary source;
//      analysis, comparisons, forecasts and recommendations require two
//      independent approved canonical parent publishers
//   5. EVERY figure in reader-visible model-controlled text appears in fetched
//      evidence as the same contextual numeric tuple
//   6. SAFETY GUARD: a statistical signal the figure parser did not capture
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
import { validateCtaLabel } from "@/lib/voice/validator";
import { findNewsDraftQuarantine } from "./draft-quarantine";
import { hasApprovedCuratedMediaContext } from "./curated-media-context";
import { assertRequiredCuratedMediaApproval } from "./curated-media";
import { hasApprovedDailyMediaContext } from "./daily-media-catalog";
import {
  assertRequiredDailyMediaApproval,
  DailyMediaReuseError,
  ensureDailyMediaApproval,
  type DailyMediaReuseResponse,
} from "./daily-media";
import { draftContentHash, mediaApprovalHash } from "./integrity";
import { assessAttributedAnnouncement, assessClaimSupport, type ClaimSupportAssessment } from "./claim-support";
import { dubaiCalendarDate } from "@/lib/dubai-time";

export const DEFAULT_CORROBORATION_SOURCES = 2;
export const MAX_AUTO_NEWS_SOURCE_AGE_HOURS = 7 * 24;

export type EvidenceLane = "official-fact" | "attributed-announcement" | "corroborated-analysis";

export interface EvidencePolicy {
  lane: EvidenceLane;
  requiredPublisherCount: 1 | 2;
  reason: string;
}

const INVESTMENT_OR_FORECAST_CLAIM_RE =
  /\b(?:recommend(?:s|ed|ation)?|should\s+(?:buy|sell|avoid)|buy\s+call|sell\s+call|undervalued|overvalued|outperform|underperform|guaranteed|risk[- ]free|forecast(?:s|ed)?|projected\s+return|will\s+(?:rise|fall|increase|decline)\s+by|(?:is|are|was|were)?\s*(?:expected|forecast|projected|predicted)\s+to\s+(?:rise|fall|increase|decline|grow|drop|double|halve)|analysts?\s+(?:expect|predict|forecast)|prices?\s+(?:will|are\s+(?:set|expected)\s+to)\s+(?:rise|fall|increase|decline))\b/i;
const PREDICTION_OR_CERTAINTY_CLAIM_RE =
  /\b(?:(?:certain|sure|bound|destined|poised|set|on\s+track|likely|unlikely|expected|forecast|projected|predicted)\s+to|(?:will|would|could|may|might)\s+(?:be|become|make|deliver|generate|produce|create|drive|boost|increase|decrease|rise|fall|grow|decline|outperform|underperform)|inevitabl(?:e|y)|definite(?:ly)?|undoubtedly|without\s+doubt)\b/i;
const INVESTMENT_OUTCOME_OR_WEALTH_CLAIM_RE =
  /\b(?:capital\s+appreciation|wealth\s+creation|financial\s+(?:benefit|freedom|gain)|return\s+on\s+investment|investment\s+(?:return|returns|outcome|outcomes|upside)|roi|profit(?:s|able|ability)?|wealth(?:y|ier)?|richer|make\s+money|money[- ]making|stand\s+to\s+(?:benefit|gain|profit))\b|\b(?:buyers?|investors?|owners?|purchasers?|residents?)\b[\s\S]{0,80}\b(?:benefit(?:s|ed)?|profit(?:s|ed|able|ability)?|gain(?:s|ed)?|return(?:s|ed)?|yield(?:s|ed)?|appreciat(?:e|es|ed|ion)|upside|wealth(?:y|ier)?|richer|prosper(?:ity|ous)?)\b/i;
const PROMOTIONAL_OR_DESIRABILITY_CLAIM_RE =
  /\b(?:desirab(?:le|ility)|coveted|sought[- ]after|attractive|appealing|aspirational|elite|exclusive|luxur(?:y|ious)|prestigious|iconic|world[- ]class|best[- ]in[- ]class|unmissable|irresistible|exceptional|extraordinary|outstanding|unique|incomparable|unbeatable|unrivalled|unparalleled|premier|ultimate|ideal|perfect|remarkable|stunning|spectacular|game[- ]changing|transformative|once[- ]in[- ]a[- ]lifetime|must[- ]own)\b/i;
const SUPERLATIVE_OR_RANKING_CLAIM_RE =
  /\b(?:(?:the\s+)?(?:most|least|best|worst|finest|greatest|leading|top[- ]ranked|number\s+one|no\.?\s*1)\b|(?:more|less)\s+(?:desirable|attractive|valuable|profitable|affordable|expensive)\b|(?:better|worse|higher|lower|larger|smaller|faster|slower|cheaper|costlier)\s+than\b|(?:outstrip|outstrips|outperform|outperforms|surpass|surpasses|exceed|exceeds)\b)/i;
const RECOMMENDATION_OR_PROMOTIONAL_ACTION_RE =
  /\b(?:(?:buyers?|investors?|purchasers?)\s+(?:should|must|need\s+to|ought\s+to)|worth\s+(?:buying|purchasing|investing\s+in)|(?:buy|invest|book|reserve|secure)\s+(?:now|today|before\s+it(?:'|\u2019)?s\s+too\s+late)|not\s+to\s+be\s+missed|smart\s+(?:buy|investment|choice)|wise\s+(?:buy|investment|choice)|investment\s+opportunity)\b/i;
const DISPUTED_OR_MARKET_WIDE_CLAIM_RE =
  /\b(?:disput(?:e[ds]?|ing)|contest(?:ed|s|ing)?|challeng(?:e[ds]?|ing)|question(?:ed|s|ing)?|critics?\s+(?:challeng(?:e[ds]?|ing)|disput(?:e[ds]?|ing)|contest(?:ed|s|ing)?)|deni(?:ed|es|al)|alleg(?:ed|es|ation|ations)|market-wide|across\s+the\s+(?:property|real\s+estate|housing)\s+market|(?:property|real\s+estate|housing)\s+market\s+(?:grew|rose|fell|declined|increased|decreased)|market\s+(?:will|is\s+set\s+to|is\s+expected\s+to))\b/i;
const AMBIGUOUS_MARKET_OR_THIRD_PARTY_RE =
  /\b(?:market|macro(?:economic)?|econom(?:y|ic|ics)|inflation|sector|industry|analysts?|critics?|commentators?|brokers?|consultants?|investors?|buyers?|sellers?|demand|supply|absorption|prices?|rents?|yields?|valuations?|values?)\b[\s\S]{0,80}\b(?:grew|growth|rose|risen|rise|rising|fell|fallen|falling|declin(?:e|ed|ing)|increas(?:e|ed|ing)|decreas(?:e|ed|ing)|strengthen(?:ed|ing)?|weaken(?:ed|ing)?|climb(?:ed|ing)?|drop(?:ped|ping)?|surge(?:d|ing)?|slow(?:ed|ing)?|accelerat(?:e|ed|ing)|expect(?:s|ed|ing)?|predict(?:s|ed|ing)?|forecast(?:s|ed|ing)?)\b/i;
const INTERPRETATION_OR_COMPARISON_RE =
  /\b(?:we\s+(?:believe|think|expect)|in\s+our\s+view|our\s+(?:view|analysis|assessment)|implication|suggests?|signals?|indicates?|means\s+that|therefore|consequently|however|relative(?:ly)?|versus|vs\.?|compared\s+(?:with|to)|comparison|better|worse|stronger|weaker|more\s+attractive|less\s+attractive|opportunity|risk-reward|premium|discount|outperform|underperform|recommend(?:s|ed|ation)?|should\s+(?:buy|sell|avoid|consider)|buy\s+call|sell\s+call|underlying\s+thesis|investment\s+(?:case|thesis)|read-through)\b|\bestablish(?:es|ed|ing)\b[\s\S]{0,48}\b(?:thesis|mandate|catalyst|opportunity)\b/i;

const OFFICIAL_FACT_CATEGORIES = new Set<DraftArticle["category"]>([
  "launch",
  "regulatory",
  "developer-corporate",
  "infrastructure",
  "policy",
]);
const ATTRIBUTION_VERB_PATTERN =
  String.raw`(?:announce(?:d|s)?|confirm(?:ed|s)?|publish(?:ed|es)?|release(?:d|s)?|report(?:ed|s)?|state(?:d|s)?|record(?:ed|s)?|register(?:ed|s)?|disclose(?:d|s)?|approve(?:d|s)?|issue(?:d|s)?|launch(?:ed|es)?|open(?:ed|s)?|complete(?:d|s)?|award(?:ed|s)?|sign(?:ed|s)?|say|says|said)`;
const ATTRIBUTION_VERB_RE = new RegExp(
  String.raw`\b${ATTRIBUTION_VERB_PATTERN}\b`,
  "iu",
);
const STRICT_FACT_NOUN_RE =
  /^(?:regulations?|polic(?:y|ies)|laws?|rules?|guidance|directives?|decrees?|resolutions?|permits?|licen[cs]es?|approvals?|filings?|reports?|records?|registrations?|transactions?|contracts?|agreements?|awards?|appointments?|acquisitions?|mergers?|announcements?|releases?|launch(?:es)?|openings?|completions?|construction|developments?|projects?|phases?|implementations?|terms?|scopes?|timetables?|schedules?|plans?|process(?:es)?|procedures?|units?|homes?|towers?|floors?|bedrooms?|corridors?|hectares?|facilit(?:y|ies)|infrastructure|services?|systems?|programmes?|initiatives?|dates?|deadlines?|fees?|values?|amounts?|prices?|areas?|sizes?|locations?|routes?|stations?|updates?|mandates?|milestones?|payments?|quantit(?:y|ies)|totals?|deliver(?:y|ies)|precincts?)$/iu;
const STRICT_FACT_DESCRIPTOR_WORDS = new Set([
  "a",
  "an",
  "the",
  "this",
  "its",
  "their",
  "own",
  "official",
  "direct",
  "directly",
  "published",
  "verified",
  "named",
  "applicable",
  "annual",
  "new",
  "revised",
  "amended",
  "updated",
  "regulatory",
  "service",
  "implementation",
  "registration",
  "transaction",
  "payment",
  "delivery",
  "construction",
  "development",
  "project",
  "launch",
  "opening",
  "completion",
  "precinct",
  "secondary",
  "market",
  "phase",
  "sales",
  "total",
  "number",
  "square",
  "sq",
  "km",
]);
const STRICT_SCALAR_WORDS = new Set([
  "aed",
  "usd",
  "dhs",
  "dirham",
  "dirhams",
  "thousand",
  "million",
  "billion",
  "percent",
  "percentage",
  "sqm",
  "sqft",
  "square",
  "metres",
  "meters",
  "feet",
  "kilometres",
  "kilometers",
  "km",
  "units",
  "homes",
  "towers",
  "floors",
  "bedrooms",
  "corridor",
  "corridors",
  "hectare",
  "hectares",
  "days",
  "months",
  "years",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);
const STRICT_FACT_RELATION_RE =
  /^(.+?)\s+(?:records?|sets?(?:\s+out)?|specif(?:y|ies|ied)|lists?|covers?|includes?|names?|states?|reports?|confirms?|shows?|contains?|applies?\s+to)\s+(.+)$/iu;
const EMBEDDED_OFFICIAL_ACT_VERB_PATTERN =
  String.raw`(?:announce(?:d|s)?|confirm(?:ed|s)?|publish(?:ed|es)?|report(?:ed|s)?|register(?:ed|s)?|approve(?:d|s)?|issue(?:d|s)?|launch(?:ed|es)?|open(?:ed|s)?|complete(?:d|s)?|award(?:ed|s)?|sign(?:ed|s)?)`;

export interface EvidenceRiskClassification {
  requiresCorroboration: boolean;
  reason: string | null;
}

export interface ArticleEvidenceSegment {
  field: string;
  text: string;
}

/** Canonical projection of model-controlled text that can reach a reader or
 * public metadata. Registry-derived citation labels, ledger-derived media
 * credit and derived CTA copy are deliberately outside this evidence set. */
export function articleEvidenceSegments(
  article: DraftArticle,
): ArticleEvidenceSegment[] {
  const tldr = Array.isArray(article.tldr) ? article.tldr : [];
  const faq = Array.isArray(article.faq) ? article.faq : [];
  const semaform = article.semaform;
  const viewsFrom = Array.isArray(semaform?.viewsFrom)
    ? semaform.viewsFrom
    : [];
  const trade = semaform?.howIdTradeIt;
  const segments: ArticleEvidenceSegment[] = [
    { field: "title", text: article.title },
    { field: "subtitle", text: article.subtitle ?? "" },
    { field: "metaDescription", text: article.metaDescription ?? "" },
    ...tldr.map((text, index) => ({ field: `tldr[${index}]`, text })),
    { field: "body", text: article.body },
    ...faq.flatMap((entry, index) => [
      { field: `faq[${index}].q`, text: entry?.q ?? "" },
      { field: `faq[${index}].a`, text: entry?.a ?? "" },
    ]),
    { field: "semaform.theTake", text: semaform?.theTake ?? "" },
    ...viewsFrom.flatMap((view, index) => [
      { field: `semaform.viewsFrom[${index}].source`, text: view?.source ?? "" },
      { field: `semaform.viewsFrom[${index}].role`, text: view?.role ?? "" },
      { field: `semaform.viewsFrom[${index}].view`, text: view?.view ?? "" },
    ]),
    {
      field: "semaform.realityCheck",
      text: semaform?.realityCheck ?? "",
    },
    {
      field: "semaform.whatHappensNext",
      text: semaform?.whatHappensNext ?? "",
    },
    { field: "semaform.howIdTradeIt.action", text: trade?.action ?? "" },
    {
      field: "semaform.howIdTradeIt.reasoning",
      text: trade?.reasoning ?? "",
    },
    {
      field: "semaform.howIdTradeIt.horizon",
      text: trade?.horizon ?? "",
    },
    // Exact owner-approved image descriptions use image provenance, not an
    // unrelated article source. Publication separately requires that ledger.
    { field: "heroImage.alt", text: hasApprovedCuratedMediaContext(article) || hasApprovedDailyMediaContext(article) ? "" : article.heroImage?.alt ?? "" },
  ];
  return segments.filter((segment) => segment.text.trim().length > 0);
}

export function articleEvidenceText(article: DraftArticle): string {
  return articleEvidenceSegments(article)
    .map((segment) => segment.text)
    .join("\n");
}

/** One complete claim-risk classifier for drafting, stored-draft assessment,
 * ledger minting and publication recomputation. */
export function classifyEvidenceRisk(
  article: DraftArticle,
): EvidenceRiskClassification {
  return classifyEvidenceRiskInternal(article, false);
}

function classifyEvidenceRiskInternal(
  article: DraftArticle,
  verifiedCorporateIntent: boolean,
): EvidenceRiskClassification {
  const text = articleEvidenceText(article);
  if (article.semaform?.howIdTradeIt || INVESTMENT_OR_FORECAST_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "investment conclusions and forecasts require corroboration",
    };
  }
  if (INVESTMENT_OUTCOME_OR_WEALTH_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "investment outcomes or buyer-wealth claims require corroboration",
    };
  }
  if (!verifiedCorporateIntent && PREDICTION_OR_CERTAINTY_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "predictive or certainty claims require corroboration",
    };
  }
  if (
    PROMOTIONAL_OR_DESIRABILITY_CLAIM_RE.test(text) ||
    SUPERLATIVE_OR_RANKING_CLAIM_RE.test(text)
  ) {
    return {
      requiresCorroboration: true,
      reason: "promotional, desirability or ranking claims require corroboration",
    };
  }
  if (RECOMMENDATION_OR_PROMOTIONAL_ACTION_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "recommendations or promotional calls to action require corroboration",
    };
  }
  if (DISPUTED_OR_MARKET_WIDE_CLAIM_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "disputed or market-wide claims require independent corroboration",
    };
  }
  if (AMBIGUOUS_MARKET_OR_THIRD_PARTY_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "market movement or third-party claims require independent corroboration",
    };
  }
  if (INTERPRETATION_OR_COMPARISON_RE.test(text)) {
    return {
      requiresCorroboration: true,
      reason: "interpretation or comparison requires independent corroboration",
    };
  }
  return { requiresCorroboration: false, reason: null };
}

export function normalizedPublisherAliases(identity: ApprovedPublisherIdentity): string[] {
  const base = identity.name
    .replace(/\s*[—–-]\s*.*$/u, "")
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .trim();
  const words = base.match(/[A-Za-z0-9]+/gu) ?? [];
  const initialism = words
    .filter((word) => !/^(?:and|of|the)$/iu.test(word))
    .map((word) => word[0])
    .join("");
  const aliases = new Set([identity.name, base]);
  if (initialism.length >= 2) aliases.add(initialism);
  if (words.length >= 2 && /(?:properties|property|developments|holding)$/iu.test(words.at(-1) ?? "")) {
    aliases.add(words.slice(0, -1).join(" "));
  }
  return [...aliases]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 2);
}

function claimUnits(article: DraftArticle): string[] {
  const fields = articleEvidenceSegments(article)
    .filter(
      ({ field }) =>
        field !== "heroImage.alt" &&
        !/\.q$/u.test(field) &&
        field !== "semaform.howIdTradeIt.action",
    )
    .flatMap(({ text }) =>
      text
        .split(
          /\n{2,}|(?<=[.!?])\s+|[;\uFF1B]+|\s+[\u2013\u2014]\s+|,\s+(?=(?:making|meaning|ensuring|thereby|thus\s+making|so\s+that|which\s+(?:means|makes))\b)/iu,
        )
        .map((value) => value.trim())
        .filter(Boolean),
    );
  return fields.filter((value) => value.length >= 12);
}

function escapedRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedClaim(value: string): string {
  return value
    .trim()
    .replace(/^[\s"'\u201c\u2018]+/u, "")
    .replace(/[\s.!?"'\u201d\u2019]+$/u, "")
    .trim();
}

function claimWords(value: string): string[] {
  return value.match(/[\p{L}\p{M}\p{N}%]+(?:[-'\u2019][\p{L}\p{M}\p{N}%]+)*/gu) ?? [];
}

function isNumericToken(value: string): boolean {
  return /^\d+(?:[.,]\d+)*%?$/u.test(value);
}

function isProperNameToken(value: string): boolean {
  return /^[\p{Lu}][\p{L}\p{M}\p{N}'\u2019-]*$/u.test(value);
}

function isStrictScalar(value: string): boolean {
  const words = claimWords(normalizedClaim(value));
  return (
    words.length > 0 &&
    words.some(isNumericToken) &&
    words.every(
      (word) =>
        isNumericToken(word) || STRICT_SCALAR_WORDS.has(word.toLowerCase()),
    )
  );
}

function isStrictName(value: string): boolean {
  const words = claimWords(normalizedClaim(value));
  return (
    words.length > 0 &&
    words.length <= 8 &&
    words.every(
      (word) =>
        isProperNameToken(word) ||
        /^(?:al|bin|bint|of|the)$/iu.test(word) ||
        isNumericToken(word),
    )
  );
}

function isStrictFactItem(value: string): boolean {
  const words = claimWords(normalizedClaim(value));
  const factNoun = words.at(-1);
  if (!factNoun || !STRICT_FACT_NOUN_RE.test(factNoun)) return false;

  const namedFact =
    /^(?:announcements?|releases?|launch(?:es)?|openings?|developments?|projects?|phases?|locations?|routes?|stations?|precincts?)$/iu.test(
      factNoun,
    );
  return words.slice(0, -1).every((word) => {
    return (
      STRICT_FACT_DESCRIPTOR_WORDS.has(word.toLowerCase()) ||
      isNumericToken(word) ||
      (namedFact && isProperNameToken(word))
    );
  });
}

function strictFactList(value: string, depth: number): boolean {
  const items = value
    .split(/,\s+|\s+and\s+/iu)
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    items.length > 0 &&
    items.every((item) => isStrictFactExpression(item, depth + 1))
  );
}

function isStrictFactExpression(value: string, depth = 0): boolean {
  if (depth > 4) return false;
  const claim = normalizedClaim(value).replace(/^that\s+/iu, "");
  if (!claim) return false;
  if (isStrictFactItem(claim) || isStrictScalar(claim)) return true;

  const embeddedAct = claim.match(
    new RegExp(
      `^(.+?)\\s+${EMBEDDED_OFFICIAL_ACT_VERB_PATTERN}\\s+(.+)$`,
      "iu",
    ),
  );
  if (
    embeddedAct &&
    isStrictName(embeddedAct[1]) &&
    isStrictFactExpression(embeddedAct[2], depth + 1)
  ) {
    return true;
  }

  const relation = claim.match(STRICT_FACT_RELATION_RE);
  if (
    relation &&
    isStrictFactItem(relation[1]) &&
    strictFactList(relation[2], depth)
  ) {
    return true;
  }

  const prepositions = [
    ...claim.matchAll(/\s+(?:of|in|at|on|for|across|within|from|to|with|by)\s+/giu),
  ];
  for (const match of prepositions) {
    const index = match.index;
    if (index === undefined) continue;
    const left = claim.slice(0, index);
    const right = claim.slice(index + match[0].length);
    if (
      (isStrictFactItem(left) &&
        (isStrictFactItem(right) ||
          isStrictScalar(right) ||
          isStrictName(right) ||
          isStrictFactExpression(right, depth + 1))) ||
      (isStrictScalar(left) && isStrictFactExpression(right, depth + 1))
    ) {
      return true;
    }
  }

  const listed = claim.split(/,\s+|\s+and\s+/iu);
  return (
    listed.length > 1 &&
    listed.every((item) => isStrictFactExpression(item, depth + 1))
  );
}

function attributedClaimContent(
  unit: string,
  aliases: readonly string[],
): string | null {
  for (const alias of aliases) {
    const match = normalizedClaim(unit).match(
      new RegExp(
        `^${escapedRegex(alias)}\\s+${ATTRIBUTION_VERB_PATTERN}\\b\\s+(.+)$`,
        "iu",
      ),
    );
    if (match?.[1]) return match[1];
  }
  return null;
}

function isStrictOfficialClaimContent(value: string): boolean {
  const coordinated = value
    .split(
      new RegExp(
        `,?\\s+(?:and|then)\\s+(?=${ATTRIBUTION_VERB_PATTERN}\\b)`,
        "iu",
      ),
    )
    .map((part, index) =>
      index === 0
        ? part
        : part.replace(
            new RegExp(`^${ATTRIBUTION_VERB_PATTERN}\\b\\s+`, "iu"),
            "",
          ),
    );
  return coordinated.every((part) => isStrictFactExpression(part));
}

/** The one-source lane is deliberately narrow. The source must be a regulator,
 * government body or the developer speaking on its own canonical domain; every
 * reader-visible factual unit must repeat both the official identity and an
 * attribution verb. Anything interpretive falls back to corroborated analysis. */
export function strictlyAttributedOfficialFact(
  article: DraftArticle,
  evidenceUrls: string[],
): { ok: boolean; reason: string } {
  const domains = [...new Set(evidenceUrls.map(approvedPublisherDomain).filter(Boolean))];
  if (domains.length !== 1) {
    return {
      ok: false,
      reason: "the official-fact lane requires exactly one canonical primary publisher",
    };
  }
  const identity = approvedPublisherIdentity(evidenceUrls[0] ?? "");
  if (!identity) {
    return { ok: false, reason: "the cited publisher is not an approved source" };
  }
  const authoritative =
    identity.tier === "government" || isOfficialDeveloperUrl(evidenceUrls[0]);
  if (!authoritative) {
    return {
      ok: false,
      reason: "the sole publisher is not an authoritative government, regulator or first-party developer source",
    };
  }
  if (!OFFICIAL_FACT_CATEGORIES.has(article.category)) {
    return {
      ok: false,
      reason: `category ${article.category} is not eligible for one-source official facts`,
    };
  }
  const risk = classifyEvidenceRisk(article);
  if (risk.requiresCorroboration) {
    return { ok: false, reason: risk.reason ?? "the article requires corroboration" };
  }

  const aliases = normalizedPublisherAliases(identity);
  const units = claimUnits(article);
  if (units.length === 0) {
    return {
      ok: false,
      reason: "the official-fact lane found no complete reader-visible claim",
    };
  }
  const unattributed = units.filter(
    (unit) =>
      !ATTRIBUTION_VERB_RE.test(unit) ||
      attributedClaimContent(unit, aliases) === null,
  );
  if (unattributed.length > 0) {
    return {
      ok: false,
      reason: `${unattributed.length} factual unit(s) are not explicitly attributed to ${identity.name}`,
    };
  }
  const outOfScope = units.filter((unit) => {
    const content = attributedClaimContent(unit, aliases);
    return content === null || !isStrictOfficialClaimContent(content);
  });
  if (outOfScope.length > 0) {
    return {
      ok: false,
      reason: `${outOfScope.length} attributed unit(s) fall outside the narrow official-act and official-record scope`,
    };
  }
  return {
    ok: true,
    reason: `strictly attributed official facts from ${identity.name}`,
  };
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

export interface ApprovedPublisherIdentity {
  domain: string;
  name: string;
  tier: VerifiedSource["tier"];
}

/** Public citation identity is registry-owned, never model-owned. */
export function approvedPublisherIdentity(
  url: string,
): ApprovedPublisherIdentity | null {
  const source = findSourceByUrl(url);
  const domain = approvedPublisherDomain(url);
  return source && source.citable !== false && domain
    ? { domain, name: source.publisherName ?? source.name, tier: source.tier }
    : null;
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

export interface AutoPublicationRecency {
  ok: boolean;
  reasons: string[];
}

/** Re-evaluate recency at the actual automated publication clock without
 * refetching. A source that was fresh when staged may no longer be fresh when
 * an unattended run reaches it, so both the draft and its immutable evidence
 * timestamps must remain inside the existing evidence-policy window. */
export function assessAutoPublicationRecency(
  draft: Pick<NewsDraft, "article" | "provenance"> &
    Partial<Pick<NewsDraft, "createdAt">>,
  publicationAt: Date,
): AutoPublicationRecency {
  const reasons: string[] = [];
  const publicationMilliseconds = publicationAt.getTime();
  if (!Number.isFinite(publicationMilliseconds)) {
    return {
      ok: false,
      reasons: ["auto-publication clock is invalid"],
    };
  }

  const checkAge = (
    label: string,
    value: unknown,
    maxAgeHours: number,
  ): void => {
    const timestamp = exactIsoMilliseconds(value);
    if (timestamp === null) {
      reasons.push(`${label} timestamp is missing or invalid`);
      return;
    }
    const ageHours = (publicationMilliseconds - timestamp) / 3_600_000;
    if (ageHours < 0) {
      reasons.push(
        `${label} timestamp is ${Math.abs(ageHours).toFixed(1)}h after the auto-publication clock`,
      );
      return;
    }
    if (ageHours > maxAgeHours) {
      reasons.push(
        `${label} is ${ageHours.toFixed(1)}h old at auto-publication (maximum ${maxAgeHours}h)`,
      );
    }
  };

  checkAge(
    "draft creation",
    draft.createdAt,
    MAX_AUTO_NEWS_SOURCE_AGE_HOURS,
  );
  checkAge(
    "article publication",
    draft.article.publishedAt,
    MAX_AUTO_NEWS_SOURCE_AGE_HOURS,
  );

  for (const evidence of draft.provenance.fetchedEvidence ?? []) {
    const storedFreshness = assessStoredEvidenceFreshness(evidence);
    if (!storedFreshness.ok) continue;
    const maxAgeHours = evidence.freshnessMaxAgeHours as number;
    const identity = (evidence.finalUrl ?? evidence.url).slice(0, 180);
    checkAge(
      `source publication for ${identity}`,
      evidence.sourcePublishedAt,
      maxAgeHours,
    );
    checkAge(
      `direct-fetched evidence for ${identity}`,
      evidence.fetchedAt,
      maxAgeHours,
    );
  }

  return { ok: reasons.length === 0, reasons };
}

/** Recompute the immutable staging-time freshness decision. Automated
 * publication adds a separate current-clock check through
 * assessAutoPublicationRecency; manual review can still inspect an old packet. */
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
  if (
    !(["meta", "json-ld", "time", "visible", "publisher-api"] as const).includes(
      evidence.sourceDateSource,
    )
  ) {
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

/** Select the smallest safe evidence lane. A single source is allowed only for
 * strictly attributed official facts or the verified, typed corporate-plan lane.
 * All analysis, comparisons, market claims, forecasts and recommendations stay
 * on the two-independent-publisher lane. */
export function determineEvidencePolicy(
  article: DraftArticle,
  evidenceUrls: string[],
  fetchedEvidence: readonly NonNullable<NewsDraftProvenance["fetchedEvidence"]>[number][] = [],
): EvidencePolicy {
  if (article.reportingBasis !== undefined) {
    const shape = validateArticleReportingBasis(article);
    const announcement = shape.ok ? assessAttributedAnnouncement({
      format: article.format, category: article.category, reportingBasis: article.reportingBasis,
      ...claimSupportInput(article, fetchedEvidence),
    }) : { ok: false, reason: shape.error };
    const announcementRisk = classifyEvidenceRiskInternal(article, announcement.ok);
    const sourceFetched = fetchedEvidence.some((record) =>
      record.url === article.reportingBasis?.sourceUrl &&
      approvedEvidencePublisherDomain(record.url, record.finalUrl) !== null &&
      evidenceUrls.includes(record.finalUrl ?? record.url));
    if (announcement.ok && sourceFetched && !announcementRisk.requiresCorroboration) {
      return { lane: "attributed-announcement", requiredPublisherCount: 1, reason: announcement.reason };
    }
    return { lane: "corroborated-analysis", requiredPublisherCount: DEFAULT_CORROBORATION_SOURCES,
      reason: announcementRisk.reason ?? announcement.reason ?? "The announcement basis is not source-bound." };
  }
  const risk = classifyEvidenceRisk(article);
  const official = strictlyAttributedOfficialFact(article, evidenceUrls);
  if (!risk.requiresCorroboration && official.ok) {
    return {
      lane: "official-fact",
      requiredPublisherCount: 1,
      reason: official.reason,
    };
  }
  return {
    lane: "corroborated-analysis",
    requiredPublisherCount: DEFAULT_CORROBORATION_SOURCES,
    reason:
      risk.reason ??
      `${official.reason}; two independent approved canonical publishers are required`,
  };
}

/** Structural authority only; the matcher separately verifies the source text. */
export function validateArticleReportingBasis(article: {
  format?: string; category: string; citations: readonly { url: string }[]; reportingBasis?: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (article.reportingBasis === undefined) return { ok: true };
  const basis = article.reportingBasis;
  const invalid = { ok: false, error: "article.reportingBasis must name an exact cited corporate-intent source, speaker and organization on an eligible short update." } as const;
  if (!basis || typeof basis !== "object" || Array.isArray(basis) || article.format !== "short-update" ||
    !["developer-corporate", "launch"].includes(article.category)) return invalid;
  const record = basis as Record<string, unknown>;
  if (Object.keys(record).length !== 4 || Object.keys(record).some((key) =>
    !["sourceUrl", "speaker", "organization", "statementKind"].includes(key)) ||
    record.statementKind !== "corporate-intent") return invalid;
  for (const key of ["speaker", "organization"] as const) {
    const text = record[key];
    if (typeof text !== "string" || text.trim().length < 2 || text.length > 160 ||
      text !== text.trim() || /[\u0000-\u001f\u007f]/u.test(text)) return invalid;
  }
  if (typeof record.sourceUrl !== "string" || record.sourceUrl.length > 2_048 ||
    !article.citations.some((citation) => citation.url === record.sourceUrl)) return invalid;
  try {
    const url = new URL(record.sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      (url.port && url.port !== "443") || url.pathname === "/" ||
      !approvedPublisherIdentity(record.sourceUrl)) return invalid;
  } catch { return invalid; }
  return { ok: true };
}

function claimSupportInput(article: DraftArticle, evidence: readonly NonNullable<NewsDraftProvenance["fetchedEvidence"]>[number][]) {
  return {
    segments: articleEvidenceSegments(article).filter(({ field }) => !/\.q$/u.test(field)),
    evidence: evidence.map((record) => {
      const finalUrl = record.finalUrl ?? record.url;
      const identity = approvedPublisherIdentity(finalUrl) ?? approvedPublisherIdentity(record.url);
      return { url: record.url, text: record.text, publisher: identity?.name ?? finalUrl,
        publisherDomain: approvedEvidencePublisherDomain(record.url, record.finalUrl) ?? `invalid:${record.url}`,
        publisherAliases: identity ? normalizedPublisherAliases(identity) : [] };
    }),
  };
}

/** The drafting path and stored approval path use the same attribution matcher. */
export function assessArticleClaimSupport(article: DraftArticle,
  evidence: readonly NonNullable<NewsDraftProvenance["fetchedEvidence"]>[number][]): ClaimSupportAssessment {
  const input = claimSupportInput(article, evidence);
  return article.reportingBasis !== undefined
    ? assessAttributedAnnouncement({ ...input, format: article.format, category: article.category, reportingBasis: article.reportingBasis }).support
    : assessClaimSupport(input);
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
  claimSupportCheckedClauseCount: number;
  unsupportedClaimCount: number;
  unusedEvidenceCount: number;
  /** Figures present in publishable fields but absent from fetched evidence. */
  amberFigures: string[];
  /** Human-readable reasons a draft was held for manual review (empty = approve). */
  reasons: string[];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const NUMERIC_DASH_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/** Dash normalisation is intentionally one character for one character so the
 * parser can retain exact character coverage and surface any unmatched digit. */
function normalizeNumericDashes(value: string): string {
  return value.replace(NUMERIC_DASH_RE, "-");
}

/** Preserve the value and unit while normalising publisher typography such as
 * AED3.5 vs AED 3.5, 8,000 vs 8000, and 30 per cent vs 30%. */
export function normNumericEvidence(value: string): string {
  return norm(normalizeNumericDashes(value))
    .replace(/\b(?:dhs?|aed)\b/g, "aed")
    .replace(/\b(?:usd|us\$)\b/g, "usd")
    .replace(/\b(?:per\s*cent|percent)\b/g, "%")
    .replace(/\b(?:basis\s+points?|bps?)\b/g, "bp")
    .replace(/\b(?:square\s+(?:metres?|meters?)|sq\.?\s*m|sqm)\b/g, "sqm")
    .replace(/\b(?:square\s+(?:feet|foot)|sq\.?\s*ft|sqft)\b/g, "sqft")
    .replace(/\b(?:millions?|mn)\b/g, "million")
    .replace(/\b(?:billions?|bn)\b/g, "billion")
    .replace(/\s+to\s+/g, "-")
    .replace(/(?<=\d),(?=\d{3}\b)/g, "")
    .replace(/\s+/g, "");
}

const CUR = String.raw`(?:AED|USD|US\$|\$|\u20ac|\u00a3|Dhs?|Dh)`;
const UNSIGNED_NUM =
  String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`;
const SIGNED_NUM = String.raw`(?:[+\-][ \t]*)?${UNSIGNED_NUM}`;
const MONTH =
  String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const SCALE = String.raw`(?:hundred|thousand|millions?|billions?|trillions?|mn|bn|tn|k)`;
const UNIT = String.raw`(?:%|percent|per[ \t]+cent|bps?|basis[ \t]+points?|percentage[ \t]+points?|pp|p\.a\.|per[ \t]+annum|square[ \t]+(?:metres?|meters?|feet|foot)|sq\.?[ \t]*(?:m|ft)|sqm|sqft|psf|km|kilometres?|kilometers?|metres?|meters?|hectares?|floors?|bedrooms?|towers?|units?|transactions?)`;
const HEAD_STOP = String.raw`(?:a|an|the|and|or|but|nor|to|in|of|for|from|by|at|on|with|without|as|is|was|were|are|be|been|being|remain|remains|remained|align|aligns|according|across|around|throughout|after|before|during|while|where|which|who|whom|whose|that|this|these|those|than|then|when|if|because|into|onto|over|under|between|through|amid|against|per|each|its|their|his|her|our|your|aed|usd|dhs?|reported|reports|said|says|stated|states|confirmed|confirms|announced|announces|published|publishes|released|releases|recorded|records|reached|reaches|rose|fell|grew|declined|increased|decreased|climbed|dropped|surged|expects|expected|predicts|predicted|forecast|forecasts)`;
const HEAD_WORD = String.raw`(?!(?:${HEAD_STOP})\b)[A-Za-z][A-Za-z'\u2019-]*`;
const HEAD_PHRASE = String.raw`(?:[ \t]+${HEAD_WORD}){0,8}`;

const EXCLUDED_DIGIT_PATTERNS = [
  /https?:\/\/[^\s)\]]+/gi,
  /\b(?:19|20)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+\-]\d{2}:\d{2})?\b/gi,
  /\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g,
  /\b\d{1,2}[-/]\d{1,2}[-/](?:19|20)\d{2}\b/g,
  new RegExp(
    String.raw`\b(?:\d{1,2}(?:st|nd|rd|th)?[ \t]+${MONTH}\.?|${MONTH}\.?[ \t]+\d{1,2}(?:st|nd|rd|th)?)(?:,?[ \t]+(?:19|20)\d{2})?\b`,
    "gi",
  ),
  new RegExp(String.raw`\b${MONTH}\s+(?:19|20)\d{2}\b`, "gi"),
  /\b(?:sections?|articles?|chapters?|clauses?|paragraphs?|pages?|figures?|tables?|appendices|appendix|parts?|schedules?|steps?|items?)\s+(?:no\.?[ \t]*)?\d+(?:\.\d+)*(?:(?:[ \t]*(?:-|to|through|of|,|and)[ \t]*)\d+(?:\.\d+)*)*\b/gi,
  /\b(?:p{1,2}|fig|tbl)\.?[ \t]+\d+(?:\.\d+)*(?:(?:[ \t]*(?:-|to|through)[ \t]*)\d+(?:\.\d+)*)*\b/gi,
  /\b\d{1,2}:\d{2}(?:[ \t]*(?:a\.?m\.?|p\.?m\.?|UTC|GMT|GST))\b/gi,
  /\[\d+(?:\s*[-,]\s*\d+)*\]/g,
  /(?:^|\n)\s*(?:\(\d+\)|\d+[.)])(?=\s)/g,
];

const PERIOD_POINT = String.raw`(?:[HQ][1-4](?:[ \t]+(?:19|20)\d{2})?)`;
const PERIOD_SPAN_RE = new RegExp(
  String.raw`\b${PERIOD_POINT}(?:[ \t]*(?:\/|&|,|-|\band\b|\bto\b)[ \t]*${PERIOD_POINT})*${HEAD_PHRASE}`,
  "gi",
);
// DLD's literal platform name is a numeric identifier, not a quantity. It is
// still evidence-bound, and the deliberately exact span cannot absorb nearby
// prose or create a general product-number exemption.
const PROJECT_360_IDENTIFIER_RE = /\bProject[ \t]+360\b/g;
const LABELLED_DIGIT_RE = new RegExp(
  String.raw`(?<![-A-Za-z0-9])(?:phase|stage|tranche|plot|unit|tower|building|release|version)[ \t]+(?:no\.?[ \t]*)?${UNSIGNED_NUM}${HEAD_PHRASE}`,
  "gi",
);
const RATIO_OR_FRACTION =
  String.raw`${SIGNED_NUM}[ \t]*(?::|\/|\bin\b)[ \t]*${UNSIGNED_NUM}`;
const VALUE_CORE = String.raw`(?:${RATIO_OR_FRACTION}|${SIGNED_NUM})`;
const CURRENCY_PREFIX = String.raw`(?:[+\-][ \t]*(?=${CUR}[ \t]*))?(?:${CUR}[ \t]*)?`;
const VALUE_ENDPOINT = String.raw`${CURRENCY_PREFIX}${SIGNED_NUM}(?:[ \t]*${SCALE})?(?:[ \t]*${UNIT})?`;
const FULL_RANGE_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9.])${VALUE_ENDPOINT}(?:-|[ \t]+\bto\b[ \t]+)${VALUE_ENDPOINT}${HEAD_PHRASE}(?![A-Za-z0-9])`,
  "gi",
);
const GENERAL_DIGIT_SPAN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9.])${CURRENCY_PREFIX}${VALUE_CORE}(?:[ \t]*${SCALE})?(?:[ \t]*${UNIT})?(?:-${HEAD_WORD})?${HEAD_PHRASE}(?![A-Za-z0-9])`,
  "gi",
);

function maskPattern(value: string, pattern: RegExp): string {
  return value.replace(pattern, (match) => " ".repeat(match.length));
}

function claimBearingNumericText(value: string): string {
  return EXCLUDED_DIGIT_PATTERNS.reduce(
    (text, pattern) => maskPattern(text, pattern),
    normalizeNumericDashes(value),
  );
}

type NumericSpanKind = "identifier" | "period" | "label" | "range" | "value";

interface NumericSpan {
  start: number;
  end: number;
  kind: NumericSpanKind;
  figure: string;
  canonical: string;
}

interface NumericAnalysis {
  normalizedSource: string;
  spans: NumericSpan[];
  uncoveredDigitIndices: number[];
}

const NUMERIC_SPAN_PATTERNS: ReadonlyArray<{
  kind: NumericSpanKind;
  pattern: RegExp;
}> = [
  { kind: "identifier", pattern: PROJECT_360_IDENTIFIER_RE },
  { kind: "period", pattern: PERIOD_SPAN_RE },
  { kind: "label", pattern: LABELLED_DIGIT_RE },
  { kind: "range", pattern: FULL_RANGE_RE },
  { kind: "value", pattern: GENERAL_DIGIT_SPAN_RE },
];

function analyzeNumericSpans(value: string): NumericAnalysis {
  const normalizedSource = normalizeNumericDashes(value);
  const parseText = claimBearingNumericText(normalizedSource);
  const covered = new Uint8Array(parseText.length);
  const spans: NumericSpan[] = [];

  for (const { kind, pattern } of NUMERIC_SPAN_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(parseText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (!/\d/.test(match[0]) || covered.slice(start, end).some(Boolean)) {
        continue;
      }
      covered.fill(1, start, end);
      const figure = norm(match[0]);
      spans.push({
        start,
        end,
        kind,
        figure,
        canonical: normNumericEvidence(match[0]),
      });
    }
  }

  const uncoveredDigitIndices: number[] = [];
  for (const match of parseText.matchAll(/\d/g)) {
    const index = match.index ?? 0;
    if (!covered[index]) uncoveredDigitIndices.push(index);
  }
  spans.sort((left, right) => left.start - right.start || left.end - right.end);
  return { normalizedSource, spans, uncoveredDigitIndices };
}

function numericTupleKey(span: NumericSpan): string {
  return `${span.kind}\u0000${span.canonical}`;
}

/** Every remaining digit-bearing span is evidence-bound after explicit safe
 * exclusions for URLs, ordinary calendar dates and navigation labels. Ordered
 * matching preserves periods, ratios, ranges, signs and noun/unit context. */
export function extractFigures(value: string): string[] {
  return [...new Set(analyzeNumericSpans(value).spans.map((span) => span.figure))];
}

export function bodyHasStatSignal(value: string): boolean {
  return extractFigures(value).length > 0 || findUnconsumedDigitContexts(value).length > 0;
}

/** Anything left is intentionally not guessed at. Its bounded context is
 * surfaced to the reviewer and makes the publication gate fail closed. */
export function findUnconsumedDigitContexts(
  value: string | string[],
): string[] {
  const values = Array.isArray(value) ? value : [value];
  const out = new Set<string>();
  for (const item of values) {
    const analysis = analyzeNumericSpans(item);
    for (const index of analysis.uncoveredDigitIndices) {
      const context = norm(
        analysis.normalizedSource.slice(Math.max(0, index - 24), index + 25),
      );
      if (context) out.add(context);
    }
  }
  return [...out];
}

export function findUnsupportedFigures(
  body: string | string[],
  evidenceText: string | string[],
): string[] {
  const claimTexts = Array.isArray(body) ? body : [body];
  const evidenceTexts = Array.isArray(evidenceText)
    ? evidenceText
    : [evidenceText];
  const sourceFigures = new Set(
    evidenceTexts.flatMap((text) =>
      analyzeNumericSpans(text).spans.map(numericTupleKey),
    ),
  );
  return [
    ...new Set(
      claimTexts
        .flatMap((text) => analyzeNumericSpans(text).spans)
        .filter((span) => !sourceFigures.has(numericTupleKey(span)))
        .map((span) => span.figure),
    ),
  ];
}

const NUMERIC_CORE_PATTERNS: Record<NumericSpanKind, RegExp> = {
  identifier: /^Project[ \t]+360\b/,
  period: new RegExp(
    String.raw`^${PERIOD_POINT}(?:[ \t]*(?:\/|&|,|-|\band\b|\bto\b)[ \t]*${PERIOD_POINT})*`,
    "i",
  ),
  label: new RegExp(
    String.raw`^(?:phase|stage|tranche|plot|unit|tower|building|release|version)[ \t]+(?:no\.?[ \t]*)?${UNSIGNED_NUM}`,
    "i",
  ),
  range: new RegExp(
    String.raw`^${VALUE_ENDPOINT}(?:-|[ \t]+\bto\b[ \t]+)${VALUE_ENDPOINT}`,
    "i",
  ),
  value: new RegExp(
    String.raw`^${CURRENCY_PREFIX}${VALUE_CORE}(?:[ \t]*${SCALE})?(?:[ \t]*${UNIT})?(?:-${HEAD_WORD})?`,
    "i",
  ),
};

const GENERIC_NUMERIC_CONTEXT_WORDS = new Set([
  "about",
  "almost",
  "amount",
  "amounts",
  "approximately",
  "around",
  "combined",
  "current",
  "currently",
  "exact",
  "existing",
  "figure",
  "figures",
  "future",
  "latest",
  "metric",
  "metrics",
  "more",
  "nearly",
  "new",
  "number",
  "numbers",
  "official",
  "only",
  "overall",
  "planned",
  "proposed",
  "reported",
  "requirement",
  "requirements",
  "roughly",
  "same",
  "total",
  "value",
  "values",
  "verified",
]);

function numericCoreAndContext(span: NumericSpan, source: string): {
  core: string;
  context: Set<string>;
} | null {
  const raw = normalizeNumericDashes(source.slice(span.start, span.end));
  const coreMatch = raw.match(NUMERIC_CORE_PATTERNS[span.kind]);
  if (!coreMatch?.[0]) return null;
  const context = new Set(
    (raw.slice(coreMatch[0].length).match(/[A-Za-z][A-Za-z'\u2019-]*/gu) ?? [])
      .flatMap((word) => word.toLowerCase().split(/[-'\u2019]+/u))
      .filter(
        (word) =>
          word.length >= 3 && !GENERIC_NUMERIC_CONTEXT_WORDS.has(word),
      ),
  );
  return { core: normNumericEvidence(coreMatch[0]), context };
}

/**
 * Repair an over-short or slightly malformed model numeric phrase only by
 * copying one complete phrase from one fetched source. This is deliberately a
 * pre-review canonicalizer: it does not alter figure extraction or any
 * approval gate, and ambiguity leaves the model text untouched.
 */
export function canonicalizeEvidenceNumericPhrases(
  value: string,
  evidenceText: string | string[],
): string {
  const evidenceTexts = Array.isArray(evidenceText)
    ? evidenceText
    : [evidenceText];
  const evidenceAnalyses = evidenceTexts.map((text) => ({
    text,
    analysis: analyzeNumericSpans(text),
  }));
  const supportedTuples = new Set(
    evidenceAnalyses.flatMap(({ analysis }) =>
      analysis.spans.map(numericTupleKey),
    ),
  );
  const modelAnalysis = analyzeNumericSpans(value);
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (const span of modelAnalysis.spans) {
    if (supportedTuples.has(numericTupleKey(span))) continue;
    const modelParts = numericCoreAndContext(span, value);
    if (!modelParts || modelParts.context.size === 0) continue;

    const candidates = new Map<
      string,
      { replacement: string; overlap: number }
    >();
    for (const { text, analysis } of evidenceAnalyses) {
      for (const candidate of analysis.spans) {
        if (candidate.kind !== span.kind) continue;
        const candidateParts = numericCoreAndContext(candidate, text);
        if (!candidateParts || candidateParts.core !== modelParts.core) continue;
        const overlap = [...modelParts.context].filter((word) =>
          candidateParts.context.has(word),
        ).length;
        if (overlap === 0) continue;
        const key = numericTupleKey(candidate);
        if (!candidates.has(key)) {
          candidates.set(key, {
            replacement: text.slice(candidate.start, candidate.end),
            overlap,
          });
        }
      }
    }

    const ranked = [...candidates.values()].sort(
      (left, right) => right.overlap - left.overlap,
    );
    if (
      ranked.length === 0 ||
      (ranked[1] && ranked[1].overlap === ranked[0].overlap)
    ) {
      continue;
    }
    replacements.push({
      start: span.start,
      end: span.end,
      value: ranked[0].replacement,
    });
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (text, replacement) =>
        `${text.slice(0, replacement.start)}${replacement.value}${text.slice(replacement.end)}`,
      value,
    );
}

export function assessDraft(
  draft: Pick<NewsDraft, "id" | "article" | "validator" | "provenance"> &
    Partial<Pick<NewsDraft, "contentHash" | "createdAt">>,
  opts: { autoPublicationAt?: Date } = {},
): AutoApproveAssessment {
  const reasons: string[] = [];
  const { article, validator, provenance } = draft;
  const reportingBasisShape = validateArticleReportingBasis(article);
  if (!reportingBasisShape.ok) reasons.push(reportingBasisShape.error);
  if (article.format === "short-update" && article.semaform !== undefined) {
    reasons.push("short-update format cannot contain analytical or trade sections");
  }

  const quarantine = findNewsDraftQuarantine(draft);
  if (quarantine) {
    reasons.push(
      `editorial quarantine ${quarantine.ruleId}: ${quarantine.reason}`,
    );
  }

  // 1 · the 8 gates
  const ctaValidation = validateCtaLabel(article.cta?.label, article.market);
  const gatesOk = validator.ok && ctaValidation.ok;
  if (!gatesOk) {
    const blocked = [
      ...validator.failures
        .filter((f) => f.severity === "block")
        .map((f) => f.name),
      ...(ctaValidation.ok
        ? []
        : [
            `CTA voice and safety (${[
              ...ctaValidation.bannedHits.map((hit) => `banned term: ${hit}`),
              ...ctaValidation.forbiddenReasons,
            ].join(", ")})`,
          ]),
    ].join(", ");
    reasons.push(`fails gates: ${blocked || "unknown"}`);
  }

  if (opts.autoPublicationAt) {
    const recency = assessAutoPublicationRecency(draft, opts.autoPublicationAt);
    reasons.push(
      ...recency.reasons.map(
        (reason) => `auto-publication freshness failed: ${reason}`,
      ),
    );
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
    fetchedEvidence,
  );
  if (article.reportingBasis !== undefined && policy.lane !== "attributed-announcement") {
    reasons.push(`attributed announcement basis failed: ${policy.reason}`);
  }

  // 2 · citations — all whitelisted, from two canonical publishers
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
  const claimTexts = articleEvidenceSegments(article).map(
    (segment) => segment.text,
  );
  const claimSupport = assessArticleClaimSupport(article, fetchedEvidence);
  if (claimSupport.failures.length > 0) {
    reasons.push(
      `${claimSupport.failures.length} factual/editorial clause(s) are not anchor-supported: ${claimSupport.failures
        .slice(0, 6)
        .map(
          (failure) =>
            `${failure.field} [${failure.code}] ${failure.detail}: ${failure.clause}`,
        )
        .join(" · ")}`,
    );
  }
  if (
    article.format === "short-update" &&
    claimSupport.supported.some((claim) => claim.editorial)
  ) {
    reasons.push("short-update format permits source-supported facts only, not editorial interpretation");
  }
  if (claimSupport.unusedEvidenceUrls.length > 0) {
    reasons.push(
      `${claimSupport.unusedEvidenceUrls.length} cited fetched-evidence source(s) support no factual clause: ${claimSupport.unusedEvidenceUrls
        .slice(0, 5)
        .join(" · ")}`,
    );
  }
  const figures = [
    ...new Set(claimTexts.flatMap((text) => extractFigures(text))),
  ];
  let amberFigures: string[];
  if (sourceTexts.length === 0 || sourceTexts.every((text) => !text.trim())) {
    amberFigures = figures;
    reasons.push(
      "no independently fetched source text on the draft — model citation markup cannot verify figures",
    );
  } else {
    amberFigures = findUnsupportedFigures(claimTexts, sourceTexts);
    if (amberFigures.length > 0) {
      reasons.push(
        `${amberFigures.length} unsourced figure(s): ${amberFigures
          .slice(0, 8)
          .join(" · ")}`,
      );
    }
  }

  // 5 · safety guard across every publishable field. A supported figure can
  // never conceal a second digit-bearing span the parser did not consume.
  const unconsumedDigitContexts = findUnconsumedDigitContexts(claimTexts);
  if (unconsumedDigitContexts.length > 0) {
    reasons.push(
      `article fields contain ${unconsumedDigitContexts.length} digit-bearing span(s) the figure parser did not capture: ${unconsumedDigitContexts.slice(0, 4).join("; ")}`,
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
    claimSupportCheckedClauseCount: claimSupport.checkedClauseCount,
    unsupportedClaimCount: claimSupport.failures.length,
    unusedEvidenceCount: claimSupport.unusedEvidenceUrls.length,
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
  publicationShas: string[];
  publishedSlugs: string[];
  deploymentVerified: number;
  pendingVerification: number;
  verificationSkipped: number;
  postPublishCompleted: number;
  postPublishPending: number;
  postPublishFailed: number;
  failureMessages: string[];
  /** Bounded, stable categories suitable for workflow alerts and dashboards. */
  holdReasonCounts: Record<string, number>;
  /** First held records only; the full draft content never enters CI logs. */
  heldDetails: Array<{ slug: string; reasons: string[] }>;
}

function holdReasonCategory(reason: string): string {
  if (/media approval|approved image|daily media|media ledger|photo context/iu.test(reason)) return "media-approval";
  if (/editorial quarantine/iu.test(reason)) return "editorial-quarantine";
  if (/fails gates/iu.test(reason)) return "voice-or-structure-gate";
  if (/freshness|publication date|timestamp|date-source/iu.test(reason)) {
    return "source-date-or-freshness";
  }
  if (/publisher identity|approved source|authoritative/iu.test(reason)) {
    return "publisher-identity";
  }
  if (/whitelist/iu.test(reason)) return "source-whitelist";
  if (/publisher domain|citation\(s\).*need|two independent/iu.test(reason)) {
    return "insufficient-independent-publishers";
  }
  if (/fetched source text|independently fetched evidence/iu.test(reason)) {
    return "missing-fetched-evidence";
  }
  if (/unsourced figure/iu.test(reason)) return "unsupported-figure";
  if (/digit-bearing span|figure parser/iu.test(reason)) {
    return "unparsed-numeric-claim";
  }
  if (/not anchor-supported/iu.test(reason)) return "unsupported-factual-claim";
  if (/support no factual clause/iu.test(reason)) return "unused-cited-evidence";
  if (/not explicitly attributed/iu.test(reason)) {
    return "official-attribution";
  }
  return "other";
}

export function summarizeHoldReasons(
  assessments: AutoApproveAssessment[],
): Record<string, number> {
  const counts = new Map<string, number>();
  for (const assessment of assessments) {
    for (const category of new Set(assessment.reasons.map(holdReasonCategory))) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    [...counts.entries()].sort(
      ([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount || leftName.localeCompare(rightName),
    ),
  );
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export interface AutoApproveDraftTarget {
  id: string;
  contentHash: string;
}

const DRAFT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CONTENT_HASH_RE = /^[a-f0-9]{64}$/u;

/** New publications always need an immutable image approval. Existing manual
 * images keep their own approval; catalogue images also need the exact receipt. */
export function assertNewPublicationMediaApproval(draft: NewsDraft): void {
  const approval = draft.mediaApproval;
  if (!approval) {
    throw new DailyMediaReuseError("An approved image is required before publication.", 422);
  }
  const { hash, ...record } = approval;
  if (approval.slug !== draft.article.slug ||
    approval.revision !== draft.revision || approval.contentHash !== draft.contentHash ||
    draftContentHash(draft.article, draft.provenance) !== draft.contentHash ||
    mediaApprovalHash(record) !== hash ||
    !Number.isFinite(Date.parse(approval.approvedAt)) ||
    !CONTENT_HASH_RE.test(approval.contentSha256) ||
    !["jpg", "jpeg", "png", "webp"].some((extension) => approval.repoPath === `public/news/${draft.article.slug}/cover.${extension}`) ||
    !Number.isSafeInteger(approval.width) || !Number.isSafeInteger(approval.height) ||
    approval.width < 3840 || approval.height < 2160 ||
    !approval.credit?.trim() || !approval.sourceUrl?.trim() || !approval.rightsStatus?.trim() ||
    !["raj-review-session", "owner-approved-stock-reuse", "approved-open-stock-reuse"].includes(approval.reviewer)) {
    throw new DailyMediaReuseError("The image media approval ledger is missing, changed or stale.");
  }
  assertRequiredCuratedMediaApproval(draft);
  if (hasApprovedDailyMediaContext(draft.article) ||
    ((approval.reuseReceipt || approval.reviewer !== "raj-review-session") && !hasApprovedCuratedMediaContext(draft.article))) {
    assertRequiredDailyMediaApproval(draft);
  }
}

/** Select the publication set before assessment. A targeted run is bound to
 * both immutable identifiers and can never fall through to another draft. */
export function selectAutoApproveEligibleDrafts(
  activeDrafts: NewsDraft[],
  opts: {
    target?: AutoApproveDraftTarget;
    publishOrder?: "newest" | "backlog";
    backlogMinAgeHours?: number;
    backlogMaxAgeDays?: number;
    /** Automated morning lane only: publish drafts carrying this exact Dubai
     * calendar date. Omitted for curated/manual reconciliation. */
    requiredPublishedDubaiDate?: string;
    now?: Date;
  } = {},
): NewsDraft[] {
  let candidates = [...activeDrafts];
  if (opts.target) {
    if (
      !DRAFT_ID_RE.test(opts.target.id) ||
      !CONTENT_HASH_RE.test(opts.target.contentHash)
    ) {
      throw new Error("The targeted draft ID or content hash is invalid.");
    }
    const matched = candidates.find((draft) => draft.id === opts.target?.id);
    if (!matched) {
      throw new Error("The targeted draft is absent or no longer active.");
    }
    if (matched.contentHash !== opts.target.contentHash) {
      throw new Error("The targeted draft content hash no longer matches.");
    }
    candidates = [matched];
  }

  if (opts.requiredPublishedDubaiDate !== undefined) {
    const requiredDate = opts.requiredPublishedDubaiDate;
    const parsedRequiredDate = /^\d{4}-\d{2}-\d{2}$/u.test(requiredDate)
      ? new Date(`${requiredDate}T00:00:00.000Z`)
      : new Date(Number.NaN);
    if (
      !Number.isFinite(parsedRequiredDate.getTime()) ||
      parsedRequiredDate.toISOString().slice(0, 10) !== requiredDate
    ) {
      throw new Error(
        "The required published Dubai date must be an exact YYYY-MM-DD calendar date.",
      );
    }
    candidates = candidates.filter((draft) => {
      try {
        return dubaiCalendarDate(draft.article.publishedAt) === requiredDate;
      } catch {
        return false;
      }
    });
  }

  const publishOrder = opts.publishOrder ?? "newest";
  const now = (opts.now ?? new Date()).getTime();
  const backlogMinAgeMs =
    Math.max(0, opts.backlogMinAgeHours ?? 12) * 60 * 60 * 1_000;
  const backlogMaxAgeMs =
    Math.max(1, opts.backlogMaxAgeDays ?? 21) * 24 * 60 * 60 * 1_000;
  return candidates
    .filter((draft) => {
      if (publishOrder !== "backlog") return true;
      const publishedAt = Date.parse(draft.article.publishedAt);
      if (!Number.isFinite(publishedAt)) return false;
      const age = now - publishedAt;
      return age >= backlogMinAgeMs && age <= backlogMaxAgeMs;
    })
    .sort((left, right) => {
      if (publishOrder === "backlog") {
        const scoreDifference =
          right.provenance.score - left.provenance.score;
        if (scoreDifference !== 0) return scoreDifference;
      }
      return right.article.publishedAt.localeCompare(left.article.publishedAt);
    });
}

/** Assess The Desk and, when explicitly enabled, publish a bounded batch. */
export async function runAutoApprove(opts: {
  site: string;
  secret: string;
  publish: boolean;
  publishLimit?: number;
  publishOrder?: "newest" | "backlog";
  backlogMinAgeHours?: number;
  backlogMaxAgeDays?: number;
  /** Restricts unattended publication to drafts published on one exact Dubai
   * calendar date. Curated/manual callers remain unchanged when omitted. */
  requiredPublishedDubaiDate?: string;
  /** Marks the bounded scheduled/watchdog lane so the publish endpoint can
   * atomically enforce one automated publication for the Dubai day. */
  automatedMorningLane?: boolean;
  /** Optional immutable target for a curated publication run. Both values are
   * required together; a mismatch fails instead of selecting another draft. */
  targetDraftId?: string;
  targetContentHash?: string;
  now?: Date;
  deploymentAttempts?: number;
  /** Test/worker override; production defaults to the 15-second poll cadence. */
  deploymentDelayMs?: number;
  log?: (msg: string) => void;
}): Promise<AutoApproveSummary> {
  if (
    opts.automatedMorningLane === true &&
    opts.requiredPublishedDubaiDate === undefined
  ) {
    throw new Error(
      "The automated morning lane requires an exact published Dubai date.",
    );
  }
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
  const targetConfigured =
    opts.targetDraftId !== undefined || opts.targetContentHash !== undefined;
  if (
    targetConfigured &&
    (opts.targetDraftId === undefined || opts.targetContentHash === undefined)
  ) {
    throw new Error(
      "Targeted publication requires both draft ID and content hash.",
    );
  }
  const eligibleDrafts = selectAutoApproveEligibleDrafts(activeDrafts, {
    target:
      opts.targetDraftId !== undefined && opts.targetContentHash !== undefined
        ? { id: opts.targetDraftId, contentHash: opts.targetContentHash }
        : undefined,
    publishOrder,
    backlogMinAgeHours: opts.backlogMinAgeHours,
    backlogMaxAgeDays: opts.backlogMaxAgeDays,
    requiredPublishedDubaiDate: opts.requiredPublishedDubaiDate,
    now: opts.now,
  });
  const autoPublicationAt = opts.now ?? new Date();
  const assessments = eligibleDrafts.map((draft) =>
    assessDraft(draft, { autoPublicationAt }),
  );
  const approve = assessments.filter((a) => a.verdict === "auto-approve");
  const held = assessments.filter((a) => a.verdict === "manual");
  const publishLimit = Math.max(1, Math.min(10, opts.publishLimit ?? 1));
  const selected: AutoApproveAssessment[] = [];
  const selectedDrafts = new Map<string, NewsDraft>();
  const mediaHeldIds = new Set<string>();
  let mediaPreparations = 0;
  if (opts.publish) {
    for (const assessment of approve) {
      if (selected.length >= publishLimit) break;
      let candidate = eligibleDrafts.find((draft) => draft.id === assessment.id)!;
      try {
        if (candidate.correctionOf || candidate.article.correction) {
          throw new DailyMediaReuseError("Historical corrections require the dedicated correction workflow, not daily automatic publication.", 422);
        }
        if (!candidate.mediaApproval) {
          if (!hasApprovedDailyMediaContext(candidate.article)) {
            throw new DailyMediaReuseError("An approved image is required; this draft has no approved daily photo context.", 422);
          }
          if (!DRAFT_ID_RE.test(candidate.id)) {
            throw new DailyMediaReuseError("Daily media approval requires an exact draft lookup ID.", 422);
          }
          // Bound both writes and publication. A failed image preparation does
          // not consume a publication slot or cause the whole backlog to write.
          if (mediaPreparations >= publishLimit) continue;
          mediaPreparations += 1;
          await ensureDailyMediaApproval(candidate, async (pathname, body) => {
            const response = await fetch(`${base}${pathname}`, {
              method: "POST",
              headers: { ...authHeaders, "content-type": "application/json" },
              body: JSON.stringify(body),
            });
            const payload = (await response.json().catch(() => ({}))) as DailyMediaReuseResponse;
            return { response, payload };
          });
          const refreshedResponse = await fetch(`${base}/api/news/draft?id=${encodeURIComponent(candidate.id)}`, {
            headers: authHeaders,
            cache: "no-store",
          });
          const refreshedPayload = (await refreshedResponse.json().catch(() => ({}))) as { ok?: boolean; draft?: NewsDraft };
          const refreshed = refreshedPayload.draft;
          if (!refreshedResponse.ok || refreshedPayload.ok !== true || !refreshed ||
            refreshed.id !== candidate.id || refreshed.revision !== candidate.revision ||
            refreshed.contentHash !== candidate.contentHash || refreshed.publication ||
            refreshed.recordVersion !== candidate.recordVersion + 1) {
            throw new DailyMediaReuseError("The draft changed while preparing its media approval; reload before publication.");
          }
          candidate = refreshed;
          const refreshedAssessment = assessDraft(candidate, { autoPublicationAt });
          if (refreshedAssessment.verdict !== "auto-approve") {
            throw new DailyMediaReuseError(`Publication held after media approval: ${refreshedAssessment.reasons.join("; ")}`, 422);
          }
        }
        assertNewPublicationMediaApproval(candidate);
        selected.push(assessment);
        selectedDrafts.set(assessment.id, candidate);
      } catch (error) {
        mediaHeldIds.add(assessment.id);
        held.push({ ...assessment, verdict: "manual", reasons: [`Media approval: ${error instanceof Error ? error.message : "failed closed"}`] });
      }
    }
  }
  const approvedCount = approve.length - mediaHeldIds.size;
  const holdReasonCounts = summarizeHoldReasons(held);
  const deferred = opts.publish ? Math.max(0, approvedCount - selected.length) : 0;

  if (publishOrder === "backlog") {
    log(
      `backlog window: ${eligibleDrafts.length}/${activeDrafts.length} active draft(s) are ${opts.backlogMinAgeHours ?? 12}h-${opts.backlogMaxAgeDays ?? 21}d old`,
    );
  }

  log(
    `auto-approve: ${activeDrafts.length} active draft(s) · ${approvedCount} pass · ${held.length} held · ` +
      `mode ${opts.publish ? `PUBLISH (${publishOrder}, limit ${publishLimit})` : "REVIEW ONLY"} ` +
      `(risk-based official-fact/corroborated-analysis policy)`,
  );
  for (const a of approve) {
    if (mediaHeldIds.has(a.id)) continue;
    log(`  ok  ${a.slug}  (${a.evidenceLane} · ${a.figureCount} figs · ${a.whitelistCount}/${a.citationCount} cites)`);
  }
  for (const a of held.slice(0, 20)) {
    log(`  hold ${a.slug} -> ${a.reasons.join("; ")}`);
  }
  if (held.length > 20) {
    log(`  hold … ${held.length - 20} additional held draft(s); categories ${JSON.stringify(holdReasonCounts)}`);
  }

  let published = 0;
  let failed = 0;
  let deploymentVerified = 0;
  let pendingVerification = 0;
  let verificationSkipped = 0;
  let postPublishCompleted = 0;
  let postPublishPending = 0;
  let postPublishFailed = 0;
  const publicationShas: string[] = [];
  const publishedSlugs: string[] = [];
  const failureMessages: string[] = [];
  for (const assessment of selected) {
    const selectedDraft = selectedDrafts.get(assessment.id)!;
    const exactDraft = {
      expectedRevision: selectedDraft.revision,
      expectedRecordVersion: selectedDraft.recordVersion,
      expectedContentHash: selectedDraft.contentHash,
    };
    let response: Response;
    try {
      response = await fetch(
        `${base}/api/news/draft/${encodeURIComponent(assessment.id)}/publish`,
        {
          method: "POST",
          headers: {
            ...authHeaders,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            opts.automatedMorningLane === true
              ? {
                  ...exactDraft,
                  automatedMorningLane: true,
                  requiredPublishedDubaiDate:
                    opts.requiredPublishedDubaiDate,
                }
              : exactDraft,
          ),
        },
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "publish request failed";
      failed += 1;
      failureMessages.push(`${assessment.slug}: ${detail}`);
      log(`  fail ${assessment.slug} -> ${detail}`);
      continue;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      diagnostic?: {
        code?: string;
        stage?: string;
        operatorAction?: string;
      };
      claimId?: string;
      commitSha?: string;
      idempotent?: boolean;
    };
    if (!response.ok || !payload.commitSha || !payload.claimId) {
      const detail = [
        payload.error ?? `publish returned ${response.status}`,
        payload.diagnostic?.code,
        payload.diagnostic?.stage,
        payload.diagnostic?.operatorAction,
      ]
        .filter(Boolean)
        .join(" · ");
      failed += 1;
      failureMessages.push(`${assessment.slug}: ${detail}`);
      log(`  fail ${assessment.slug} -> ${detail}`);
      continue;
    }
    published += 1;
    publicationShas.push(payload.commitSha);
    publishedSlugs.push(assessment.slug);
    log(
      `  live ${assessment.slug} -> commit ${payload.commitSha.slice(0, 8)}${payload.idempotent ? " (idempotent)" : ""}`,
    );

    // Finalise the durable queue receipt only after the canonical page proves
    // that the exact reviewed content is serving. A timeout leaves the commit
    // safely pending for a later verifier; it does not create a second commit.
    const attempts = Math.max(0, Math.min(20, opts.deploymentAttempts ?? 12));
    if (attempts === 0) {
      verificationSkipped += 1;
      continue;
    }
    let verified = false;
    let lastDeploymentError = "deployment verification timed out";
    const deploymentDelayMs = Math.max(
      0,
      Math.min(60_000, opts.deploymentDelayMs ?? 15_000),
    );
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await wait(deploymentDelayMs);
      try {
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
        const detail = (await deployed.json().catch(() => ({}))) as {
          error?: string;
          publicationState?: string;
          postPublish?: {
            ok?: boolean;
            pending?: boolean;
            code?: string;
            indexing?: { status?: string } | null;
            distribution?: { status?: string } | null;
            operatorAction?: string | null;
          };
        };
        if (deployed.ok || detail.publicationState === "completed") {
          verified = true;
          deploymentVerified += 1;
          log(`  verified ${assessment.slug} on the canonical newsroom`);
          if (detail.postPublish?.ok === true) {
            postPublishCompleted += 1;
          } else {
            const pending = detail.postPublish?.pending === true;
            if (pending) postPublishPending += 1;
            else postPublishFailed += 1;
            failed += 1;
            const downstreamDetail = [
              detail.postPublish?.code ?? "post-publish-receipt-missing",
              detail.postPublish?.indexing?.status
                ? `indexing=${detail.postPublish.indexing.status}`
                : null,
              detail.postPublish?.distribution?.status
                ? `distribution=${detail.postPublish.distribution.status}`
                : null,
              detail.postPublish?.operatorAction,
            ]
              .filter(Boolean)
              .join(" · ");
            failureMessages.push(
              `${assessment.slug}: downstream ${downstreamDetail}`,
            );
            log(
              `  ${pending ? "pending" : "fail"} ${assessment.slug} downstream -> ${downstreamDetail}`,
            );
          }
          break;
        }
        lastDeploymentError =
          detail.error ?? `deployment verification returned ${deployed.status}`;
      } catch (error) {
        lastDeploymentError =
          error instanceof Error
            ? error.message
            : "deployment verification request failed";
      }
    }
    if (!verified) {
      pendingVerification += 1;
      failed += 1;
      failureMessages.push(
        `${assessment.slug}: ${lastDeploymentError}`,
      );
      log(`  pending ${assessment.slug} -> ${lastDeploymentError}`);
    }
  }
  return {
    total: activeDrafts.length,
    eligible: eligibleDrafts.length,
    approved: approvedCount,
    published,
    failed,
    held: held.length,
    deferred,
    publicationShas,
    publishedSlugs,
    deploymentVerified,
    pendingVerification,
    verificationSkipped,
    postPublishCompleted,
    postPublishPending,
    postPublishFailed,
    failureMessages,
    holdReasonCounts,
    heldDetails: held.slice(0, 20).map((assessment) => ({
      slug: assessment.slug,
      reasons: assessment.reasons.slice(0, 8),
    })),
  };
}
