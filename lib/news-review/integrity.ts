import { createHash } from "node:crypto";

import type { NewsCategory } from "@/content/news/types";
import type {
  DraftArticle,
  EvidenceApproval,
  MediaApprovalLedger,
  NewsDraftProvenance,
} from "@/lib/news-review/types";
import { dubaiCalendarDate } from "@/lib/dubai-time";

export const MAX_NEWS_SLUG_LENGTH = 80;
export const CANONICAL_NEWS_SLUG =
  /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CATEGORIES = new Set<NewsCategory>([
  "market-pulse",
  "launch",
  "regulatory",
  "macro",
  "developer-corporate",
  "infrastructure",
  "policy",
]);
const MARKETS = new Set([
  "Dubai",
  "Abu Dhabi",
  "Ras Al Khaimah",
  "UAE",
  "GCC",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function validHttpsUrl(value: unknown, maximum = 2_048): value is string {
  if (!boundedString(value, 1, maximum)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443")
    );
  } catch {
    return false;
  }
}

function validIso(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function realCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validDistribution(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const topKeys = new Set(["postiz", "repost", "telegram", "discord"]);
  if (Object.keys(value).some((key) => !topKeys.has(key))) return false;
  for (const key of ["telegram", "discord"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") return false;
  }
  for (const key of ["postiz", "repost"]) {
    const nested = value[key];
    if (nested === undefined) continue;
    const allowedNested =
      key === "postiz"
        ? new Set([
            "linkedin",
            "x",
            "fb",
            "ig",
            "threads",
            "tiktok",
            "pinterest",
            "bluesky",
            "mastodon",
            "youtube",
          ])
        : new Set(["medium", "substack", "beehiiv"]);
    if (
      !isRecord(nested) ||
      Object.keys(nested).some((nestedKey) => !allowedNested.has(nestedKey)) ||
      Object.values(nested).some((item) => typeof item !== "boolean")
    ) {
      return false;
    }
  }
  return true;
}

function validSemaform(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const allowed = new Set([
    "theTake",
    "viewsFrom",
    "realityCheck",
    "whatHappensNext",
    "howIdTradeIt",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  for (const key of ["theTake", "realityCheck", "whatHappensNext"]) {
    if (
      value[key] !== undefined &&
      !boundedString(value[key], 1, 4_000)
    ) {
      return false;
    }
  }
  if (
    value.viewsFrom !== undefined &&
    (!Array.isArray(value.viewsFrom) ||
      value.viewsFrom.length > 8 ||
      value.viewsFrom.some(
        (view) =>
          !isRecord(view) ||
          Object.keys(view).some(
            (key) => !new Set(["source", "role", "view"]).has(key),
          ) ||
          !boundedString(view.source, 1, 240) ||
          (view.role !== undefined && !boundedString(view.role, 1, 240)) ||
          !boundedString(view.view, 1, 4_000),
      ))
  ) {
    return false;
  }
  if (value.howIdTradeIt !== undefined) {
    const trade = value.howIdTradeIt;
    const actions = new Set([
      "Buy",
      "Watch",
      "Avoid",
      "Trim",
      "Re-rate",
      "Position",
    ]);
    if (
      !isRecord(trade) ||
      Object.keys(trade).some(
        (key) => !new Set(["action", "reasoning", "horizon"]).has(key),
      ) ||
      typeof trade.action !== "string" ||
      !actions.has(trade.action) ||
      !boundedString(trade.reasoning, 1, 4_000) ||
      (trade.horizon !== undefined &&
        !boundedString(trade.horizon, 1, 240))
    ) {
      return false;
    }
  }
  return true;
}

export function isCanonicalNewsSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_NEWS_SLUG_LENGTH &&
    CANONICAL_NEWS_SLUG.test(value) &&
    realCalendarDate(value.slice(0, 10))
  );
}

export function assertCanonicalNewsSlug(value: unknown): asserts value is string {
  if (!isCanonicalNewsSlug(value)) {
    throw new Error(
      "Slug must be a bounded YYYY-MM-DD kebab-case value containing only lowercase ASCII letters and digits.",
    );
  }
}

export function validateDraftArticleShape(
  value: unknown,
): { ok: true; article: DraftArticle } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "article must be a JSON object." };
  }
  const allowedTopLevel = new Set([
    "slug",
    "title",
    "subtitle",
    "publishedAt",
    "modifiedAt",
    "displayDate",
    "author",
    "tier",
    "category",
    "market",
    "tldr",
    "body",
    "faq",
    "citations",
    "heroImage",
    "cta",
    "distribution",
    "metaDescription",
    "speakableSelector",
    "semaform",
  ]);
  if (Object.keys(value).some((key) => !allowedTopLevel.has(key))) {
    return {
      ok: false,
      error: "article contains an unsupported or publication-state field.",
    };
  }
  if (!isCanonicalNewsSlug(value.slug)) {
    return { ok: false, error: "article.slug is not canonical or bounded." };
  }
  if (!boundedString(value.title, 8, 90)) {
    return { ok: false, error: "article.title must contain 8-90 characters." };
  }
  if (!boundedString(value.subtitle, 1, 300)) {
    return { ok: false, error: "article.subtitle is invalid." };
  }
  if (!validIso(value.publishedAt) || !validIso(value.modifiedAt)) {
    return {
      ok: false,
      error: "article publication timestamps must be valid ISO timestamps.",
    };
  }
  const publishedAt = Date.parse(value.publishedAt);
  const modifiedAt = Date.parse(value.modifiedAt);
  if (publishedAt > Date.now() + 5 * 60 * 1_000) {
    return { ok: false, error: "article.publishedAt cannot be in the future." };
  }
  if (modifiedAt < publishedAt) {
    return {
      ok: false,
      error: "article.modifiedAt cannot precede article.publishedAt.",
    };
  }
  const dubaiDate = dubaiCalendarDate(publishedAt);
  if (value.slug.slice(0, 10) !== dubaiDate) {
    return {
      ok: false,
      error:
        "article.slug date must match article.publishedAt in the Dubai editorial timezone.",
    };
  }
  if (!boundedString(value.displayDate, 1, 80)) {
    return { ok: false, error: "article.displayDate is invalid." };
  }
  if (value.author !== "raj-tomar" || value.tier !== "news") {
    return { ok: false, error: "article author or tier is invalid." };
  }
  if (
    typeof value.category !== "string" ||
    !CATEGORIES.has(value.category as NewsCategory)
  ) {
    return { ok: false, error: "article.category is unsupported." };
  }
  if (
    !Array.isArray(value.market) ||
    value.market.length < 1 ||
    value.market.length > 5 ||
    value.market.some(
      (market) => typeof market !== "string" || !MARKETS.has(market),
    )
  ) {
    return { ok: false, error: "article.market is invalid." };
  }
  if (
    !Array.isArray(value.tldr) ||
    value.tldr.length !== 3 ||
    value.tldr.some((item) => !boundedString(item, 1, 180))
  ) {
    return { ok: false, error: "article.tldr must contain exactly three bounded items." };
  }
  if (!boundedString(value.body, 100, 80_000)) {
    return { ok: false, error: "article.body is invalid or too large." };
  }
  if (
    !Array.isArray(value.faq) ||
    value.faq.length > 8 ||
    value.faq.some(
      (item) =>
        !isRecord(item) ||
        Object.keys(item).some((key) => !new Set(["q", "a"]).has(key)) ||
        !boundedString(item.q, 1, 500) ||
        !boundedString(item.a, 1, 2_000),
    )
  ) {
    return { ok: false, error: "article.faq is invalid." };
  }
  if (
    !Array.isArray(value.citations) ||
    value.citations.length < 1 ||
    value.citations.length > 12 ||
    value.citations.some(
      (citation) =>
        !isRecord(citation) ||
        Object.keys(citation).some(
          (key) =>
            !new Set(["source", "url", "accessedAt", "tier"]).has(key),
        ) ||
        !boundedString(citation.source, 1, 200) ||
        !validHttpsUrl(citation.url) ||
        !validIso(citation.accessedAt),
    )
  ) {
    return { ok: false, error: "article.citations is invalid." };
  }
  const citationUrls = value.citations.map((citation) =>
    String((citation as Record<string, unknown>).url),
  );
  if (new Set(citationUrls).size !== citationUrls.length) {
    return { ok: false, error: "article.citations contains duplicate URLs." };
  }
  if (
    !isRecord(value.heroImage) ||
    Object.keys(value.heroImage).some(
      (key) => !new Set(["src", "alt", "credit"]).has(key),
    ) ||
    value.heroImage.src !== `/news/${value.slug}/cover.jpg` ||
    !boundedString(value.heroImage.alt, 1, 300) ||
    !boundedString(value.heroImage.credit, 1, 300)
  ) {
    return {
      ok: false,
      error:
        "article.heroImage must retain the canonical article-local review path until the media ledger approves real bytes.",
    };
  }
  let ctaIsCanonical = false;
  if (isRecord(value.cta) && validHttpsUrl(value.cta.href)) {
    const cta = new URL(value.cta.href);
    ctaIsCanonical =
      cta.origin === "https://investwithraj.com" &&
      cta.pathname === "/engage";
  }
  if (
    !isRecord(value.cta) ||
    Object.keys(value.cta).some(
      (key) => !new Set(["href", "label"]).has(key),
    ) ||
    !ctaIsCanonical ||
    !boundedString(value.cta.label, 1, 240)
  ) {
    return { ok: false, error: "article.cta is invalid." };
  }
  if (!validDistribution(value.distribution)) {
    return { ok: false, error: "article.distribution must be an object." };
  }
  if (
    value.metaDescription !== undefined &&
    !boundedString(value.metaDescription, 1, 320)
  ) {
    return { ok: false, error: "article.metaDescription is invalid." };
  }
  if (
    value.speakableSelector !== undefined &&
    (!Array.isArray(value.speakableSelector) ||
      value.speakableSelector.length > 12 ||
      value.speakableSelector.some(
        (selector) =>
          !boundedString(selector, 1, 160) ||
          !/^[.#][A-Za-z0-9_:[\].#>+~*="' -]+$/.test(selector),
      ))
  ) {
    return { ok: false, error: "article.speakableSelector is invalid." };
  }
  if (!validSemaform(value.semaform)) {
    return { ok: false, error: "article.semaform is invalid." };
  }

  return { ok: true, article: value as unknown as DraftArticle };
}

export function validateProvenanceShape(
  value: unknown,
  citationUrls: string[],
):
  | { ok: true; provenance: NewsDraftProvenance }
  | { ok: false; error: string } {
  if (
    !isRecord(value) ||
    !boundedString(value.clusterId, 1, 256) ||
    !/^[A-Za-z0-9:_-]+$/.test(value.clusterId) ||
    !boundedString(value.topic, 1, 500) ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    !isRecord(value.scoreBreakdown)
  ) {
    return { ok: false, error: "provenance identity or score is invalid." };
  }
  for (const key of [
    "uhnwRelevance",
    "sourceTier",
    "freshness",
    "rajAngle",
  ]) {
    const score = value.scoreBreakdown[key];
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return { ok: false, error: "provenance score breakdown is invalid." };
    }
  }
  if (
    !Array.isArray(value.sources) ||
    value.sources.length > 24 ||
    value.sources.some(
      (source) =>
        !isRecord(source) ||
        !boundedString(source.name, 1, 240) ||
        !boundedString(source.tier, 1, 80) ||
        !validHttpsUrl(source.url) ||
        !boundedString(source.summary, 1, 9_000) ||
        (source.publishedAt !== undefined && !validIso(source.publishedAt)),
    )
  ) {
    return { ok: false, error: "provenance sources are invalid." };
  }
  if (
    value.citedText !== undefined &&
    !boundedString(value.citedText, 1, 20_000)
  ) {
    return { ok: false, error: "provenance citedText is invalid." };
  }
  if (
    value.fetchedEvidence !== undefined &&
    (!Array.isArray(value.fetchedEvidence) ||
      value.fetchedEvidence.length > 12 ||
      value.fetchedEvidence.some((evidence) => {
        if (
          !isRecord(evidence) ||
          !validHttpsUrl(evidence.url) ||
          !citationUrls.includes(evidence.url) ||
          (evidence.finalUrl !== undefined &&
            !validHttpsUrl(evidence.finalUrl)) ||
          !boundedString(evidence.text, 80, 9_000) ||
          !validIso(evidence.fetchedAt)
        ) {
          return true;
        }
        const expectedHash = createHash("sha256")
          .update(evidence.text)
          .digest("hex");
        return (
          evidence.contentHash !== undefined &&
          evidence.contentHash !== expectedHash
        );
      }))
  ) {
    return {
      ok: false,
      error: "provenance fetched evidence is invalid or not content-bound.",
    };
  }
  return {
    ok: true,
    provenance: value as unknown as NewsDraftProvenance,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function draftContentHash(
  article: DraftArticle,
  provenance: NewsDraftProvenance,
): string {
  return sha256Json({ article, provenance });
}

export function evidenceApprovalFor(
  revision: number,
  contentHash: string,
  verifiedSources: string[],
  provenance: NewsDraftProvenance,
  now = new Date().toISOString(),
  reviewer: EvidenceApproval["reviewer"] = "raj-review-session",
): EvidenceApproval | null {
  const citedUrls = [...new Set(verifiedSources)].sort();
  const evidence = (provenance.fetchedEvidence ?? [])
    .filter((item) => citedUrls.includes(item.url))
    .map((item) => ({
      url: item.url,
      contentHash:
        item.contentHash ??
        createHash("sha256").update(item.text).digest("hex"),
    }))
    .sort((left, right) => left.url.localeCompare(right.url));
  if (
    citedUrls.length < 2 ||
    evidence.length < 2 ||
    new Set(evidence.map((item) => item.url)).size !== citedUrls.length
  ) {
    return null;
  }
  const payload = {
    revision,
    contentHash,
    sourceUrls: citedUrls,
    evidenceHashes: evidence,
    reviewer,
    approvedAt: now,
  };
  return { ...payload, hash: sha256Json(payload) };
}

/**
 * Publication can proceed without a cover only in deterministic auto-publish
 * mode. Public surfaces recognise the article's `withheld` media state and
 * render no image rather than substituting an unverified asset.
 */
export const WITHHELD_MEDIA_APPROVAL_HASH = sha256Json({
  state: "withheld",
  reason: "verified UHD editorial media pending",
});

export function mediaApprovalHash(
  value: Omit<MediaApprovalLedger, "hash">,
): string {
  return sha256Json(value);
}
