/**
 * Deterministic, deliberately conservative clause-to-source alignment.
 *
 * This is not an entailment engine and never describes its verdict as one.
 * It proves only that each reader-visible factual clause has a bounded source
 * window carrying the same material fact signature: publisher/entity binding,
 * numbers and dates, polarity, modality, direction, comparator, predicate and
 * at least two distinctive object/noun anchors.
 */

export interface ClaimSupportSegment {
  field: string;
  text: string;
}

export interface ClaimSupportEvidence {
  url: string;
  text: string;
  /** Registry-owned canonical publisher name. */
  publisher: string;
  /** Registry-owned canonical parent publisher domain. */
  publisherDomain?: string;
  /** Registry-owned aliases, including a canonical initialism where valid. */
  publisherAliases?: readonly string[];
}

export type ClaimSupportFailureCode =
  | "unsupported"
  | "ambiguous-pronoun"
  | "negative-absence"
  | "mixed-signature"
  | "source-copying"
  | "trade-call"
  | "editorial-overreach";

export interface ClaimSupportFailure {
  field: string;
  clause: string;
  code: ClaimSupportFailureCode;
  detail: string;
}

export interface AnchorSupportedClaim {
  field: string;
  clause: string;
  evidenceUrls: string[];
  /** Always `anchor-supported`; callers must not relabel this as entailed. */
  verdict: "anchor-supported";
  editorial: boolean;
}

export interface ClaimSupportAssessment {
  ok: boolean;
  verdict: "anchor-supported" | "manual";
  checkedClauseCount: number;
  supported: AnchorSupportedClaim[];
  failures: ClaimSupportFailure[];
  unusedEvidenceUrls: string[];
}

/** A reviewed claim of speech, never a claim that the announced outcome will occur. */
export interface AnnouncementReportingBasis {
  sourceUrl: string;
  speaker: string;
  organization: string;
  statementKind: "corporate-intent";
}

export interface AttributedAnnouncementInput {
  format?: string;
  category: string;
  reportingBasis?: AnnouncementReportingBasis;
  segments: readonly ClaimSupportSegment[];
  /** Only independently fetched, cited, registry-verified evidence belongs here.
   * The publication caller also verifies freshness and immutable evidence hashes. */
  evidence: readonly ClaimSupportEvidence[];
}

export interface AttributedAnnouncementAssessment {
  ok: boolean;
  reason: string;
  support: ClaimSupportAssessment;
}

interface AtomicClause {
  field: string;
  text: string;
  segmentIndex: number;
  clauseIndex: number;
}

interface SourceWindow {
  evidenceIndex: number;
  url: string;
  publisher: string;
  publisherDomain: string;
  aliases: string[];
  text: string;
  tokens: string[];
  signature: Signature;
  fiveGrams: Set<string>;
  fourteenGrams: Set<string>;
  joinedTokens: string;
}

type ProbabilityQualifier =
  | "none"
  | "possible"
  | "likely"
  | "unlikely"
  | "almost-certain"
  | "certain"
  | "hedged"
  | "impossible";
type ForceQualifier = "none" | "must" | "should";
type ModalityQualifier =
  | "asserted"
  | "possible"
  | "categorical-future"
  | "conditional"
  | "commitment"
  | "forecast"
  | "intent"
  | "readiness"
  | "unresolved";
type QuantityQualifier =
  | "exact"
  | "approximate"
  | "lower-inclusive"
  | "lower-exclusive"
  | "plus-minus"
  | "range"
  | "upper-inclusive"
  | "upper-exclusive";

interface RelationTuple {
  subjectKey: string;
  predicate: string;
  object: Set<string>;
  numbers: Set<string>;
  dates: Set<string>;
  scalarBindings: Set<string>;
  directions: Set<string>;
  comparators: Set<string>;
  comparisonBindings: Set<string>;
  modality: ModalityQualifier;
  probability: ProbabilityQualifier;
  force: ForceQualifier;
  qualifiers: Set<string>;
  quantityBindings: Set<string>;
  rangeBindings: Set<string>;
  quantityAmbiguous: boolean;
  negative: boolean;
}

interface Signature {
  words: string[];
  content: Set<string>;
  entities: Set<string>;
  numbers: Set<string>;
  dates: Set<string>;
  scalarBindings: Set<string>;
  predicates: Set<string>;
  directions: Set<string>;
  comparators: Set<string>;
  comparisonBindings: Set<string>;
  modality: ModalityQualifier;
  probability: ProbabilityQualifier;
  force: ForceQualifier;
  qualifiers: Set<string>;
  quantityBindings: Set<string>;
  rangeBindings: Set<string>;
  quantityAmbiguous: boolean;
  probabilityAmbiguous: boolean;
  modalityAmbiguous: boolean;
  negative: boolean;
  negativeAbsence: boolean;
  attributionPublishers: Set<number>;
  allPublishersAttribution: boolean;
  subject: Set<string>;
  object: Set<string>;
  transitive: boolean;
  relations: RelationTuple[];
  unresolvedPassive: boolean;
}

const MAX_SOURCE_WINDOW_WORDS = 84;
const MAX_EDITORIAL_WORDS = 30;
const MIN_DISTINCTIVE_ANCHORS = 2;
const COPY_MIN_WORDS = 18;
const COPY_CONTIGUOUS_WORDS = 14;
const COPY_FIVE_GRAM_RATIO = 0.72;

const STOP_WORDS = new Set(
  `a an and are as at be because been being both but by can could did do does
  doing during each either for from had has have having he her here hers him
  his how i if in into is it its itself may might more most much must neither
  no nor not of on once only or other our ours out over own same she should so
  some such than that the their theirs them themselves then there these they
  this those through to too under until up very was we were what when where
  which while who whom why will with within without would you your yours
  according also about around across after before between per via said says say
  report reports reported reporting source sources publication publications
  article release released official confirmed confirms confirm stated states
  state told tells tell according data figure figures result results current
  directly evidence latest measured official officially period update updates year years month months day days
  likely unlikely probable probably possible possibly potentially potential
  reportedly allegedly apparently purportedly presumably seemingly appears
  appear appeared seems seem seemed believed thought suggests suggested
  said understood claimed rumoured rumored hopes hope wants want promises promise
  pledges pledge commits commit poised ready track course going bound certain
  aspires aspire prepares prepare looks look agrees agree
  plus minus approximately approximate roughly circa nearly almost estimated minimum maximum`.split(
    /\s+/u,
  ),
);

const EDITORIAL_VOCABULARY = new Set(
  `analysis analytical boundary boundaries category categories context contextual
  definition definitions distinction distinctions evidence figure figures
  framing interpretation interpreted measure measures metric metrics narrow
  reading record records report reports scope scopes separate separately signal
  signals source sources specific specifically useful reader readers question
  questions view views material materially basis baseline baselines conclusion
  conclusions cautious caution discipline disciplined relevant relevance
  remain remains keeping keep treat treated treating avoid avoids conflating
  conflation should`.split(/\s+/u),
);

const FACT_PREDICATES: Record<string, readonly string[]> = {
  acquire: ["acquire", "acquired", "acquires", "buy", "bought", "purchase", "purchased"],
  announce: ["announce", "announced", "announces", "declare", "declared", "declares"],
  appoint: ["appoint", "appointed", "appoints", "name", "named"],
  approve: ["approve", "approved", "approves", "grant", "granted", "grants"],
  award: ["award", "awarded"],
  complete: ["complete", "completed", "completes", "finish", "finished", "delivered", "deliver"],
  contain: ["contain", "contains", "contained", "include", "includes", "included", "cover", "covers", "covered"],
  create: ["create", "created", "creates", "establish", "established", "establishes", "form", "formed"],
  issue: ["issue", "issued", "issues"],
  launch: ["launch", "launched", "launches", "introduce", "introduced", "introduces", "open", "opened", "opens", "unveil", "unveiled", "unveils"],
  cancel: ["cancel", "cancelled", "canceled", "cancels", "scrap", "scrapped", "withdraw", "withdrew", "withdrawn"],
  reach: ["reach", "reached", "reaches", "stand", "stood", "total", "totalled", "totaled"],
  reduce: ["reduce", "reduced", "reduces", "cut", "cuts", "lowered", "lower"],
  rise: ["rise", "rises", "rose", "risen", "increase", "increased", "increases", "grow", "grew", "grown", "climb", "climbed", "gain", "gained", "surge", "surged"],
  fall: ["fall", "falls", "fell", "fallen", "decrease", "decreased", "decreases", "decline", "declined", "declines", "drop", "dropped", "drops", "slip", "slipped", "contract", "contracted"],
  manage: ["manage", "managed", "manages", "oversee", "oversees", "oversaw"],
  operate: ["operate", "operated", "operates"],
  confirm: ["confirm", "confirmed", "confirms", "verify", "verified", "verifies"],
  report: ["report", "reported", "reports", "publish", "published", "publishes"],
  require: ["require", "required", "requires", "mandate", "mandated", "mandates"],
  use: ["use", "used", "uses", "deploy", "deployed", "employ", "employed"],
  show: ["show", "shows", "showed", "indicate", "indicated", "indicates", "record", "recorded", "records", "represent", "represented", "represents"],
  sell: ["sell", "sold", "sells"],
  sign: ["sign", "signed", "signs"],
  state: ["state", "stated", "states", "describe", "described", "describes", "is", "are", "was", "were"],
  value: ["value", "valued", "values", "worth"],
};

const PREDICATE_BY_TOKEN = new Map<string, string>();
for (const [canonical, variants] of Object.entries(FACT_PREDICATES)) {
  for (const variant of variants) PREDICATE_BY_TOKEN.set(variant, canonical);
}

const AMBIGUOUS_NOUN_ANCHORS = new Set([
  "contract",
  "grant",
  "issue",
  "record",
  "report",
  "state",
  "value",
]);

const TRANSITIVE_PREDICATES = new Set([
  "acquire",
  "announce",
  "appoint",
  "approve",
  "award",
  "cancel",
  "confirm",
  "complete",
  "create",
  "issue",
  "launch",
  "manage",
  "operate",
  "report",
  "require",
  "sell",
  "sign",
  "use",
]);

const DIRECTION_BY_TOKEN = new Map<string, string>([
  ...FACT_PREDICATES.rise.map((word) => [word, "up"] as const),
  ...FACT_PREDICATES.fall.map((word) => [word, "down"] as const),
  ["higher", "up"],
  ["above", "up"],
  ["more", "up"],
  ["lower", "down"],
  ["below", "down"],
  ["less", "down"],
  ["unchanged", "flat"],
  ["flat", "flat"],
  ["stable", "flat"],
]);

const COMPARATOR_PATTERNS: Array<[string, RegExp]> = [
  ["yoy", /\b(?:year[- ]on[- ]year|year over year|annual(?:ly)?|from (?:h[12]|q[1-4])\s+\d{4}|against (?:h[12]|q[1-4])\s+\d{4})\b/iu],
  ["qoq", /\b(?:quarter[- ]on[- ]quarter|quarter over quarter|latest (?:three[- ]month|quarter)|previous quarter)\b/iu],
  ["half-on-half", /\b(?:half[- ]on[- ]half|previous half[- ]year|compared with h[12]\s+\d{4}|compared to h[12]\s+\d{4})\b/iu],
  ["from", /\bfrom\s+(?:aed|dh|dhs|usd|us\$|\$)?\s*\d/iu],
  ["to", /\bto\s+(?:aed|dh|dhs|usd|us\$|\$)?\s*\d/iu],
  ["versus", /\b(?:versus|vs\.?|compared (?:with|to)|against)\b/iu],
  ["more-than", /\b(?:more than|over|above|at least)\b/iu],
  ["less-than", /\b(?:less than|under|below|at most)\b/iu],
];

const NEGATIVE_RE = /\b(?:no|not|never|neither|nor|cannot|[a-z]+n't|without|lack(?:s|ed|ing)?|fail(?:s|ed|ing)?\s+to|yet\s+to|unable\s+to|declin(?:e|es|ed|ing)\s+to|refus(?:e|es|ed|ing)\s+to|pending)\b/iu;
const NEGATIVE_ABSENCE_RE =
  /\b(?:does?\s+not|did\s+not|do\s+not|has\s+not|have\s+not|had\s+not|neither|no)\b[\s\S]{0,72}\b(?:provide|report|state|show|announce|describe|include|establish|identify|present|attach|measure|change|remove|alter|guarantee)(?:d|s|ing)?\b|\b(?:without|lacks?)\b[\s\S]{0,48}\b(?:evidence|data|detail|figure|figures|information|support)\b/iu;
const POSSIBLE_PROBABILITY_RE =
  /\b(?:may|might|could|can|possible|possibly|potential(?:ly)?)\b/iu;
const LIKELY_PROBABILITY_RE = /\b(?:likely|probable|probably)\b/iu;
const UNLIKELY_PROBABILITY_RE =
  /\b(?:unlikely|improbable|improbably)\b|\b(?:not|less)\s+likely\b/iu;
const ALMOST_CERTAIN_PROBABILITY_RE = /\balmost\s+certainly\b/iu;
const CERTAIN_PROBABILITY_RE =
  /\b(?:certainly|surely|definitely|inevitably|unavoidably)\b|\b(?:is|are|was|were)\s+(?:bound|certain)\s+to\b/iu;
const HEDGED_PROBABILITY_RE =
  /\b(?:reportedly|allegedly|apparently|purportedly|presumably|seemingly|perhaps|maybe|conceivably|plausibly|ostensibly|supposedly)\b|\b(?:appear|appears|appeared|seem|seems|seemed)\b|\b(?:believed|thought)\b|\b(?:is|are|was|were)\s+(?:said|understood|claimed|rumou?red|alleged|reported|assumed|purported|presumed|estimated)\s+to\b|\bit\s+(?:is|was)\s+(?:alleged|understood|claimed|rumou?red|reported|assumed|purported|presumed|estimated)\b|\bsuggest(?:s|ed|ing)?\b|\b(?:reports?|sources?|analysts?|observers?|estimates?)\s+(?:say|says|said|report|reports|reported|suggest|suggests|suggested|indicate|indicates|indicated)\b|\baccording\s+to\s+(?:(?:preliminary|initial|early|unconfirmed|market)\s+)?(?:reports?|sources?|analysts?|observers?|estimates?|chatter|rumou?rs?)\b/iu;
const POSSIBLE_MODAL_RE =
  /\b(?:may|might|could|can|possible|possibly|potential(?:ly)?|likely|unlikely|probable|probably|improbable|improbably|certainly|surely|definitely|inevitably|unavoidably)\b/iu;
const CATEGORICAL_FUTURE_RE = /\b(?:will|shall)\b/iu;
const CATEGORICAL_FUTURE_CONSTRUCTION_RE =
  /\b(?:is|are|was|were)\s+(?:going|about|bound|certain)\s+to\b/iu;
const CONDITIONAL_MODAL_RE = /\bwould\b/iu;
const FORECAST_MODAL_RE =
  /\b(?:expect(?:ed|s|ing)?|forecast(?:s|ed|ing)?|project(?:ed|s|ing)|(?:analysts?|forecasters?|models?)\s+project|anticipat(?:e|es|ed|ing)|predict(?:s|ed|ing)?)\b/iu;
// In an explicit property-type noun phrase, `projects` means developments,
// not the forecast verb. Mask only that token for modality detection; all
// anchors, quantities, predicates and source text remain untouched. An
// unqualified `projects`, a capitalized potential company-name suffix, or a
// following forecast object stays fail-closed. This is not a general parser.
const PROPERTY_PROJECT_NOUN_RE =
  /\b(residential|commercial)\s+projects(?=$|[.,;:!?)]|\s+(?:in|across|within|during|for|at|on|and|or|with)\b)/gu;

function hasForecastModality(value: string): boolean {
  return FORECAST_MODAL_RE.test(
    value.replace(PROPERTY_PROJECT_NOUN_RE, "$1 developments"),
  );
}
const INTENT_MODAL_RE =
  /\b(?:plan(?:ned|s|ning)?|propos(?:ed|es|ing)?|intend(?:ed|s|ing)?|aim(?:ed|s|ing)?|seek(?:s|ing)?|sought|hope(?:d|s|ing)?|want(?:ed|s|ing)?|aspir(?:e|es|ed|ing)|prepar(?:e|es|ed|ing)\s+to|look(?:s|ed|ing)?\s+to|slated|schedule(?:d|s)?|target(?:ed|s|ing)?|due|set to)\b/iu;
const COMMITMENT_MODAL_RE =
  /\b(?:promis(?:e|ed|es|ing)|pledg(?:e|ed|es|ing)|commit(?:s|ted|ting)?|agree(?:s|d|ing)?\s+to)\b/iu;
const READINESS_MODAL_RE =
  /\b(?:is|are|was|were)\s+(?:poised|ready|on\s+(?:track|course))\s+to\b/iu;
const HIGH_RISK_RE =
  /\b(?:forecast|expected|projected|will|would|could|may|might|because|therefore|consequently|caused?|driv(?:e|es|en)|lead(?:s|ing)? to|result(?:s|ed)? in|outperform|underperform|recommend|should buy|should sell|avoid|buy|sell|position|re-rate|more valuable|less valuable|better than|worse than|higher than|lower than|compared with|compared to|versus|vs\.)\b/iu;
const EDITORIAL_DISALLOWED_RE =
  /\b(?:will|would|could|may|might|expected|forecast|projected|predict|because|therefore|consequently|caused?|driv(?:e|es|en)|lead(?:s|ing)? to|result(?:s|ed)? in|return|yield|profit|gain|loss|upside|downside|outperform|underperform|recommend|buy|sell|avoid|position|trade|invest|investment|opportunity|risk[- ]reward|more than|less than|better|worse|higher|lower|compared|versus|vs\.)\b/iu;
const PRONOUN_SUBJECT_RE =
  /^(?:it|they|them|this|these|those|he|she|the former|the latter|both)\b/iu;
const POSSESSIVE_PRONOUN_SUBJECT_RE = /^(?:its|their|his|her)\b/iu;
const PREMISE_REFERENCE_RE =
  /^(?:this|these|those|the (?:distinction|definition|measure|measures|metric|metrics|figure|figures|record|records|scope|scopes|reading|readings|source|sources|category|categories))\b/iu;
const UNRESOLVED_PASSIVE_RE =
  /\b(?:(?:is|are|was|were|been|being)\s+)?(?:acquired|announced|appointed|approved|awarded|cancelled|canceled|completed|confirmed|created|delivered|issued|launched|managed|operated|published|reported|required|sold|signed|used)\s+by\b/iu;

const INTENSITY_QUALIFIERS = new Set(
  `abruptly absolutely considerably dramatically entirely exceptionally
  extremely fairly fractionally fully greatly heavily highly largely
  marginally materially moderately notably partially partly predominantly
  rapidly relatively sharply significantly slightly slowly substantially
  strongly unusually widely`.split(/\s+/u),
);

const ACRONYM_EXPANSIONS: Record<string, readonly string[]> = {
  adgm: ["abu", "dhabi", "global", "market"],
  aum: ["asset", "management"],
  dld: ["dubai", "land", "department"],
  fsra: ["financial", "service", "regulatory", "authority"],
  rera: ["real", "estate", "regulatory", "agency"],
  ai: ["artificial", "intelligence"],
  uae: ["united", "arab", "emirate"],
};

const SYNONYM_CANONICAL: Record<string, string> = {
  assets: "asset",
  changed: "change",
  changes: "change",
  changing: "change",
  licences: "licence",
  licenses: "licence",
  license: "licence",
  entities: "entity",
  companies: "company",
  firms: "company",
  professionals: "professional",
  employees: "professional",
  staff: "professional",
  workforce: "workforce",
  homes: "home",
  houses: "home",
  residential: "residential",
  apartments: "apartment",
  villas: "villa",
  transactions: "transaction",
  registrations: "registration",
  funds: "fund",
  managers: "manager",
  approvals: "approval",
  permissions: "permission",
  prices: "price",
  enquiries: "enquiry",
  inquiries: "enquiry",
  functions: "function",
  hours: "hour",
  channels: "channel",
  measures: "measure",
};

function words(value: string): string[] {
  return (
    value
      .normalize("NFKC")
      .replace(/[’‘]/gu, "'")
      .match(/[\p{L}\p{M}\p{N}%$]+(?:[-'][\p{L}\p{M}\p{N}%$]+)*/gu) ?? []
  ).map((word) => word.toLowerCase().replace(/'s$/u, ""));
}

function stem(value: string): string {
  const direct = SYNONYM_CANONICAL[value];
  if (direct) return direct;
  if (value.length > 5 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 5 && value.endsWith("ing")) return value.slice(0, -3);
  if (value.length > 4 && value.endsWith("ed")) return value.slice(0, -2);
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (
    value.length > 3 &&
    value.endsWith("s") &&
    !/(?:ss|is|us)$/u.test(value)
  ) {
    return value.slice(0, -1);
  }
  return value;
}

function contentTokens(input: string[]): Set<string> {
  const result = new Set<string>();
  for (const raw of input) {
    if (
      STOP_WORDS.has(raw) ||
      (PREDICATE_BY_TOKEN.has(raw) && !AMBIGUOUS_NOUN_ANCHORS.has(raw))
    ) {
      continue;
    }
    const candidates = [stem(raw), ...(ACRONYM_EXPANSIONS[raw] ?? []).map(stem)];
    for (const token of candidates) {
      if (
        token.length >= 2 &&
        !STOP_WORDS.has(token) &&
        (!PREDICATE_BY_TOKEN.has(token) || AMBIGUOUS_NOUN_ANCHORS.has(token)) &&
        !/^\d/u.test(token) &&
        !/^(?:aed|dh|dhs|usd|us|million|billion|trillion|percent|cent)$/u.test(token)
      ) {
        result.add(token);
      }
    }
  }
  return result;
}

const NUMBER_WORD_VALUES: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const NUMBER_WORD_TOKEN =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion";
const WORD_NUMBER_ANCHOR_RE = new RegExp(
  `(?:\\b(?:AED|Dh|Dhs|USD|US\\$)|\\$)?\\s*\\b(?:${NUMBER_WORD_TOKEN})(?:[ -]+(?:${NUMBER_WORD_TOKEN}))*\\b(?:\\s*(?:%|per\\s*cent|percent|dirhams?|dollars?))?`,
  "giu",
);
const FRACTION_NUMBER_ANCHOR_RE =
  /(?:\b(?:AED|Dh|Dhs|USD|US\$)|\$)?\s*\b(?:(?:one[ -]+and[ -]+a[ -]+half)|(?:(?:a|one)[ -]+)?half(?:[ -]+a)?|(?:a[ -]+)?quarter(?:[ -]+of[ -]+a)?)\s+(?:hundred|thousand|million|billion|trillion)\b(?:\s+(?:dirhams?|dollars?))?/giu;
const NUMBER_ANCHOR_RE =
  /(?:\b(?:AED|Dh|Dhs|USD|US\$)|\$)?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:(?:hundred|thousand|million|billion|trillion|k|m|mn|bn|tn)(?:\s+(?:dirhams?|dollars?))?|%|per\s*cent|percent|dirhams?|dollars?)?/giu;

function numberPrefix(value: string): string {
  if (/^\s*(?:dh|dhs|aed)/iu.test(value) || /\bdirhams?\s*$/iu.test(value)) {
    return "aed";
  }
  if (/^\s*(?:us\$|usd|\$)/iu.test(value) || /\bdollars?\s*$/iu.test(value)) {
    return "usd";
  }
  return "";
}

function formattedNumericValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(8)));
}

function scaledCanonicalNumber(
  amount: number,
  prefix: string,
  percentage: boolean,
): string {
  return `${prefix}${formattedNumericValue(amount)}${percentage ? "%" : ""}`;
}

function parsedWordNumber(value: string): number | null {
  const scale = /\btrillion\b/iu.test(value)
    ? 1_000_000_000_000
    : /\bbillion\b/iu.test(value)
      ? 1_000_000_000
      : /\bmillion\b/iu.test(value)
        ? 1_000_000
        : /\bthousand\b/iu.test(value)
          ? 1_000
          : /\bhundred\b/iu.test(value)
            ? 100
            : 1;
  const normalizedFraction = value.toLowerCase().replace(/-/gu, " ");
  if (/\bone\s+and\s+a\s+half\b/u.test(normalizedFraction)) {
    return 1.5 * scale;
  }
  if (/\b(?:(?:a|one)\s+)?half\b/u.test(normalizedFraction)) {
    return 0.5 * scale;
  }
  if (/\b(?:a\s+)?quarter\b/u.test(normalizedFraction)) {
    return 0.25 * scale;
  }
  const tokens = value
    .toLowerCase()
    .replace(/\b(?:aed|dh|dhs|usd|us\$)\b|[$%]/gu, " ")
    .replace(/\b(?:per\s*cent|percent|dirhams?|dollars?)\b/gu, " ")
    .split(/[\s-]+/u)
    .filter((token) => token && token !== "and");
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const token of tokens) {
    const unit = NUMBER_WORD_VALUES[token];
    if (unit !== undefined) {
      current += unit;
      sawNumber = true;
      continue;
    }
    if (token === "hundred") {
      current = Math.max(1, current) * 100;
      sawNumber = true;
      continue;
    }
    const scale = token === "thousand"
      ? 1_000
      : token === "million"
        ? 1_000_000
        : token === "billion"
          ? 1_000_000_000
          : token === "trillion"
            ? 1_000_000_000_000
            : null;
    if (scale === null) return null;
    total += Math.max(1, current) * scale;
    current = 0;
    sawNumber = true;
  }
  return sawNumber ? total + current : null;
}

function canonicalNumber(value: string): string {
  const prefix = numberPrefix(value);
  const percentage = /%|\b(?:per\s*cent|percent)\b/iu.test(value);
  const digit = value.replace(/,/gu, "").match(/\d+(?:\.\d+)?/u);
  if (digit) {
    const magnitudeText = value.replace(/\b(?:dirhams?|dollars?)\s*$/iu, "");
    const multiplier = /(?:trillion|tn)\s*$/iu.test(magnitudeText)
      ? 1_000_000_000_000
      : /(?:billion|bn)\s*$/iu.test(magnitudeText)
        ? 1_000_000_000
        : /(?:million|m|mn)\s*$/iu.test(magnitudeText)
          ? 1_000_000
          : /(?:thousand|k)\s*$/iu.test(magnitudeText)
            ? 1_000
            : /hundred\s*$/iu.test(magnitudeText)
              ? 100
              : 1;
    return scaledCanonicalNumber(Number(digit[0]) * multiplier, prefix, percentage);
  }
  const parsed = parsedWordNumber(value);
  return parsed === null
    ? normalizedPhrase(value)
    : scaledCanonicalNumber(parsed, prefix, percentage);
}

function numberAnchors(value: string): Set<string> {
  return new Set(nonDateNumberMatches(value).map(({ scalar }) => scalar));
}

interface NumericValueMatch {
  start: number;
  end: number;
  scalar: string;
}

function nonDateNumberMatches(value: string): NumericValueMatch[] {
  const dateMatches = [...value.matchAll(DATE_ANCHOR_RE)];
  const digitMatches = [...value.matchAll(NUMBER_ANCHOR_RE)];
  const fractionMatches = [...value.matchAll(FRACTION_NUMBER_ANCHOR_RE)];
  const wordMatches = [...value.matchAll(WORD_NUMBER_ANCHOR_RE)].filter(
    (match) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const overlapsSpecializedAmount = [...digitMatches, ...fractionMatches].some((specialized) => {
        const specializedStart = specialized.index ?? 0;
        const specializedEnd = specializedStart + specialized[0].length;
        return start < specializedEnd && specializedStart < end;
      });
      return !overlapsSpecializedAmount;
    },
  );
  return [...digitMatches, ...fractionMatches, ...wordMatches]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((match) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const firstDigit = match[0].search(/\d/u);
      const digitMatches = [...match[0].matchAll(/\d/gu)];
      const lastDigit = digitMatches.length > 0
        ? Math.max(
          ...digitMatches.map(
            (digit) => (digit.index ?? 0) + digit[0].length,
          ),
        )
        : -1;
      const materialStart = firstDigit >= 0 ? start + firstDigit : start;
      const materialEnd = lastDigit >= 0 ? start + lastDigit : end;
      const insideDate = firstDigit >= 0 && dateMatches.some((date) => {
        const dateStart = date.index ?? 0;
        return (
          materialStart >= dateStart &&
          materialEnd <= dateStart + date[0].length
        );
      });
      return insideDate
        ? null
        : { start, end, scalar: canonicalNumber(match[0]) };
    })
    .filter((match): match is NumericValueMatch => match !== null);
}

function numericRangeInfo(value: string): {
  bindings: Set<string>;
  memberQualifiers: Map<string, QuantityQualifier>;
} {
  const bindings = new Set<string>();
  const memberQualifiers = new Map<string, QuantityQualifier>();
  const matches = nonDateNumberMatches(value);
  for (let index = 0; index + 1 < matches.length; index += 1) {
    const first = matches[index];
    const second = matches[index + 1];
    const prefix = value.slice(Math.max(0, first.start - 28), first.start);
    const connector = value.slice(first.end, second.start);
    const isRange =
      (/\bbetween\s*$/iu.test(prefix) && /^\s*and\s*$/iu.test(connector)) ||
      (/\bfrom\s*$/iu.test(prefix) && /^\s*to\s*$/iu.test(connector)) ||
      /^\s*[–—-]\s*$/u.test(connector);
    const isPlusMinus =
      /^\s*(?:±|\+\s*\/\s*-|plus\s+or\s+minus)\s*$/iu.test(connector);
    if (!isRange && !isPlusMinus) continue;
    const qualifier: QuantityQualifier = isPlusMinus ? "plus-minus" : "range";
    bindings.add(`${qualifier}:${first.scalar}>${second.scalar}`);
    memberQualifiers.set(`${first.start}:${first.end}`, qualifier);
    memberQualifiers.set(`${second.start}:${second.end}`, qualifier);
  }
  return { bindings, memberQualifiers };
}

function quantityQualifierAt(
  value: string,
  start: number,
  end: number,
): QuantityQualifier {
  const before = value
    .slice(Math.max(0, start - 48), start)
    .trimEnd()
    .replace(/[)\]}:;,]+$/gu, "")
    .trimEnd();
  const after = value.slice(end, Math.min(value.length, end + 28));
  if (
    /(?:≥|>=)\s*$/u.test(before) ||
    /\b(?:at least|no fewer than|not less than|minimum of|as low as)\s*$/iu.test(before) ||
    /^\s*(?:\+(?!\s*\/\s*-)|or more|or above)/iu.test(after)
  ) {
    return "lower-inclusive";
  }
  if (
    /(?:≤|<=)\s*$/u.test(before) ||
    /\b(?:at most|no more than|not greater than|maximum of|up to|as many as|as much as|as high as)\s*$/iu.test(before) ||
    /^\s*(?:or less|or below)\b/iu.test(after)
  ) {
    return "upper-inclusive";
  }
  if (
    /(?:~|≈)\s*$/u.test(before) ||
    /\b(?:approximately|approx\.?|about|around|roughly|circa|nearly|almost|close to|some|estimated(?:\s+at)?|an estimated)\s*$/iu.test(
      before,
    )
  ) {
    return "approximate";
  }
  if (
    />\s*$/u.test(before) ||
    /\b(?:more than|over|above|greater than|exceeding|upwards of|in excess of)\s*$/iu.test(before)
  ) {
    return "lower-exclusive";
  }
  if (/<\s*$/u.test(before) || /\b(?:less than|under|below|fewer than)\s*$/iu.test(before)) {
    return "upper-exclusive";
  }
  return "exact";
}

function quantityBindings(value: string): Set<string> {
  const bindings = new Set<string>();
  const rangeInfo = numericRangeInfo(value);
  for (const match of nonDateNumberMatches(value)) {
    const qualifier = rangeInfo.memberQualifiers.get(
      `${match.start}:${match.end}`,
    ) ?? quantityQualifierAt(value, match.start, match.end);
    bindings.add(
      `${match.scalar}:${qualifier}`,
    );
  }
  return bindings;
}

function rangeBindings(value: string): Set<string> {
  return numericRangeInfo(value).bindings;
}

function quantityAmbiguous(value: string): boolean {
  const rangeInfo = numericRangeInfo(value);
  for (const match of nonDateNumberMatches(value)) {
    const before = value
      .slice(Math.max(0, match.start - 80), match.start)
      .trimEnd()
      .replace(/[)\]}:;,]+$/gu, "")
      .trimEnd();
    const after = value.slice(match.end, Math.min(value.length, match.end + 28));
    const approximate =
      /(?:~|≈)\s*$/u.test(before) ||
      /\b(?:approximately|approx\.?|about|around|roughly|circa|nearly|almost|close to|some|estimated)\b[\s\S]{0,36}$/iu.test(before);
    const boundKinds = new Set<string>();
    if (
      /(?:≥|>=)\s*$/u.test(before) ||
      /\b(?:at least|no fewer than|not less than|minimum of|as low as)\b[\s\S]{0,28}$/iu.test(before) ||
      /^\s*(?:\+(?!\s*\/\s*-)|or more|or above)/iu.test(after)
    ) {
      boundKinds.add("lower");
    }
    if (
      /(?:≤|<=)\s*$/u.test(before) ||
      /\b(?:at most|no more than|not greater than|maximum of|up to|as many as|as much as|as high as)\b[\s\S]{0,28}$/iu.test(before) ||
      /^\s*(?:or less|or below)/iu.test(after)
    ) {
      boundKinds.add("upper");
    }
    if (
      />\s*$/u.test(before) ||
      /\b(?:more than|over|above|greater than|exceeding|upwards of|in excess of)\b[\s\S]{0,28}$/iu.test(before)
    ) {
      boundKinds.add("lower");
    }
    if (
      /<\s*$/u.test(before) ||
      /\b(?:less than|under|below|fewer than)\b[\s\S]{0,28}$/iu.test(before)
    ) {
      boundKinds.add("upper");
    }
    const interval = rangeInfo.memberQualifiers.get(
      `${match.start}:${match.end}`,
    );
    if (interval) boundKinds.add(interval);
    if (boundKinds.size > 1 || (approximate && boundKinds.size > 0)) {
      return true;
    }
  }
  return false;
}

const DATE_ANCHOR_RE =
  /\b(?:H[12]|Q[1-4])\s*(?:19|20)\d{2}\b|\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:,?\s+(?:19|20)\d{2})?\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+(?:19|20)\d{2})?\b|\b(?:19|20)\d{2}\b/giu;

const MONTH_NUMBER: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function canonicalDate(value: string): string {
  const compact = value.toLowerCase().replace(/,/gu, "").replace(/\s+/gu, " ").trim();
  const period = compact.match(/^(h[12]|q[1-4])\s*((?:19|20)\d{2})$/u);
  if (period) return `${period[1]}:${period[2]}`;
  if (/^(?:19|20)\d{2}$/u.test(compact)) return compact;
  const monthFirst = compact.match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s+((?:19|20)\d{2}))?$/u,
  );
  const dayFirst = compact.match(
    /^(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+((?:19|20)\d{2}))?$/u,
  );
  const month = monthFirst?.[1] ?? dayFirst?.[2];
  const day = monthFirst?.[2] ?? dayFirst?.[1];
  const year = monthFirst?.[3] ?? dayFirst?.[3] ?? "----";
  return month && day
    ? `${year}-${MONTH_NUMBER[month]}-${day.padStart(2, "0")}`
    : compact;
}

function dateAnchors(value: string): Set<string> {
  const dates = value.match(DATE_ANCHOR_RE) ?? [];
  return new Set(dates.map(canonicalDate));
}

function normalizedPhrase(value: string): string {
  return words(value).map(stem).join(" ");
}

function entityPhrases(value: string): Set<string> {
  const out = new Set<string>();
  const acronymMatches = value.match(/\b[A-Z][A-Z0-9&]{1,10}\b/gu) ?? [];
  for (const acronym of acronymMatches) {
    if (/^(?:AED|USD|DHS?|US|H[12]|Q[1-4])\d*(?:\.\d+)?$/u.test(acronym)) {
      continue;
    }
    out.add(acronym.toLowerCase());
  }

  const sequences = value.match(
    /\b(?:[A-Z][\p{L}\p{M}'’-]+|Al|Bin|Bint)(?:\s+(?:[A-Z][\p{L}\p{M}'’-]+|Al|Bin|Bint|and|of|the)){1,7}\b/gu,
  ) ?? [];
  const sequenceTokens = new Set<string>();
  for (const sequence of sequences) {
    const normalized = normalizedPhrase(sequence)
      .replace(/^(?:the|a|an)\s+/u, "")
      .replace(/(?:\s+(?:and|of|the))+$/u, "");
    if (normalized.split(" ").length >= 2) {
      out.add(normalized);
      for (const token of normalized.split(" ")) sequenceTokens.add(token);
    }
  }
  const properTokens = value.match(/\b[A-Z][\p{L}\p{M}'’-]{2,}\b/gu) ?? [];
  for (const token of properTokens) {
    const normalized = normalizedPhrase(token);
    if (
      normalized.length >= 3 &&
      !sequenceTokens.has(normalized) &&
      !STOP_WORDS.has(normalized) &&
      !/^(?:aed|usd|dhs|january|february|march|april|may|june|july|august|september|october|november|december)$/u.test(
        normalized,
      )
    ) {
      out.add(normalized);
    }
  }
  return out;
}

function orderedContentTokens(value: string): string[] {
  return words(value)
    .filter(
      (token) =>
        !STOP_WORDS.has(token) &&
        !PREDICATE_BY_TOKEN.has(token) &&
        !/^\d/u.test(token) &&
        !/^(?:aed|dh|dhs|usd|us|million|billion|trillion|percent|cent)$/u.test(
          token,
        ),
    )
    .map(stem)
    .filter((token) => token.length >= 2);
}

function nearestContentTokens(value: string, fromEnd: boolean): string[] {
  const input = words(value);
  const scan = fromEnd ? [...input].reverse() : input;
  const anchors: string[] = [];
  for (const token of scan) {
    const boundary = STOP_WORDS.has(token) || PREDICATE_BY_TOKEN.has(token);
    if (boundary) {
      if (anchors.length > 0) break;
      if (!fromEnd) break;
      continue;
    }
    const normalized = stem(token);
    if (
      normalized.length < 2 ||
      /^\d/u.test(normalized) ||
      /^(?:aed|dh|dhs|usd|us|million|billion|trillion|percent|cent)$/u.test(
        normalized,
      )
    ) {
      continue;
    }
    anchors.push(normalized);
    if (anchors.length >= 2) break;
  }
  return fromEnd ? anchors.reverse() : anchors;
}

function scalarBindings(value: string): Set<string> {
  const bindings = new Set<string>();
  const dateMatches = [...value.matchAll(DATE_ANCHOR_RE)];
  const addBinding = (
    kind: "number" | "date",
    scalar: string,
    start: number,
    end: number,
    preferBefore: boolean,
  ) => {
    const before = value.slice(Math.max(0, start - 100), start);
    const after = value.slice(end, Math.min(value.length, end + 100));
    const beforeBoundary = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf(";"),
    );
    const priorScalars = nonDateNumberMatches(before);
    const priorScalarBoundary = priorScalars.at(-1)?.end ?? -1;
    const afterBoundaryCandidates = [after.indexOf("."), after.indexOf(";")]
      .filter((index) => index >= 0);
    const boundedBefore = before.slice(
      Math.max(beforeBoundary + 1, priorScalarBoundary),
    );
    const boundedAfter = after.slice(
      0,
      afterBoundaryCandidates.length > 0
        ? Math.min(...afterBoundaryCandidates)
        : after.length,
    );
    const nextScalarStart = nonDateNumberMatches(boundedAfter)[0]?.start;
    const beforeAnchors = nearestContentTokens(boundedBefore, true);
    const afterAnchors = nearestContentTokens(
      nextScalarStart === undefined
        ? boundedAfter
        : boundedAfter.slice(0, nextScalarStart),
      false,
    );
    const anchors = preferBefore
      ? beforeAnchors.length > 0
        ? beforeAnchors
        : afterAnchors
      : afterAnchors.length > 0
        ? afterAnchors
        : beforeAnchors;
    if (anchors.length > 0) {
      bindings.add(`${kind}:${scalar}:${anchors.join(">")}`);
    }
  };
  for (const match of dateMatches) {
    addBinding(
      "date",
      canonicalDate(match[0]),
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      true,
    );
  }
  for (const match of nonDateNumberMatches(value)) {
    addBinding("number", match.scalar, match.start, match.end, false);
  }
  return bindings;
}

function comparisonBindings(value: string): Set<string> {
  const bindings = new Set<string>();
  const pattern = /\b(higher|more|better|lower|less|worse)\s+than\b/giu;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    const left = orderedContentTokens(value.slice(0, start)).slice(-3);
    const right = orderedContentTokens(
      value.slice(start + match[0].length),
    ).slice(0, 3);
    if (left.length === 0 || right.length === 0) continue;
    const direction = /^(?:higher|more|better)$/iu.test(match[1])
      ? "up"
      : "down";
    bindings.add(`${left.join(">")}:${direction}:${right.join(">")}`);
  }
  return bindings;
}

function aliasesForEvidence(evidence: ClaimSupportEvidence): string[] {
  const values = new Set([evidence.publisher, ...(evidence.publisherAliases ?? [])]);
  return [...values]
    .map((value) => normalizedPhrase(value))
    .filter((value) => value.length >= 2);
}

function rawAliasesForEvidence(evidence: ClaimSupportEvidence): string[] {
  return [...new Set([evidence.publisher, ...(evidence.publisherAliases ?? [])])]
    .map((value) => value.trim())
    .filter((value) => value.length >= 2);
}

function canonicalPublisherDomain(evidence: ClaimSupportEvidence): string {
  if (evidence.publisherDomain?.trim()) {
    return evidence.publisherDomain.trim().toLowerCase().replace(/^www\./u, "");
  }
  try {
    return new URL(evidence.url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    // Invalid URLs are rejected by the caller's source gate. Keeping a unique
    // fail-closed identity here prevents two malformed records corroborating.
    return `invalid:${evidence.url}`;
  }
}

function containsPhrase(haystack: string, needle: string): boolean {
  return ` ${normalizedPhrase(haystack)} `.includes(` ${needle} `);
}

function predicateSignature(input: string[]): Set<string> {
  const result = new Set<string>();
  for (const token of input) {
    const predicate = PREDICATE_BY_TOKEN.get(token);
    if (predicate) result.add(predicate);
  }
  return result;
}

function directionSignature(input: string[]): Set<string> {
  const result = new Set<string>();
  for (const token of input) {
    const direction = DIRECTION_BY_TOKEN.get(token);
    if (direction) result.add(direction);
  }
  return result;
}

function comparatorSignature(value: string): Set<string> {
  const result = new Set<string>();
  for (const [name, pattern] of COMPARATOR_PATTERNS) {
    if (pattern.test(value)) result.add(name);
  }
  return result;
}

function hasInfinitiveFactAction(value: string): boolean {
  const input = words(value);
  return input.some(
    (token, index) =>
      token === "to" && PREDICATE_BY_TOKEN.has(input[index + 1] ?? ""),
  );
}

function modality(value: string): Signature["modality"] {
  const normalized = normalizedPolarityText(value);
  if (
    CATEGORICAL_FUTURE_RE.test(normalized) ||
    CATEGORICAL_FUTURE_CONSTRUCTION_RE.test(normalized)
  ) {
    return "categorical-future";
  }
  if (CONDITIONAL_MODAL_RE.test(normalized)) return "conditional";
  if (COMMITMENT_MODAL_RE.test(normalized)) return "commitment";
  if (hasForecastModality(normalized)) return "forecast";
  if (INTENT_MODAL_RE.test(normalized)) return "intent";
  if (READINESS_MODAL_RE.test(normalized)) return "readiness";
  if (POSSIBLE_MODAL_RE.test(normalized)) return "possible";
  // A recognised reporting/epistemic construction owns its infinitive; the
  // probability signature binds the qualification. Any other bare `to + fact
  // action` is too ambiguous for deterministic tense/agency recovery and must
  // never be treated as a completed plain assertion.
  if (
    HEDGED_PROBABILITY_RE.test(normalized) &&
    hasInfinitiveFactAction(normalized)
  ) {
    return "asserted";
  }
  if (hasInfinitiveFactAction(normalized)) return "unresolved";
  return "asserted";
}

function modalityAmbiguous(value: string): boolean {
  const normalized = normalizedPolarityText(value);
  return [
    CATEGORICAL_FUTURE_RE.test(normalized) ||
      CATEGORICAL_FUTURE_CONSTRUCTION_RE.test(normalized),
    CONDITIONAL_MODAL_RE.test(normalized),
    COMMITMENT_MODAL_RE.test(normalized),
    hasForecastModality(normalized),
    INTENT_MODAL_RE.test(normalized),
    READINESS_MODAL_RE.test(normalized),
  ].filter(Boolean).length > 1;
}

function probability(value: string): ProbabilityQualifier {
  const normalized = normalizedPolarityText(value);
  // Negative probability must win over the weaker `may` in phrases such as
  // `may be unlikely`. These are outcome qualifiers, not ordinary negation.
  if (/\b(?:can|will|would|must)\s+not\b/iu.test(normalized)) {
    return "impossible";
  }
  if (ALMOST_CERTAIN_PROBABILITY_RE.test(normalized)) return "almost-certain";
  if (CERTAIN_PROBABILITY_RE.test(normalized)) return "certain";
  if (UNLIKELY_PROBABILITY_RE.test(normalized)) return "unlikely";
  if (LIKELY_PROBABILITY_RE.test(normalized)) return "likely";
  if (HEDGED_PROBABILITY_RE.test(normalized)) return "hedged";
  if (POSSIBLE_PROBABILITY_RE.test(normalized)) return "possible";
  return "none";
}

function probabilityAmbiguous(value: string): boolean {
  const normalized = normalizedPolarityText(value);
  if (
    /\b(?:may|might|could)\s+or\s+(?:may|might|could)\s+not\b/iu.test(normalized) ||
    /\bnot\s+unlikely\b/iu.test(normalized)
  ) {
    return true;
  }
  const almostCertain = ALMOST_CERTAIN_PROBABILITY_RE.test(normalized);
  const familyCount = [
    POSSIBLE_PROBABILITY_RE.test(normalized),
    LIKELY_PROBABILITY_RE.test(normalized),
    UNLIKELY_PROBABILITY_RE.test(normalized),
    almostCertain,
    CERTAIN_PROBABILITY_RE.test(normalized) && !almostCertain,
    HEDGED_PROBABILITY_RE.test(normalized),
  ].filter(Boolean).length;
  return familyCount > 1;
}

function qualifierAnchors(value: string): Set<string> {
  const result = new Set<string>();
  for (const token of words(value)) {
    if (INTENSITY_QUALIFIERS.has(token)) result.add(token);
  }
  return result;
}

function normalizedPolarityText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/gu, "'")
    .replace(/\bwon't\b/giu, "will not")
    .replace(/\bcan't\b/giu, "can not")
    .replace(/\bshan't\b/giu, "shall not")
    .replace(/\b([a-z]+)n't\b/giu, "$1 not")
    .replace(/\bcannot\b/giu, "can not");
}

function negativePolarity(value: string): boolean {
  return NEGATIVE_RE.test(normalizedPolarityText(value));
}

function negativeAbsence(value: string): boolean {
  return NEGATIVE_ABSENCE_RE.test(normalizedPolarityText(value));
}

function forceQualifier(value: string): ForceQualifier {
  if (/\bmust\b/iu.test(value)) return "must";
  if (/\bshould\b/iu.test(value)) return "should";
  return "none";
}

function firstPredicateIndex(input: string[]): { index: number; predicate: string } | null {
  for (let index = 0; index < input.length; index += 1) {
    const predicate = PREDICATE_BY_TOKEN.get(input[index]);
    if (predicate) return { index, predicate };
  }
  return null;
}

function attributionPublishers(
  value: string,
  evidence: readonly ClaimSupportEvidence[],
): { publishers: Set<number>; all: boolean } {
  // Keep reporting verbs unstemmed here. Generic stemming turns `stated` into
  // `stat` and `Reuters` into `reuter`, which silently loses an otherwise
  // explicit attribution boundary.
  const trimmed = words(value).join(" ");
  const reportingLead = trimmed.match(
    /^(.{1,180}?)\b(?:report|reports|reported|say|says|said|state|states|stated|confirm|confirms|confirmed|announce|announces|announced)\s+that\b/u,
  )?.[1];
  const publishers = new Set<number>();
  evidence.forEach((record, index) => {
    const explicitlyAttributed = rawAliasesForEvidence(record)
      .map((alias) => words(alias).join(" "))
      .some((alias) => {
      const accordingPrefix = trimmed.startsWith(`according to ${alias} `);
      const accordingSuffix = trimmed.endsWith(` according to ${alias}`);
      const reportingPrefix = reportingLead
        ? ` ${reportingLead} `.includes(` ${alias} `)
        : false;
      return accordingPrefix || accordingSuffix || reportingPrefix;
      });
    if (explicitlyAttributed) {
      publishers.add(index);
    }
  });
  const all = /\b(?:both|all)\s+(?:sources|publications|publishers|reports)\b/iu.test(value);
  return { publishers, all };
}

function stripPublisherAttribution(
  value: string,
  evidence: readonly ClaimSupportEvidence[],
): string {
  const allAliases = evidence
    .flatMap((record) => rawAliasesForEvidence(record))
    .sort((left, right) => right.length - left.length)
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  if (allAliases.length === 0) return value;
  const aliasPattern = `(?:${allAliases.join("|")})`;
  return value
    .replace(
      new RegExp(`^according\\s+to\\s+${aliasPattern},?\\s+`, "iu"),
      "",
    )
    .replace(
      /^(?:both|all)\s+(?:sources|publications|publishers|reports)\s+(?:report(?:s|ed)?|(?:say|says|said)|state(?:s|d)?|confirm(?:s|ed)?)\s+(?:that\s+)?/iu,
      "",
    )
    .replace(
      new RegExp(
        `^(?:(?:${aliasPattern})(?:\\s*(?:,|and|&|/)\\s*|\\s+))+(?:report(?:s|ed)?|(?:say|says|said)|state(?:s|d)?|confirm(?:s|ed)?|announce(?:s|d)?)\\s+that\\s+`,
        "iu",
      ),
      "",
    )
    .replace(
      new RegExp(
        `,?\\s+(?:according to|(?:${aliasPattern})\\s+(?:report(?:s|ed)?|(?:say|says|said)|state(?:s|d)?|confirm(?:s|ed)?))\\s*$`,
        "iu",
      ),
      "",
    );
}

interface LexicalToken {
  word: string;
  start: number;
  end: number;
}

function lexicalTokens(value: string): { text: string; tokens: LexicalToken[] } {
  const text = value.normalize("NFKC").replace(/[’‘]/gu, "'");
  const pattern = /[\p{L}\p{M}\p{N}%$]+(?:[-'][\p{L}\p{M}\p{N}%$]+)*/gu;
  const tokens = [...text.matchAll(pattern)].map((match) => ({
    word: match[0].toLowerCase().replace(/'s$/u, ""),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  return { text, tokens };
}

function stripLeadingSubjectAdjunct(value: string): string {
  // Keep place/time adjuncts out of the actor identity. Requiring a comma is
  // deliberate: without that visible boundary, deterministic role recovery is
  // too ambiguous to rewrite safely.
  return value
    .replace(
      /^\s*(?:(?:across|after|as of|at|before|by|during|from|in|on|throughout|under|within)\b[^,]{1,96},\s*)+/iu,
      "",
    )
    .replace(
      /\s+(?:across|at|during|in|on|throughout|within)\b[\s\S]{1,96}$/iu,
      "",
    );
}

function canonicalEntityIdentity(entity: string): string {
  const expanded = ACRONYM_EXPANSIONS[entity];
  return expanded ? expanded.map(stem).join(" ") : entity;
}

function subjectIdentity(
  value: string,
  evidence: readonly ClaimSupportEvidence[],
): string | null {
  const normalized = normalizedPhrase(value);
  const publisherKeys = new Set<string>();
  for (const record of evidence) {
    const aliases = [record.publisher, ...(record.publisherAliases ?? [])]
      .map(normalizedPhrase)
      .filter(Boolean);
    if (
      aliases.some((alias) =>
        ` ${normalized} `.includes(` ${alias} `),
      )
    ) {
      publisherKeys.add(`publisher:${canonicalPublisherDomain(record)}`);
    }
  }
  if (publisherKeys.size > 0) {
    return [...publisherKeys].sort().join("|");
  }

  const entities = new Set(
    [...entityPhrases(value)].map(canonicalEntityIdentity),
  );
  if (entities.size > 0) {
    return [...entities]
      .sort()
      .map((entity) => `entity:${entity}`)
      .join("|");
  }

  const fallback = [...contentTokens(words(value))].sort();
  return fallback.length > 0 ? `subject:${fallback.join("+")}` : null;
}

const RELATION_COORDINATORS = new Set(["and", "but", "whereas", "while", "yet"]);
const NON_RELATIONAL_NOUN_TOKENS = new Set([
  ...AMBIGUOUS_NOUN_ANCHORS,
  "launch",
]);
const AUXILIARY_RELATION_PREDICATE_TOKENS = new Set([
  "are",
  "is",
  "was",
  "were",
]);

function relationPredicateEligible(
  tokens: readonly LexicalToken[],
  index: number,
): boolean {
  const token = tokens[index]?.word ?? "";
  if (!PREDICATE_BY_TOKEN.has(token)) return false;
  if (
    token === "reported" &&
    /^(?:is|are|was|were)$/u.test(tokens[index - 1]?.word ?? "") &&
    tokens[index + 1]?.word === "to" &&
    PREDICATE_BY_TOKEN.has(tokens[index + 2]?.word ?? "")
  ) {
    // In `is reported to rise`, `reported` is an epistemic modifier of the
    // following action, not a separate publisher-action tuple.
    return false;
  }
  if (token === "total") {
    const next = tokens[index + 1]?.word ?? "";
    const afterNext = tokens[index + 2]?.word ?? "";
    return (
      /^(?:(?:aed|dh|dhs|usd|us)\$?)?\d/iu.test(next) ||
      (/^(?:aed|dh|dhs|usd|us\$|\$)$/iu.test(next) && /^\d/u.test(afterNext))
    );
  }
  if (NON_RELATIONAL_NOUN_TOKENS.has(token)) {
    // `launch` is ambiguous as a noun, but an infinitive after `to` is an
    // explicit action. Keeping that relation prevents readiness/intent
    // qualifiers from being detached from the launch they modify.
    if (token !== "launch" || tokens[index - 1]?.word !== "to") return false;
  }
  if (!AUXILIARY_RELATION_PREDICATE_TOKENS.has(token)) return true;
  return !tokens.slice(index + 1).some((candidate, offset) => {
    const candidateIndex = index + offset + 1;
    return (
      !AUXILIARY_RELATION_PREDICATE_TOKENS.has(candidate.word) &&
      relationPredicateEligible(tokens, candidateIndex)
    );
  });
}

function lastCoordinatorIndex(
  tokens: readonly LexicalToken[],
  start: number,
  end: number,
): number {
  for (let index = end - 1; index >= start; index -= 1) {
    if (RELATION_COORDINATORS.has(tokens[index]?.word ?? "")) return index;
  }
  return -1;
}

function relationTuples(
  value: string,
  evidence: readonly ClaimSupportEvidence[],
): RelationTuple[] {
  const { text, tokens } = lexicalTokens(value);
  const predicateIndexes = tokens
    .map((_token, index) => relationPredicateEligible(tokens, index) ? index : -1)
    .filter((index) => index >= 0);
  const relations: RelationTuple[] = [];
  let inheritedSubject: string | null = null;

  for (let relationIndex = 0; relationIndex < predicateIndexes.length; relationIndex += 1) {
    const predicateIndex = predicateIndexes[relationIndex];
    const previousPredicateIndex = predicateIndexes[relationIndex - 1] ?? -1;
    const nextPredicateIndex = predicateIndexes[relationIndex + 1] ?? tokens.length;
    const priorCoordinator = previousPredicateIndex >= 0
      ? lastCoordinatorIndex(
        tokens,
        previousPredicateIndex + 1,
        predicateIndex,
      )
      : -1;
    const subjectStart = priorCoordinator >= 0
      ? priorCoordinator + 1
      : previousPredicateIndex + 1;
    const subjectTokens = tokens.slice(subjectStart, predicateIndex);
    const rawSubjectText = subjectTokens.length > 0
      ? text.slice(subjectTokens[0].start, subjectTokens.at(-1)?.end)
      : "";
    const subjectText = stripLeadingSubjectAdjunct(rawSubjectText);
    const explicitSubject = subjectIdentity(subjectText, evidence);
    const subjectKey = explicitSubject ?? inheritedSubject;
    if (explicitSubject) inheritedSubject = explicitSubject;
    if (!subjectKey) continue;

    const followingCoordinator = nextPredicateIndex < tokens.length
      ? lastCoordinatorIndex(
        tokens,
        predicateIndex + 1,
        nextPredicateIndex,
      )
      : -1;
    const objectEnd = followingCoordinator >= 0
      ? followingCoordinator
      : nextPredicateIndex;
    const objectTokens = tokens.slice(predicateIndex + 1, objectEnd);
    const objectText = objectTokens.length > 0
      ? text.slice(objectTokens[0].start, objectTokens.at(-1)?.end)
      : "";
    const relationStart = subjectTokens[0]?.start ?? tokens[predicateIndex].start;
    const relationEnd = objectTokens.at(-1)?.end ?? tokens[predicateIndex].end;
    const relationText = text.slice(relationStart, relationEnd);
    const predicate = PREDICATE_BY_TOKEN.get(tokens[predicateIndex].word);
    if (!predicate) continue;
    relations.push({
      subjectKey,
      predicate,
      object: contentTokens(words(objectText)),
      numbers: numberAnchors(relationText),
      dates: dateAnchors(relationText),
      scalarBindings: scalarBindings(relationText),
      directions: directionSignature(words(relationText)),
      comparators: comparatorSignature(relationText),
      comparisonBindings: comparisonBindings(relationText),
      modality: modality(relationText),
      probability: probability(relationText),
      force: forceQualifier(relationText),
      qualifiers: qualifierAnchors(relationText),
      quantityBindings: quantityBindings(relationText),
      rangeBindings: rangeBindings(relationText),
      quantityAmbiguous: quantityAmbiguous(relationText),
      negative: negativePolarity(relationText),
    });
  }
  return relations;
}

function signature(
  value: string,
  evidence: readonly ClaimSupportEvidence[],
): Signature {
  const rawWords = words(value);
  const attribution = attributionPublishers(value, evidence);
  const factText = stripPublisherAttribution(value, evidence);
  const factWords = words(factText);
  const predicate = firstPredicateIndex(factWords);
  const subjectWords = predicate ? factWords.slice(0, predicate.index) : factWords;
  const objectWords = predicate ? factWords.slice(predicate.index + 1) : [];
  const predicates = predicateSignature(factWords);
  return {
    words: rawWords,
    content: contentTokens(factWords),
    entities: entityPhrases(factText),
    numbers: numberAnchors(factText),
    dates: dateAnchors(factText),
    scalarBindings: scalarBindings(factText),
    predicates,
    directions: directionSignature(factWords),
    comparators: comparatorSignature(factText),
    comparisonBindings: comparisonBindings(factText),
    modality: modality(factText),
    probability: probability(factText),
    force: forceQualifier(factText),
    qualifiers: qualifierAnchors(factText),
    quantityBindings: quantityBindings(factText),
    rangeBindings: rangeBindings(factText),
    quantityAmbiguous: quantityAmbiguous(factText),
    probabilityAmbiguous: probabilityAmbiguous(factText),
    modalityAmbiguous: modalityAmbiguous(factText),
    negative: negativePolarity(factText),
    negativeAbsence: negativeAbsence(factText),
    attributionPublishers: attribution.publishers,
    allPublishersAttribution: attribution.all,
    subject: contentTokens(subjectWords),
    object: contentTokens(objectWords),
    // A predicate-looking participle at the start of a headline (for example,
    // "Verified transaction record") is an adjective, not an agentive verb.
    // Apply ordered subject/object checks only when an explicit subject precedes
    // the first transitive predicate.
    transitive:
      Boolean(predicate && predicate.index > 0) &&
      Boolean(predicate && TRANSITIVE_PREDICATES.has(predicate.predicate)) &&
      contentTokens(subjectWords).size > 0,
    relations: relationTuples(factText, evidence),
    unresolvedPassive: UNRESOLVED_PASSIVE_RE.test(factText),
  };
}

function sentenceClauses(value: string): string[] {
  const primary = value
    .replace(/\r\n?/gu, "\n")
    .split(/\n+|(?<=[.!?])\s+|[;；]+|\s+[—–]\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const atomic: string[] = [];
  for (const part of primary) {
    const candidates = part.split(/,?\s+\b(?:but|whereas|while|yet)\b\s+/iu);
    for (const candidate of candidates) {
      // Keep `and` intact. Splitting it deterministically confuses coordinated
      // proper-name objects (for example, Al Maryah Island and Al Reem Island).
      // A clause carrying opposed directions is rejected by isMixedSignature.
      atomic.push(candidate.trim());
    }
  }
  return atomic;
}

function sourceWindows(evidence: readonly ClaimSupportEvidence[]): SourceWindow[] {
  const windows: SourceWindow[] = [];
  evidence.forEach((record, evidenceIndex) => {
    const clauses = sentenceClauses(record.text);
    const aliases = aliasesForEvidence(record);
    for (let index = 0; index < clauses.length; index += 1) {
      const text = clauses[index];
      const tokens = words(text);
      if (tokens.length === 0 || tokens.length > MAX_SOURCE_WINDOW_WORDS) continue;
      windows.push({
        evidenceIndex,
        url: record.url,
        publisher: record.publisher,
        publisherDomain: canonicalPublisherDomain(record),
        aliases,
        text,
        tokens,
        signature: signature(text, evidence),
        fiveGrams: ngrams(tokens, 5),
        fourteenGrams: ngrams(tokens, COPY_CONTIGUOUS_WORDS),
        joinedTokens: tokens.join(" "),
      });
    }
  });
  return windows;
}

function intersectionSize(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function isSubset(needles: ReadonlySet<string>, haystack: ReadonlySet<string>): boolean {
  for (const value of needles) if (!haystack.has(value)) return false;
  return true;
}

function scalarBindingsCompatible(
  claimBindings: ReadonlySet<string>,
  sourceBindings: ReadonlySet<string>,
): boolean {
  const parse = (binding: string) => {
    const firstSeparator = binding.indexOf(":");
    const lastSeparator = binding.lastIndexOf(":");
    if (firstSeparator <= 0 || lastSeparator <= firstSeparator) return null;
    return {
      kind: binding.slice(0, firstSeparator),
      scalar: binding.slice(firstSeparator + 1, lastSeparator),
      anchors: new Set(
        binding.slice(lastSeparator + 1).split(">").filter(Boolean),
      ),
    };
  };
  return [...claimBindings].every((claimBinding) => {
    const claim = parse(claimBinding);
    if (!claim) return false;
    return [...sourceBindings].some((sourceBinding) => {
      const source = parse(sourceBinding);
      if (!source || claim.kind !== source.kind || claim.scalar !== source.scalar) {
        return false;
      }
      return (
        claim.anchors.size > 0 &&
        source.anchors.size > 0 &&
        intersectionSize(claim.anchors, source.anchors) > 0
      );
    });
  });
}

function entitySupported(entity: string, window: SourceWindow): boolean {
  if (containsPhrase(window.text, entity)) return true;
  const expansion = ACRONYM_EXPANSIONS[entity];
  if (expansion) {
    const expanded = expansion.map(stem).join(" ");
    if (containsPhrase(window.text, expanded)) return true;
  }
  for (const [acronym, words] of Object.entries(ACRONYM_EXPANSIONS)) {
    if (
      entity === words.map(stem).join(" ") &&
      containsPhrase(window.text, acronym)
    ) {
      return true;
    }
  }
  return false;
}

function predicatesCompatible(claim: Signature, source: Signature): boolean {
  if (claim.predicates.size === 0) return true;
  return isSubset(claim.predicates, source.predicates);
}

function probabilityCompatible(
  claim: ProbabilityQualifier,
  source: ProbabilityQualifier,
): boolean {
  if (claim === "none") return source === "none";
  if (claim === "unlikely") return source === "unlikely";
  if (claim === "impossible") return source === "impossible";
  if (claim === "hedged") return source === "hedged";
  if (claim === "certain") return source === "certain";
  if (claim === "almost-certain") {
    return source === "almost-certain" || source === "certain";
  }
  if (claim === "likely") {
    return (
      source === "likely" ||
      source === "almost-certain" ||
      source === "certain"
    );
  }
  // A possibility claim is a conservative weakening of likely or unqualified
  // support for the same atomic outcome, but never of an unlikely outcome or
  // of an unqualified assertion whose temporal force is not explicit.
  return (
    source === "possible" ||
    source === "likely" ||
    source === "almost-certain" ||
    source === "certain" ||
    source === "impossible"
  );
}

function quantityQualifierCompatible(
  claim: QuantityQualifier,
  source: QuantityQualifier,
): boolean {
  if (claim === "exact") return source === "exact";
  if (claim === "approximate") {
    return source === "exact" || source === "approximate";
  }
  if (claim === "lower-inclusive") {
    return (
      source === "exact" ||
      source === "lower-inclusive" ||
      source === "lower-exclusive"
    );
  }
  if (claim === "upper-inclusive") {
    return (
      source === "exact" ||
      source === "upper-inclusive" ||
      source === "upper-exclusive"
    );
  }
  return claim === source;
}

function quantityBindingsCompatible(
  claimBindings: ReadonlySet<string>,
  sourceBindings: ReadonlySet<string>,
): boolean {
  return [...claimBindings].every((claimBinding) => {
    const separator = claimBinding.lastIndexOf(":");
    if (separator <= 0) return false;
    const scalar = claimBinding.slice(0, separator);
    const qualifier = claimBinding.slice(separator + 1) as QuantityQualifier;
    return [...sourceBindings].some((sourceBinding) => {
      const sourceSeparator = sourceBinding.lastIndexOf(":");
      if (sourceSeparator <= 0 || sourceBinding.slice(0, sourceSeparator) !== scalar) {
        return false;
      }
      return quantityQualifierCompatible(
        qualifier,
        sourceBinding.slice(sourceSeparator + 1) as QuantityQualifier,
      );
    });
  });
}

const SCALAR_BOUND_COMPARATORS = new Set(["more-than", "less-than"]);

function comparatorAnchorsCompatible(
  claim: Pick<Signature, "comparators" | "quantityBindings">,
  source: Pick<Signature, "comparators" | "quantityBindings">,
): boolean {
  for (const comparator of claim.comparators) {
    if (
      claim.quantityBindings.size > 0 &&
      SCALAR_BOUND_COMPARATORS.has(comparator)
    ) {
      // Bound direction and inclusivity are checked per scalar rather than as
      // an unbound clause-level token.
      continue;
    }
    if (!source.comparators.has(comparator)) return false;
  }
  return true;
}

function relationTupleCompatible(
  claim: RelationTuple,
  source: RelationTuple,
): boolean {
  if (claim.quantityAmbiguous || source.quantityAmbiguous) return false;
  if (claim.subjectKey !== source.subjectKey) return false;
  if (claim.predicate !== source.predicate) return false;
  if (
    TRANSITIVE_PREDICATES.has(claim.predicate) &&
    !isSubset(claim.object, source.object)
  ) {
    return false;
  }
  if (!isSubset(claim.numbers, source.numbers)) return false;
  if (!isSubset(claim.dates, source.dates)) return false;
  if (!scalarBindingsCompatible(claim.scalarBindings, source.scalarBindings)) {
    return false;
  }
  if (!quantityBindingsCompatible(claim.quantityBindings, source.quantityBindings)) {
    return false;
  }
  if (!isSubset(claim.rangeBindings, source.rangeBindings)) return false;
  if (!isSubset(claim.directions, source.directions)) return false;
  if (!comparatorAnchorsCompatible(claim, source)) return false;
  if (!isSubset(claim.comparisonBindings, source.comparisonBindings)) return false;
  if (
    claim.modality === "unresolved" ||
    source.modality === "unresolved" ||
    claim.modality !== source.modality
  ) {
    return false;
  }
  if (!probabilityCompatible(claim.probability, source.probability)) return false;
  if (claim.force !== source.force) return false;
  if (!isSubset(claim.qualifiers, source.qualifiers)) return false;
  return claim.negative === source.negative;
}

function atomicRelationsCompatible(
  claim: Signature,
  source: Signature,
): boolean {
  if (claim.relations.length === 0) return true;
  return claim.relations.every((claimRelation) =>
    source.relations.some((sourceRelation) =>
      relationTupleCompatible(claimRelation, sourceRelation),
    ),
  );
}

function numericOnlyRelationSupported(
  claim: Signature,
  source: Signature,
): boolean {
  if (claim.relations.length !== 1) return false;
  const relation = claim.relations[0];
  if (
    relation.object.size > 0 ||
    (relation.numbers.size === 0 && relation.dates.size === 0) ||
    relation.scalarBindings.size === 0
  ) {
    return false;
  }
  return source.relations.some((candidate) =>
    relationTupleCompatible(relation, candidate),
  );
}

function modalityCompatible(claim: Signature, source: Signature): boolean {
  return (
    claim.modality !== "unresolved" &&
    source.modality !== "unresolved" &&
    claim.modality === source.modality
  );
}

function positionalRolesCompatible(claim: Signature, source: Signature): boolean {
  if (!claim.transitive) return true;
  if (
    claim.subject.size === 0 ||
    intersectionSize(claim.subject, source.subject) === 0
  ) {
    return false;
  }
  if (claim.object.size > 0) {
    return intersectionSize(claim.object, source.object) > 0;
  }
  // A bounded fact such as "DLD reported AED 10 million" has a numeric-only
  // grammatical object. The exact scalar-to-subject binding is checked just
  // above this role check; requiring a noun token as well would make this safe,
  // common source form impossible to support. Empty non-scalar objects remain
  // fail-closed.
  return (
    (claim.numbers.size > 0 || claim.dates.size > 0) &&
    claim.scalarBindings.size > 0
  );
}

function signaturesCompatible(
  claim: Signature,
  source: Signature,
  window: SourceWindow,
): boolean {
  return compatibilityFailures(claim, source, window).length === 0;
}

function compatibilityFailures(
  claim: Signature,
  source: Signature,
  window: SourceWindow,
): string[] {
  const failures: string[] = [];
  const numericOnlyAtomicMatch = numericOnlyRelationSupported(claim, source);
  if (
    claim.content.size < MIN_DISTINCTIVE_ANCHORS &&
    !numericOnlyAtomicMatch
  ) {
    failures.push("fewer than two distinctive claim anchors");
  }
  if (
    intersectionSize(claim.content, source.content) < MIN_DISTINCTIVE_ANCHORS &&
    !numericOnlyAtomicMatch
  ) {
    failures.push("fewer than two shared object/noun anchors");
  }
  if (
    claim.predicates.size === 0 &&
    !isSubset(claim.content, source.content)
  ) {
    failures.push("predicate-free title or fragment anchors differ");
  }
  const missingEntities = [...claim.entities].filter(
    (entity) => !entitySupported(entity, window),
  );
  failures.push(
    ...missingEntities.map((entity) => `entity binding differs: ${entity}`),
  );
  if (!isSubset(claim.numbers, source.numbers)) failures.push("numeric anchors differ");
  if (!isSubset(claim.dates, source.dates)) failures.push("date anchors differ");
  if (!scalarBindingsCompatible(claim.scalarBindings, source.scalarBindings)) {
    const missingBindings = [...claim.scalarBindings].filter(
      (binding) => !scalarBindingsCompatible(new Set([binding]), source.scalarBindings),
    );
    failures.push(
      `number/date-to-object bindings differ${missingBindings.length ? `: ${missingBindings.join(", ")}` : ""}`,
    );
  }
  if (!predicatesCompatible(claim, source)) failures.push("predicate anchors differ");
  if (!isSubset(claim.directions, source.directions)) failures.push("direction anchors differ");
  if (!quantityBindingsCompatible(claim.quantityBindings, source.quantityBindings)) {
    failures.push("numeric exactness or bound qualifiers differ");
  }
  if (!isSubset(claim.rangeBindings, source.rangeBindings)) {
    failures.push("ordered numeric range bindings differ");
  }
  if (source.quantityAmbiguous) {
    failures.push("source quantity qualifiers are compound or ambiguous");
  }
  if (!comparatorAnchorsCompatible(claim, source)) failures.push("comparator anchors differ");
  if (!isSubset(claim.comparisonBindings, source.comparisonBindings)) {
    failures.push("ordered comparison operands differ");
  }
  if (!modalityCompatible(claim, source)) failures.push("modality differs");
  if (!probabilityCompatible(claim.probability, source.probability)) {
    failures.push("probability polarity or strength differs");
  }
  if (claim.force !== source.force) {
    failures.push("necessity or normative qualifier differs");
  }
  if (!isSubset(claim.qualifiers, source.qualifiers)) {
    failures.push("intensity qualifiers differ");
  }
  if (source.probabilityAmbiguous) {
    failures.push("source probability qualifiers are ambiguous");
  }
  if (source.modalityAmbiguous) {
    failures.push("source future-modality qualifiers are ambiguous");
  }
  if (claim.negative !== source.negative) failures.push("polarity differs");
  if (claim.negativeAbsence && !source.negativeAbsence) failures.push("absence is not explicit");
  if (!positionalRolesCompatible(claim, source)) failures.push("subject/object roles differ");
  if (!atomicRelationsCompatible(claim, source)) {
    failures.push("atomic subject-action-fact tuples differ");
  }
  return failures;
}

function ngrams(input: string[], size: number): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index + size <= input.length; index += 1) {
    result.add(input.slice(index, index + size).join(" "));
  }
  return result;
}

interface PreparedOriginality {
  words: string[];
  fiveGrams: Set<string>;
  fourteenGrams: Set<string>;
  joinedTokens: string;
}

function prepareOriginality(value: string): PreparedOriginality {
  const preparedWords = words(value);
  return {
    words: preparedWords,
    fiveGrams: ngrams(preparedWords, 5),
    fourteenGrams: ngrams(preparedWords, COPY_CONTIGUOUS_WORDS),
    joinedTokens: preparedWords.join(" "),
  };
}

function exceedsOriginalityCeiling(
  claim: PreparedOriginality,
  window: SourceWindow,
): boolean {
  if (claim.words.length < 8) return false;
  const copiedRun = claim.words.length < COPY_CONTIGUOUS_WORDS
    ? ` ${window.joinedTokens} `.includes(` ${claim.joinedTokens} `)
    : intersectionSize(claim.fourteenGrams, window.fourteenGrams) > 0;
  if (copiedRun) return true;
  if (claim.fiveGrams.size === 0) return false;
  const ceiling = claim.words.length < COPY_MIN_WORDS
    ? Math.max(COPY_FIVE_GRAM_RATIO, 0.85)
    : COPY_FIVE_GRAM_RATIO;
  return intersectionSize(claim.fiveGrams, window.fiveGrams) /
    claim.fiveGrams.size >= ceiling;
}

function isMixedSignature(sig: Signature): boolean {
  return (
    sig.directions.size > 1 ||
    sig.predicates.size > 3 ||
    sig.quantityAmbiguous ||
    sig.probabilityAmbiguous ||
    sig.modalityAmbiguous
  );
}

function factualClause(sig: Signature, text: string): boolean {
  return (
    sig.numbers.size > 0 ||
    sig.dates.size > 0 ||
    sig.predicates.size > 0 ||
    sig.negativeAbsence ||
    sig.entities.size > 0 ||
    HIGH_RISK_RE.test(text)
  );
}

function editorialAnalysisAllowed(input: {
  clause: AtomicClause;
  sig: Signature;
  previousSupported: Signature | null;
  fieldAllowsEditorial: boolean;
}): boolean {
  const { clause, sig, previousSupported, fieldAllowsEditorial } = input;
  if (!fieldAllowsEditorial || !previousSupported) return false;
  if (sig.words.length > MAX_EDITORIAL_WORDS) return false;
  if (sig.numbers.size > 0 || sig.dates.size > 0 || sig.entities.size > 0) return false;
  if (sig.negativeAbsence || EDITORIAL_DISALLOWED_RE.test(clause.text)) return false;
  if (!PREMISE_REFERENCE_RE.test(clause.text)) return false;
  const overlap = intersectionSize(sig.content, previousSupported.content);
  if (overlap < MIN_DISTINCTIVE_ANCHORS) return false;
  const allowed = new Set([
    ...previousSupported.content,
    ...[...EDITORIAL_VOCABULARY].map(stem),
  ]);
  return isSubset(sig.content, allowed);
}

function fieldAllowsEditorial(field: string): boolean {
  return (
    field === "body" ||
    field === "semaform.theTake" ||
    field === "semaform.realityCheck"
  );
}

function fieldRequiresDirectSupport(field: string): boolean {
  return (
    field === "title" ||
    field === "subtitle" ||
    /^tldr\[/u.test(field) ||
    /^faq\[\d+\]\.a$/u.test(field) ||
    (field.startsWith("semaform.") && !/\.q$/u.test(field))
  );
}

function isTradeField(field: string): boolean {
  return field.startsWith("semaform.howIdTradeIt");
}

function boundedClauseLabel(value: string): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}

/**
 * Assess reader-visible clauses against immutable fetched publisher text.
 * The result proves a conservative anchor match only, never truth or entailment.
 */
export function assessClaimSupport(input: {
  segments: readonly ClaimSupportSegment[];
  evidence: readonly ClaimSupportEvidence[];
}): ClaimSupportAssessment {
  const clauses: AtomicClause[] = input.segments.flatMap((segment, segmentIndex) =>
    sentenceClauses(segment.text).map((text, clauseIndex) => ({
      field: segment.field,
      text,
      segmentIndex,
      clauseIndex,
    })),
  );
  const windows = sourceWindows(input.evidence);
  const usedEvidence = new Set<number>();
  const supported: AnchorSupportedClaim[] = [];
  const failures: ClaimSupportFailure[] = [];
  const supportedPremisesBySegment = new Map<number, Signature[]>();
  const checkedBodyClauseKeys: string[] = [];
  const editorialBodyClauseKeys = new Set<string>();
  let checkedClauseCount = 0;

  for (const clause of clauses) {
    const sig = signature(clause.text, input.evidence);
    const originality = prepareOriginality(clause.text);
    const trade = isTradeField(clause.field);
    const requiresDirectSupport =
      fieldRequiresDirectSupport(clause.field) && sig.words.length >= 2;
    const isFactual =
      factualClause(sig, clause.text) || trade || requiresDirectSupport;
    const editorialCandidate =
      !isFactual &&
      fieldAllowsEditorial(clause.field) &&
      sig.content.size >= MIN_DISTINCTIVE_ANCHORS;
    // A short non-assertive headline/label is not a factual clause. Body and
    // named editorial sections still have to satisfy the premise allowance.
    if (!isFactual && !editorialCandidate) continue;
    checkedClauseCount += 1;
    const clauseKey = `${clause.segmentIndex}:${clause.clauseIndex}`;
    if (clause.field === "body") checkedBodyClauseKeys.push(clauseKey);

    if (trade && sig.words.length < 4) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "trade-call",
        detail: "a trade call is not source-free and has no complete anchor-supported claim",
      });
      continue;
    }
    if (sig.unresolvedPassive) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "unsupported",
        detail: "the passive factual subject cannot be bound to one explicit atomic relation",
      });
      continue;
    }
    if (isMixedSignature(sig)) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "mixed-signature",
        detail: "the clause mixes conflicting or over-broad fact signatures",
      });
      continue;
    }
    if (
      isFactual &&
      !trade &&
      sig.predicates.size === 0 &&
      sig.numbers.size === 0 &&
      sig.dates.size === 0 &&
      sig.comparisonBindings.size === 0 &&
      clause.field !== "title"
    ) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "unsupported",
        detail: "the declarative factual clause has no recognised source-alignable predicate",
      });
      continue;
    }
    const distinctEvidenceDomains = new Set(
      input.evidence.map(canonicalPublisherDomain),
    );
    if (
      sig.allPublishersAttribution &&
      (input.evidence.length !== 2 || distinctEvidenceDomains.size !== 2)
    ) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "mixed-signature",
        detail: '"both sources" is ambiguous unless exactly two independent canonical publishers are cited',
      });
      continue;
    }
    const attributionStrippedClause = stripPublisherAttribution(
      clause.text,
      input.evidence,
    ).trim();
    if (
      isFactual &&
      (PRONOUN_SUBJECT_RE.test(attributionStrippedClause) ||
        (POSSESSIVE_PRONOUN_SUBJECT_RE.test(attributionStrippedClause) &&
          sig.attributionPublishers.size === 0))
    ) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "ambiguous-pronoun",
        detail: "the factual clause has no explicit bound subject or entity",
      });
      continue;
    }

    const editorialPremises =
      supportedPremisesBySegment.get(clause.segmentIndex) ?? [];
    if (
      !isFactual &&
      editorialPremises.some((previousSupported) =>
        editorialAnalysisAllowed({
          clause,
          sig,
          previousSupported,
          fieldAllowsEditorial: fieldAllowsEditorial(clause.field),
        }),
      )
    ) {
      supported.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        evidenceUrls: [],
        verdict: "anchor-supported",
        editorial: true,
      });
      if (clause.field === "body") editorialBodyClauseKeys.add(clauseKey);
      continue;
    }
    if (!isFactual) {
      failures.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        code: "unsupported",
        detail: "non-factual prose falls outside the tightly bounded premise-derived editorial allowance",
      });
      continue;
    }

    const eligibleWindows = windows.filter((window) => {
      if (
        sig.attributionPublishers.size > 0 &&
        !sig.attributionPublishers.has(window.evidenceIndex)
      ) {
        return false;
      }
      return signaturesCompatible(
        sig,
        window.signature,
        window,
      );
    });
    const copiedFromAnySource = windows.some((window) =>
      exceedsOriginalityCeiling(originality, window),
    );
    const nonCopied = copiedFromAnySource ? [] : eligibleWindows;
    const matchedPublisherIndexes = new Set(
      nonCopied.map((window) => window.evidenceIndex),
    );
    const matchedPublisherDomains = new Set(
      nonCopied.map((window) => window.publisherDomain),
    );
    const highRisk =
      sig.modality !== "asserted" ||
      sig.probability !== "none" ||
      HIGH_RISK_RE.test(clause.text) ||
      trade;
    const requiredPublisherDomains = new Set(
      [...sig.attributionPublishers].map((index) =>
        canonicalPublisherDomain(input.evidence[index]),
      ),
    );
    if (sig.allPublishersAttribution) {
      for (const domain of distinctEvidenceDomains) {
        requiredPublisherDomains.add(domain);
      }
    }
    const publisherBindingSatisfied = [...requiredPublisherDomains].every((domain) =>
      matchedPublisherDomains.has(domain),
    );
    const enoughPublishers = highRisk
      ? matchedPublisherDomains.size >= 2
      : matchedPublisherDomains.size >= 1;

    if (nonCopied.length > 0 && publisherBindingSatisfied && enoughPublishers) {
      for (const index of matchedPublisherIndexes) usedEvidence.add(index);
      supported.push({
        field: clause.field,
        clause: boundedClauseLabel(clause.text),
        evidenceUrls: [...matchedPublisherIndexes].map(
          (index) => input.evidence[index].url,
        ),
        verdict: "anchor-supported",
        editorial: false,
      });
      supportedPremisesBySegment.set(
        clause.segmentIndex,
        [...editorialPremises, sig].slice(-5),
      );
      continue;
    }

    const copiedOnly = copiedFromAnySource;
    const rankedWindowFailures = windows
      .filter(
        (window) =>
          sig.attributionPublishers.size === 0 ||
          sig.attributionPublishers.has(window.evidenceIndex),
      )
      .map((window) => ({
        publisher: window.publisher,
        text: boundedClauseLabel(window.text),
        failures: compatibilityFailures(
          sig,
          window.signature,
          window,
        ),
      }))
      .sort((left, right) => left.failures.length - right.failures.length);
    const closestWindowFailure = rankedWindowFailures[0];
    failures.push({
      field: clause.field,
      clause: boundedClauseLabel(clause.text),
      code: copiedOnly
        ? "source-copying"
        : sig.negativeAbsence
          ? "negative-absence"
          : trade
            ? "trade-call"
            : "unsupported",
      detail: copiedOnly
        ? "all matching source windows exceed the originality ceiling"
        : sig.negativeAbsence
          ? "a negative absence claim requires an explicit matching absence statement in fetched evidence"
          : !publisherBindingSatisfied
            ? `an explicitly named publisher lacks a compatible bounded source window (${[...requiredPublisherDomains].filter((domain) => !matchedPublisherDomains.has(domain)).join(", ")})`
          : highRisk && matchedPublisherDomains.size < 2
            ? `a forecast, outcome, causal, comparison or trade claim lacks two anchor-supporting publishers${closestWindowFailure?.failures.length ? ` (${closestWindowFailure.failures.join(", ")}; closest publisher: ${closestWindowFailure.publisher})` : ""}`
          : `no bounded fetched-evidence window carries the same conservative fact signature${closestWindowFailure?.failures.length ? ` (${closestWindowFailure.failures.join(", ")}; closest publisher: ${closestWindowFailure.publisher})` : ""}`,
    });
  }

  const maxEditorialBodyClauses = Math.floor(
    checkedBodyClauseKeys.length * 0.2,
  );
  if (editorialBodyClauseKeys.size > maxEditorialBodyClauses) {
    failures.push({
      field: "body",
      clause: "editorial analysis ratio",
      code: "editorial-overreach",
      detail: `premise-derived editorial analysis occupies ${editorialBodyClauseKeys.size}/${checkedBodyClauseKeys.length} checked body clauses (maximum 20%)`,
    });
  }
  let consecutiveEditorial = 0;
  for (const key of checkedBodyClauseKeys) {
    consecutiveEditorial = editorialBodyClauseKeys.has(key)
      ? consecutiveEditorial + 1
      : 0;
    if (consecutiveEditorial > 2) {
      failures.push({
        field: "body",
        clause: "consecutive editorial analysis",
        code: "editorial-overreach",
        detail: "premise-derived editorial analysis exceeds two consecutive body clauses",
      });
      break;
    }
  }

  const unusedEvidenceUrls = input.evidence
    .map((record, index) => ({ record, index }))
    .filter(({ index }) => !usedEvidence.has(index))
    .map(({ record }) => record.url);
  const ok = failures.length === 0 && unusedEvidenceUrls.length === 0;
  return {
    ok,
    verdict: ok ? "anchor-supported" : "manual",
    checkedClauseCount,
    supported,
    failures,
    unusedEvidenceUrls,
  };
}

const CORPORATE_BOUND_SUBJECT = "BoundCorporation";
const CORPORATE_ANNOUNCEMENT_PROHIBITED_RE =
  /\b(?:will|shall|would|could|may|might|expect(?:s|ed)?|forecast(?:s|ed)?|predict(?:s|ed)?|projected|guarantee(?:d|s)?|promise(?:d|s)?|pledge(?:d|s)?|commit(?:ted|s)?|yield|returns?|profits?|upside|downside|outperform|underperform|recommend|buyers?|investors?|demand|prices?|values?|wealth|lucrative|prime|luxury|exclusive|best|leading|unrivalled|unmatched|because|therefore|consequently)\b/iu;
// Conditional intent is manual-only until its condition has a separately
// validated representation. A source condition must never disappear when
// an inner statement or coordinated clause is extracted for matching.
const CORPORATE_INTENT_CONDITION_RE =
  /\b(?:if|unless|until|once|upon|pending|provided|providing|subject\s+to|conditional(?:ly)?|conditioned\s+on|on\s+(?:the\s+)?condition|contingent\s+on|depend(?:s|ent|ing)?\s+on|awaiting|approval|approvals)\b/iu;

function announcementRegexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function announcementPublisherPattern(value: string): string {
  // Publisher registry aliases are lowercase. Match their display casing
  // without making the independent speaker/organization grammar insensitive.
  return [...value].map((character) => character.toLowerCase() !== character.toUpperCase()
    ? `[${announcementRegexEscape(character.toLowerCase())}${announcementRegexEscape(character.toUpperCase())}]`
    : announcementRegexEscape(character)).join("");
}

function announcementOrganizationAliases(organization: string): string[] {
  const aliases = [organization];
  const shorter = organization.replace(/\s+(?:Developments|Properties|Holdings|Group)$/u, "");
  if (shorter !== organization && words(shorter).length >= 2) aliases.push(shorter);
  return aliases.sort((left, right) => right.length - left.length);
}

function normalizeCorporateSubject(value: string, aliases: readonly string[], bindCompanyPronoun = false): string {
  const alias = aliases.map(announcementRegexEscape).join("|");
  const named = value.replace(new RegExp(`\\b(?:${alias})\\b`, "gu"), CORPORATE_BOUND_SUBJECT);
  let fact = bindCompanyPronoun ? named.replace(/^the (?:company|developer)\b/iu, CORPORATE_BOUND_SUBJECT) : named;
  const amount = "AED\\s*\\d[\\d,.]*(?:\\s+(?:billion|million|thousand))?(?:\\s+to\\s+AED\\s*\\d[\\d,.]*(?:\\s+(?:billion|million|thousand))?)?";
  // Controlled nominal/verb alternations describe the same corporate intent.
  // Nothing is dropped from the amount, place, date or object payload.
  fact = fact
    .replace(new RegExp(`^${CORPORATE_BOUND_SUBJECT} plans (${amount})(?: of)? (Dubai )?investment(?=[.,]|$)`, "u"), (_match, budget: string, city: string | undefined) => `${CORPORATE_BOUND_SUBJECT} plans to invest ${budget}${city ? " in Dubai" : ""}`)
    .replace(new RegExp(`^${CORPORATE_BOUND_SUBJECT}(?:'s)? (Dubai )?plans (?:cover|include|involve) (.+)$`, "u"), (_match, city: string | undefined, object: string) => `${CORPORATE_BOUND_SUBJECT} plans ${object}${city ? " in Dubai" : ""}`)
    .replace(new RegExp(`^${CORPORATE_BOUND_SUBJECT} intends to put the investment towards `, "u"), `${CORPORATE_BOUND_SUBJECT} plans to invest through `)
    .replace(new RegExp(`^${CORPORATE_BOUND_SUBJECT} also plans `, "u"), `${CORPORATE_BOUND_SUBJECT} plans `)
    .replace(/\bland purchases\b/gu, "land acquisitions")
    .replace(/\b(residential|commercial) projects\b/gu, "$1 developments")
    .replace(new RegExp(`^${CORPORATE_BOUND_SUBJECT} plans (?:new )?projects\\b`, "u"), `${CORPORATE_BOUND_SUBJECT} plans developments`)
    .replace(/\bplans (a further )?((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?: to (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten))?) (further )?(?:project )?launches\b/gu, (_match, before: string | undefined, count: string, after: string | undefined) => `plans to launch ${before || after ? "a further " : ""}${count} developments`)
    // Counted projects after a launch are an explicit noun, not a forecast.
    // This local view never changes source bytes or relaxes the general matcher.
    .replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+projects\b/gu, "$1 developments");
  return fact;
}

function stripAnnouncementPublisherAttribution(value: string, evidence: readonly ClaimSupportEvidence[]): string {
  const publishers = evidence.flatMap(rawAliasesForEvidence).sort((left, right) => right.length - left.length).map(announcementPublisherPattern).join("|");
  return stripPublisherAttribution(value.trim().replace(/[.!?]+$/u, ""), evidence)
    .replace(new RegExp(`,\\s*(?:${publishers})\\s+(?:reports|reported|says|said)$`, "u"), "")
    .replace(new RegExp(`,\\s*according to the executive's comments reported by (?:${publishers})$`, "u"), "");
}

interface CorporateSpeech {
  prefix: string;
  fact: string;
}

const CORPORATE_SPEAKER_ROLE_WORDS = new Set(
  `the at of for and chief executive sales financial operating technology marketing commercial officer president vice chair chairman chairwoman founder co-founder managing director head manager general communications development business spokesperson ceo cfo coo cso cto cmo`.split(/\s+/u),
);

/** Parse only a named speech act, not an arbitrary occurrence of `said`. */
function namedCorporateSpeech(
  value: string,
  basis: AnnouncementReportingBasis,
  aliases: readonly string[],
  evidence: readonly ClaimSupportEvidence[],
): CorporateSpeech | null {
  const unwrapped = stripAnnouncementPublisherAttribution(value, evidence).trim();
  const speaker = announcementRegexEscape(basis.speaker);
  const publishers = evidence.flatMap(rawAliasesForEvidence)
    .sort((left, right) => right.length - left.length)
    .map(announcementPublisherPattern).join("|");
  const match = unwrapped.match(new RegExp(
    `^(${speaker}(?:,?\\s+[^.!?]{0,180}?)?)\\s+(?:said|stated|announced|told\\s+(?:${publishers}))\\s+(?:that\\s+)?(.+)$`, "u",
  ));
  if (!match) return null;
  const prefix = match[1].replace(/,\s*$/u, "");
  const role = aliases.reduce((remaining, alias) => remaining.replace(alias, ""), prefix.replace(basis.speaker, ""));
  if (words(role).some((word) => !CORPORATE_SPEAKER_ROLE_WORDS.has(word))) return null;
  const fact = normalizeCorporateSubject(match[2], aliases, true);
  const identityInPrefix = aliases.some((alias) =>
    new RegExp(`\\b(?:at|of|for)\\s+${announcementRegexEscape(alias)}\\b`, "u").test(prefix),
  );
  // A pronoun is bound only by the same named speaker/organization sentence.
  // Otherwise the explicitly named company must be the grammatical subject.
  if (!identityInPrefix && !aliases.some((alias) => match[2].startsWith(`${alias} `))) return null;
  if (!fact.startsWith(`${CORPORATE_BOUND_SUBJECT} `)) return null;
  return { prefix, fact };
}

function corporateStatementParts(fact: string): string[] {
  // Split a repeated corporate subject's coordinated intent without merging
  // a completed launch into its future plan. A count-only second launch object
  // is recovered only from the explicit `launched ... projects` in this sentence.
  const coordinated = fact.match(/^(.+?)\s+and\s+(plans?\s+to\s+launch\s+.+)$/u);
  if (!coordinated) return [fact];
  let continuation = coordinated[2];
  if (/\b(?:launched|launches)\b.*\bdevelopments\b/u.test(coordinated[1])) {
    continuation = continuation.replace(
      /^(plans?\s+to\s+launch\s+(?:a further\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+to\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten))?)(\s+(?:during|in|by)\b.+)$/u,
      "$1 developments$2",
    );
  }
  return [coordinated[1], `${CORPORATE_BOUND_SUBJECT} ${continuation}`];
}

/**
 * A separate source-bound speech lane. It proves that an identified person
 * described a company's intent, never that the future event is true or certain.
 * The ordinary one/two-publisher matcher above is intentionally unchanged.
 */
export function assessAttributedAnnouncement(
  input: AttributedAnnouncementInput,
): AttributedAnnouncementAssessment {
  const invalid = (reason: string): AttributedAnnouncementAssessment => ({
    ok: false,
    reason,
    support: {
      ok: false, verdict: "manual", checkedClauseCount: 0, supported: [],
      failures: [{ field: "reportingBasis", clause: "attributed announcement", code: "unsupported", detail: reason }],
      unusedEvidenceUrls: input.evidence.map((record) => record.url),
    },
  });
  const basis = input.reportingBasis;
  if (input.format !== "short-update" || !["developer-corporate", "launch"].includes(input.category)) {
    return invalid("attributed announcements require short-update developer-corporate or launch format");
  }
  if (!basis || typeof basis !== "object" || Array.isArray(basis) ||
      Object.keys(basis).sort().join(",") !== "organization,sourceUrl,speaker,statementKind" ||
      basis.statementKind !== "corporate-intent" ||
      ![basis.speaker, basis.organization].every((value) => typeof value === "string" && value.trim() === value && value.length >= 3 && value.length <= 120 && /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .&'’()-]+$/u.test(value)) ||
      typeof basis.sourceUrl !== "string") return invalid("invalid corporate announcement reporting basis");
  try {
    const url = new URL(basis.sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return invalid("announcement source must be an exact public HTTPS citation");
  } catch { return invalid("invalid announcement source URL"); }
  if (input.evidence.length !== 1 || input.evidence[0].url !== basis.sourceUrl || input.evidence[0].text.length < 80) {
    return invalid("announcement requires its one exact cited, directly fetched source");
  }
  const rawTexts = [basis.speaker, basis.organization,
    ...input.segments.map((segment) => segment.text),
    ...input.evidence.map((record) => record.text)];
  if (rawTexts.some((text) => text.normalize("NFKC").toLowerCase().includes(CORPORATE_BOUND_SUBJECT.toLowerCase()))) {
    return invalid("raw article, source or identity text contains a reserved internal matching marker");
  }
  if (input.segments.some((segment) => CORPORATE_INTENT_CONDITION_RE.test(segment.text))) {
    return invalid("conditional announcements require manual condition matching");
  }
  const aliases = announcementOrganizationAliases(basis.organization);
  const originalWindows = sourceWindows(input.evidence);
  const sourceRecord = input.evidence[0];
  const sourceFacts: string[] = [];
  const sourcePrefixes: string[] = [];
  let continuations = 0;
  // Do not use the general atomic splitter here: it splits `while` and other
  // joins before a later qualifier can be checked against its whole statement.
  const sourceSentences = sourceRecord.text.replace(/\r\n?/gu, "\n")
    .split(/\n+|(?<=[.!?])\s+/u).map((value) => value.trim()).filter(Boolean);
  for (const clause of sourceSentences) {
    const speech = namedCorporateSpeech(clause, basis, aliases, input.evidence);
    if ((speech || continuations > 0) && CORPORATE_INTENT_CONDITION_RE.test(clause)) {
      return invalid("the named source statement contains a condition that cannot be omitted or matched automatically");
    }
    if (speech) {
      if (words(clause).length > MAX_SOURCE_WINDOW_WORDS) continue;
      sourcePrefixes.push(speech.prefix);
      sourceFacts.push(...corporateStatementParts(speech.fact));
      continuations = 2;
      continue;
    }
    // Only adjacent explicitly reported continuations inherit this speaker.
    const continuation = continuations > 0
      ? clause.match(/^(?:He|She|They)\s+(?:said|stated|added)(?:\s+that)?\s+(the company\s+.+)$/u)
      : null;
    if (continuation && words(clause).length <= MAX_SOURCE_WINDOW_WORDS) {
      sourceFacts.push(...corporateStatementParts(normalizeCorporateSubject(continuation[1], aliases, true)));
      continuations -= 1;
    } else continuations = 0;
  }
  if (sourcePrefixes.length === 0) return invalid("fetched source does not bind the named speaker to this company's statement");
  // These are derived matching views only. Original bytes/hashes and the
  // unmodified originality windows remain the publication evidence.
  const normalizedEvidence = [{ ...sourceRecord, text: sourceFacts.join("\n") }];
  const matchingWindows = sourceWindows(normalizedEvidence).filter((window) =>
    window.signature.modality === "intent" && !isMixedSignature(window.signature) &&
    !CORPORATE_ANNOUNCEMENT_PROHIBITED_RE.test(window.text),
  );
  if (matchingWindows.length === 0) return invalid("named source statement contains no bounded corporate intent");
  const clauses = input.segments.flatMap((segment) => sentenceClauses(segment.text).map((text) => ({ field: segment.field, text })));
  const hasVisibleBodyAttribution = clauses.some((clause) => clause.field === "body" && namedCorporateSpeech(clause.text, basis, aliases, input.evidence));
  if (!hasVisibleBodyAttribution) return invalid("body must visibly identify the named speaker, company and reported statement");
  const supported: AnchorSupportedClaim[] = [];
  const failures: ClaimSupportFailure[] = [];
  for (const clause of clauses) {
    const speech = namedCorporateSpeech(clause.text, basis, aliases, input.evidence);
    // Definite company/developer nouns bind only inside the same explicit
    // named speech statement. A prior article-level binding is not enough:
    // another source-supported company's context may have intervened.
    const fact = speech?.fact ?? normalizeCorporateSubject(stripAnnouncementPublisherAttribution(clause.text, input.evidence).trim(), aliases);
    // Ordinary factual context gets no new exception. It must pass the
    // unchanged matcher against the original, full fetched text, be asserted
    // rather than predictive, and contain no source-free editorial allowance.
    const originalSig = signature(clause.text, input.evidence);
    if (!speech && originalSig.modality === "asserted" && originalSig.probability === "none" &&
        !HIGH_RISK_RE.test(clause.text) && !CORPORATE_ANNOUNCEMENT_PROHIBITED_RE.test(clause.text)) {
      const contextSupport = assessClaimSupport({ segments: [{ field: clause.field, text: clause.text }], evidence: input.evidence });
      if (contextSupport.ok && contextSupport.supported.length > 0 && contextSupport.supported.every((claim) => !claim.editorial)) {
        supported.push(...contextSupport.supported);
        continue;
      }
    }
    let problem: string | null = null;
    if (speech && !sourcePrefixes.some((prefix) => isSubset(contentTokens(words(speech.prefix)), contentTokens(words(prefix))))) {
      problem = "the stated speaker role or company attribution is not supported by the source";
    }
    if (!fact.startsWith(`${CORPORATE_BOUND_SUBJECT} `) && !fact.startsWith(`${CORPORATE_BOUND_SUBJECT}'s `)) {
      problem ??= "every announcement clause must explicitly name the bound company as its subject";
    }
    const sig = signature(fact, normalizedEvidence);
    if (sig.modality !== "intent" || isMixedSignature(sig) || sig.probability !== "none" || sig.force !== "none" || sig.negative || sig.unresolvedPassive || CORPORATE_ANNOUNCEMENT_PROHIBITED_RE.test(fact)) {
      problem ??= "announcement clauses must retain corporate intent without predictions, completed outcomes, promotion or investment conclusions";
    }
    const matching = matchingWindows.filter((window) => signaturesCompatible(sig, window.signature, window));
    const copied = originalWindows.some((window) => exceedsOriginalityCeiling(prepareOriginality(clause.text), window));
    if (copied) problem ??= "announcement clause exceeds the unchanged source-originality ceiling";
    if (matching.length === 0) {
      const closest = matchingWindows.map((window) => compatibilityFailures(sig, window.signature, window)).sort((left, right) => left.length - right.length)[0];
      problem ??= `no named-speaker source statement carries the same conservative intent signature${closest?.length ? ` (${closest.join(", ")})` : ""}`;
    }
    if (problem) failures.push({ field: clause.field, clause: boundedClauseLabel(clause.text), code: copied ? "source-copying" : "unsupported", detail: problem });
    else supported.push({ field: clause.field, clause: boundedClauseLabel(clause.text), evidenceUrls: [sourceRecord.url], verdict: "anchor-supported", editorial: false });
  }
  const ok = clauses.length > 0 && failures.length === 0;
  const support: ClaimSupportAssessment = {
    ok, verdict: ok ? "anchor-supported" : "manual", checkedClauseCount: clauses.length,
    supported, failures, unusedEvidenceUrls: supported.length > 0 ? [] : [sourceRecord.url],
  };
  return { ok, reason: ok ? "named corporate intent is attributed and matched to one directly fetched source" : failures[0]?.detail ?? "announcement has no factual clauses", support };
}
