import type { AreaPage } from "@/content/areas/types";
import type {
  Citation,
  NewsArticle,
  NewsCategory,
} from "@/content/news/types";
import type { DeveloperProfile } from "@/lib/developers";
import {
  findSourceByUrl,
  type SourceTier,
} from "@/lib/sources/registry";
import type { Vertical } from "@/lib/verticals";

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  "market-pulse": "Market pulse",
  launch: "Launches",
  regulatory: "Regulation",
  macro: "Macro",
  "developer-corporate": "Developer desk",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

const TIER_LABELS: Record<SourceTier, string> = {
  government: "Official source",
  "national-press": "National press",
  "regional-press": "Regional press",
  "institutional-research": "Institutional research",
  "industry-portal": "Industry source",
};

const TIER_WEIGHT: Record<SourceTier, number> = {
  government: 5,
  "national-press": 4,
  "institutional-research": 4,
  "regional-press": 3,
  "industry-portal": 2,
};

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "of",
  "on",
  "s",
  "the",
  "to",
  "with",
]);

const AREA_ALIASES: Record<string, string[]> = {
  jbr: ["JBR"],
  jlt: ["JLT"],
  difc: ["DIFC"],
  jvc: ["JVC"],
  "mbr-city": ["MBR City"],
};

const DEVELOPER_ALIASES: Record<string, string[]> = {
  emaar: ["Emaar"],
  aldar: ["Aldar"],
  nakheel: ["Nakheel"],
  modon: ["Modon"],
  damac: ["Damac"],
  sobha: ["Sobha"],
  "dubai-holding": ["Dubai Holding"],
  "ifa-hotels": ["IFA Hotels", "IFA Hotels & Resorts", "IFA"],
  // "Marjan" alone is also a place name. Require the unambiguous holding
  // identity so an Al Marjan Island story cannot become a corporate match.
  marjan: ["RAK Holding"],
};

const EXTERNAL_MARKETS = [
  "Oman",
  "Ethiopia",
  "Kuwait",
  "Saudi Arabia",
  "Bahrain",
  "Qatar",
] as const;

const UAE_MARKERS = [
  "Dubai",
  "Abu Dhabi",
  "Ras Al Khaimah",
  "UAE",
  "United Arab Emirates",
];

export type EvidenceSummary = {
  sourceCount: number;
  leadTier: SourceTier | null;
  label: string;
  detail: string;
  limited: boolean;
};

export function categoryLabel(category: NewsCategory): string {
  return CATEGORY_LABELS[category];
}

export function formatEditorialDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(iso));
}

export function readingMinutes(article: NewsArticle): number {
  const wordCount = article.body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 225));
}

export function sourceTierForCitation(citation: Citation): SourceTier | null {
  return citation.tier ?? findSourceByUrl(citation.url)?.tier ?? null;
}

export function evidenceSummary(article: NewsArticle): EvidenceSummary {
  const tiers = article.citations
    .map(sourceTierForCitation)
    .filter((tier): tier is SourceTier => Boolean(tier))
    .sort((a, b) => TIER_WEIGHT[b] - TIER_WEIGHT[a]);
  const sourceCount = article.citations.length;
  const leadTier = tiers[0] ?? null;
  const leadLabel = leadTier ? TIER_LABELS[leadTier] : "Source links";
  const limited =
    sourceCount < 2 &&
    (!leadTier ||
      leadTier === "regional-press" ||
      leadTier === "industry-portal");

  if (sourceCount === 0) {
    return {
      sourceCount,
      leadTier,
      label: "Evidence review pending",
      detail: "No source links are attached to this record.",
      limited: true,
    };
  }

  if (sourceCount === 1) {
    return {
      sourceCount,
      leadTier,
      label: `${leadLabel} · single source`,
      detail: limited
        ? "This report currently relies on one supporting source. Read the source before acting."
        : "One high-authority source is attached. Independent corroboration is not shown on this page.",
      limited,
    };
  }

  return {
    sourceCount,
    leadTier,
    label: `${sourceCount} sources · ${leadLabel.toLowerCase()} led`,
    detail: `${sourceCount} source links are available for direct review.`,
    limited: false,
  };
}

export function displayMarkets(article: NewsArticle): string[] {
  const headlineText = `${article.title} ${article.subtitle}`;
  const external = EXTERNAL_MARKETS.find((market) =>
    containsPhrase(headlineText, market),
  );
  const hasUaeMarker = UAE_MARKERS.some((market) =>
    containsPhrase(headlineText, market),
  );
  const startsWithExternal =
    external &&
    normaliseText(article.title).startsWith(normaliseText(external));

  return external && (!hasUaeMarker || startsWithExternal)
    ? [external]
    : article.market;
}

export function selectDistinctArticles(
  articles: NewsArticle[],
  limit: number,
): NewsArticle[] {
  const selected: NewsArticle[] = [];

  for (const article of articles) {
    if (selected.some((candidate) => areNearDuplicate(candidate, article))) {
      continue;
    }
    selected.push(article);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function areNearDuplicate(
  first: NewsArticle,
  second: NewsArticle,
): boolean {
  const a = titleTokens(first.title);
  const b = titleTokens(second.title);
  if (a.size === 0 || b.size === 0) return false;

  const shared = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = shared / union;
  const containment = shared / Math.min(a.size, b.size);

  return shared >= 4 && (jaccard >= 0.44 || containment >= 0.72);
}

export function articleMentionsArea(
  article: NewsArticle,
  area: AreaPage,
): boolean {
  const text = articleText(article);
  const aliases = new Set([
    area.name,
    area.slug.replaceAll("-", " "),
    ...(AREA_ALIASES[area.slug] ?? []),
  ]);

  if (area.name.endsWith(" Island")) {
    const shortened = area.name.slice(0, -" Island".length);
    if (shortened.length >= 7) aliases.add(shortened);
  }

  return [...aliases].some((alias) => containsPhrase(text, alias));
}

export function articleMentionsDeveloper(
  article: NewsArticle,
  developer: DeveloperProfile,
): boolean {
  const aliases =
    DEVELOPER_ALIASES[developer.slug] ?? [developer.name];
  const text = articleText(article);
  return aliases.some((alias) => containsPhrase(text, alias));
}

export function relatedAreasForArticle(
  article: NewsArticle,
  areas: AreaPage[],
): AreaPage[] {
  return areas.filter((area) => articleMentionsArea(article, area));
}

export function relatedDevelopersForArticle(
  article: NewsArticle,
  developers: DeveloperProfile[],
): DeveloperProfile[] {
  return developers.filter((developer) =>
    articleMentionsDeveloper(article, developer),
  );
}

export function relatedDevelopersForArea(
  area: AreaPage,
  developers: DeveloperProfile[],
): DeveloperProfile[] {
  return developers.filter((developer) => {
    if (developer.activeAreas.includes(area.slug)) return true;
    const aliases = new Set([
      developer.name,
      ...(DEVELOPER_ALIASES[developer.slug] ?? []),
    ]);
    return area.developers.some((recordedName) =>
      [...aliases].some(
        (alias) =>
          normaliseText(recordedName) === normaliseText(alias) ||
          containsPhrase(recordedName, alias),
      ),
    );
  });
}

export function relatedVerticalsForArticle(
  article: NewsArticle,
  verticals: Vertical[],
): Vertical[] {
  return verticals.filter((vertical) =>
    vertical.categories.includes(article.category),
  );
}

export function consequenceExcerpt(article: NewsArticle): string {
  const paragraphs = article.body.split(/\n\n+/).filter(Boolean);
  return (
    paragraphs.find((paragraph) =>
      /\b(thesis|implication|watchpoint|risk|for (?:buyers|investors|sellers|developers|allocators))\b/i.test(
        paragraph,
      ),
    ) ??
    article.tldr[2] ??
    article.tldr[0]
  );
}

export function supportedImageAlt(article: NewsArticle): string {
  const alt = article.heroImage.alt.trim();
  if (!alt) return "";
  return normaliseText(alt) === normaliseText(article.title) ? "" : alt;
}

type EditorialImageRecord = Pick<NewsArticle, "slug" | "title" | "heroImage">;

export function editorialImageHoldReasons(
  article: EditorialImageRecord,
): string[] {
  const reasons: string[] = [];
  const { heroImage } = article;
  const credit = normaliseText(heroImage.credit);
  const expectedPath = `/news/${article.slug}/cover.`;
  const ownedArticleMedia =
    heroImage.src.startsWith(expectedPath) &&
    /\.(?:avif|jpe?g|png|webp)$/i.test(heroImage.src) &&
    !/[?#]/.test(heroImage.src);

  if (!ownedArticleMedia) {
    reasons.push("cover is not an owned article-local media path");
  }
  if (!supportedImageAlt(article as NewsArticle)) {
    reasons.push("descriptive alt text is missing");
  }
  if (
    !credit ||
    /placeholder|editorial archive|pending|withheld|to be set/i.test(credit)
  ) {
    reasons.push("credit is missing or not an approval record");
  }
  if (heroImage.approval !== "approved-editorial") {
    reasons.push("editorial approval is absent");
  }
  if (!heroImage.rightsStatus?.trim()) {
    reasons.push("rights basis is absent");
  }
  try {
    const source = new URL(heroImage.sourceUrl ?? "");
    if (source.protocol !== "https:" || source.username || source.password) {
      reasons.push("source URL is not an approved HTTPS record");
    }
  } catch {
    reasons.push("source URL is absent or invalid");
  }
  if (
    !Number.isFinite(heroImage.width) ||
    !Number.isFinite(heroImage.height) ||
    (heroImage.width ?? 0) < 3840 ||
    (heroImage.height ?? 0) < 2160
  ) {
    reasons.push("verified UHD source dimensions are absent");
  }

  return reasons;
}

export function hasVerifiedEditorialImage(
  article: EditorialImageRecord,
): boolean {
  return editorialImageHoldReasons(article).length === 0;
}

export function decisionCta(article: NewsArticle): {
  href: string;
  label: string;
  heading: string;
} {
  const copy: Record<NewsCategory, { label: string; heading: string }> = {
    launch: {
      label: "Discuss this launch",
      heading: "Test the launch against your brief.",
    },
    "market-pulse": {
      label: "Review your position",
      heading: "Put this market move against your position.",
    },
    regulatory: {
      label: "Review the policy impact",
      heading: "Translate the rule into a property decision.",
    },
    policy: {
      label: "Review the policy impact",
      heading: "Translate the rule into a property decision.",
    },
    macro: {
      label: "Stress-test the allocation",
      heading: "Stress-test the allocation behind the headline.",
    },
    infrastructure: {
      label: "Review the location case",
      heading: "Test the location thesis before pricing it in.",
    },
    "developer-corporate": {
      label: "Review the developer exposure",
      heading: "Put the developer signal against your exposure.",
    },
  };

  const selected = copy[article.category];
  const url = new URL("/engage", "https://investwithraj.com");
  url.searchParams.set("utm_source", "news");
  url.searchParams.set("utm_medium", "article");
  url.searchParams.set("utm_campaign", "decision-brief");
  url.searchParams.set("utm_content", article.slug);
  const href = url.toString();

  return { href, ...selected };
}

function articleText(article: NewsArticle): string {
  return [
    article.title,
    article.subtitle,
    ...article.tldr,
    article.body,
  ].join(" ");
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normaliseText(title)
      .split(" ")
      .filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token)),
  );
}

function containsPhrase(text: string, phrase: string): boolean {
  const haystack = ` ${normaliseText(text)} `;
  const needle = ` ${normaliseText(phrase)} `;
  return needle.trim().length > 0 && haystack.includes(needle);
}

function normaliseText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
