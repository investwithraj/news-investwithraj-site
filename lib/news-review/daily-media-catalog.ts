import type { DraftArticle, MediaApprovalLedger } from "./types";

/** Static, byte-pinned originals. A matching caption is not a publication approval. */
export interface DailyNewsMedia {
  id: string;
  market: string;
  catalogueRepoPath: string;
  contentSha256: string;
  mime: "image/jpeg";
  width: number;
  height: number;
  sourceUrl: string;
  rightsStatus: string;
  credit: string;
  alt: string;
  licenceUrl?: string;
  preserveWideFrame?: boolean;
  reuseReceipt: NonNullable<MediaApprovalLedger["reuseReceipt"]>;
}

function stockPhoto(
  id: string, original: string, hash: string, width: number, height: number, alt: string,
): DailyNewsMedia {
  return {
    id, market: "Dubai", catalogueRepoPath: `public/news-stock/${id}.jpg`,
    contentSha256: hash, mime: "image/jpeg", width, height,
    sourceUrl: `https://www.investwithraj.com/media/licensed-real/${original}`,
    rightsStatus: "licensed",
    credit: "Invest With Raj stock-account archive; Dubai city context, not the announced project",
    alt,
    reuseReceipt: {
      id: `daily-news-${id}-2026-09-10`,
      path: "docs/editorial/2026-09-10-daily-news-image-catalogue.md",
      ownerApprovalSha256: "31f102591465fa587e75fae9f60942dc9cfe8ea08f40b1b83d6fb61cf1dc6351",
      sourceAssetPath: `public/media/licensed-real/${original}`,
      sourceAssetSha256: hash,
      approvedBy: "Raj Tomar", ownerApprovalDate: "2026-09-09",
      reuseAuthorizedAt: "2026-09-10", basis: "owner-approved-stock-account",
    },
  };
}

export const DAILY_NEWS_MEDIA: readonly DailyNewsMedia[] = [
  stockPhoto("dubai-sunset", "dubai-golden.jpg",
    "8841d0f06bc9c51a034691724dc14d0c4a5b58dc2d5ac32a2340ffb7437d8688",
    7728, 5152, "Dubai skyline at sunset, shown as city context"),
  stockPhoto("dubai-night", "dubai-stock.jpg",
    "d738b05de0caa36596bbef621c2a1e57b19ace0722931216cdb6eb5ff658e6f8",
    7952, 5304, "Downtown Dubai skyline at night, shown as city context"),
  {
    id: "abu-dhabi-sunset", market: "Abu Dhabi",
    catalogueRepoPath: "public/news-stock/abu-dhabi-sunset.jpg",
    contentSha256: "beac735391f514a147bde0a332316f4aad90a0031646d6e3ec088ad6390243c7",
    mime: "image/jpeg", width: 6720, height: 3270,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Skyline_of_Abu_Dhabi_at_sunset.jpg",
    rightsStatus: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/",
    preserveWideFrame: true,
    credit: "Robert Haandrikman, 2016 · CC BY 2.0 · Archive city context; not the announced project",
    alt: "Abu Dhabi skyline at sunset, shown as archive city context",
    reuseReceipt: {
      id: "daily-news-abu-dhabi-open-stock-2026-09-10",
      path: "docs/editorial/2026-09-10-daily-news-image-catalogue.md",
      ownerApprovalSha256: "433c197a4409c357c8ac2323c915ed6264c608e59e1a5c07cb8f199436e6084a",
      sourceAssetPath: "public/news-stock/abu-dhabi-sunset.jpg",
      sourceAssetSha256: "beac735391f514a147bde0a332316f4aad90a0031646d6e3ec088ad6390243c7",
      approvedBy: "Raj Tomar", ownerApprovalDate: "2026-09-10", reuseAuthorizedAt: "2026-09-10",
      basis: "open-stock-licence",
    },
  },
  {
    id: "ras-al-khaimah-coast", market: "Ras Al Khaimah",
    catalogueRepoPath: "public/news-stock/ras-al-khaimah-coast.jpg",
    contentSha256: "00d599999624f146e3acee32762b4ada67f4d30d657c5486f3f78832630cba24",
    mime: "image/jpeg", width: 5472, height: 3078,
    sourceUrl: "https://www.pexels.com/photo/an-aerial-shot-of-the-rixos-bab-al-bahr-in-ras-al-khaimah-10484112/",
    rightsStatus: "Pexels licence", licenceUrl: "https://www.pexels.com/license/",
    credit: "Marjan / Pexels, 2021 · Rixos Bab Al Bahr, Al Marjan Island · Archive coastal context; not the announced project",
    alt: "Rixos Bab Al Bahr on Al Marjan Island, Ras Al Khaimah, shown as archive coastal context",
    reuseReceipt: {
      id: "daily-news-rak-open-stock-2026-09-10",
      path: "docs/editorial/2026-09-10-daily-news-image-catalogue.md",
      ownerApprovalSha256: "433c197a4409c357c8ac2323c915ed6264c608e59e1a5c07cb8f199436e6084a",
      sourceAssetPath: "public/news-stock/ras-al-khaimah-coast.jpg",
      sourceAssetSha256: "00d599999624f146e3acee32762b4ada67f4d30d657c5486f3f78832630cba24",
      approvedBy: "Raj Tomar", ownerApprovalDate: "2026-09-10", reuseAuthorizedAt: "2026-09-10",
      basis: "open-stock-licence",
    },
  },
];

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Keep selection stable for already-staged drafts when adding other markets. */
export function selectDailyNewsMedia(article: unknown): DailyNewsMedia | null {
  if (!record(article) || article.tier !== "news" || article.format !== "short-update" ||
    typeof article.slug !== "string" || article.slug.length > 160 ||
    !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(article.slug) ||
    !Array.isArray(article.market) || article.market.length !== 1 ||
    typeof article.body !== "string") return null;
  // Never silently rebind the separately approved, exact curated candidate.
  if (article.slug === "2026-09-10-prestige-one-dubai-investment-plan") return null;
  if (article.market[0] === "Abu Dhabi" && /\bAbu Dhabi\b/iu.test(article.body)) {
    return DAILY_NEWS_MEDIA.find((entry) => entry.id === "abu-dhabi-sunset") ?? null;
  }
  if (article.market[0] === "Ras Al Khaimah" && /\bRas Al Khaimah\b/iu.test(article.body) &&
    /\b(?:Al Marjan|Rixos)\b/iu.test(article.body) &&
    /\b(?:tourism|hospitality|hotels?|resorts?)\b/iu.test(article.body) && article.category !== "launch") {
    return DAILY_NEWS_MEDIA.find((entry) => entry.id === "ras-al-khaimah-coast") ?? null;
  }
  if (article.market[0] !== "Dubai" || !/\bDubai\b/iu.test(article.body)) return null;
  let parity = 0;
  for (const character of article.slug) parity = (parity + character.charCodeAt(0)) % 2;
  return DAILY_NEWS_MEDIA[parity] ?? null;
}

/** Fixed server fields only; the caller cannot choose a URL or approval basis. */
export function expectedDailyMediaFields(article: unknown): Omit<MediaApprovalLedger,
  "hash" | "revision" | "contentHash" | "approvedAt"> | null {
  const selected = selectDailyNewsMedia(article);
  if (!selected || !record(article) || typeof article.slug !== "string") return null;
  return {
    slug: article.slug, repoPath: `public/news/${article.slug}/cover.jpg`,
    contentSha256: selected.contentSha256, mime: selected.mime,
    width: selected.width, height: selected.height, sourceUrl: selected.sourceUrl,
    rightsStatus: selected.rightsStatus, credit: selected.credit,
    reviewer: selected.reuseReceipt.basis === "open-stock-licence"
      ? "approved-open-stock-reuse" : "owner-approved-stock-reuse",
    reuseReceipt: { ...selected.reuseReceipt },
  };
}

/** Only the precise registered photo description has independent provenance. */
export function hasApprovedDailyMediaContext(article: unknown): boolean {
  const selected = selectDailyNewsMedia(article);
  if (!selected || !record(article) || !record(article.heroImage)) return false;
  const image = article.heroImage;
  return image.src === `/news/${article.slug}/cover.jpg` && image.alt === selected.alt &&
    image.credit === selected.credit && image.sourceUrl === selected.sourceUrl &&
    image.rightsStatus === selected.rightsStatus && image.width === selected.width &&
    image.height === selected.height &&
    (image.approval === undefined || image.approval === "approved-editorial");
}

/** Used only while generating a new draft, before its content hash is sealed. */
export function withDailyNewsMedia(article: DraftArticle): DraftArticle {
  const selected = selectDailyNewsMedia(article);
  if (!selected) return article;
  return { ...article, heroImage: {
    src: `/news/${article.slug}/cover.jpg`, alt: selected.alt, credit: selected.credit,
    sourceUrl: selected.sourceUrl, rightsStatus: selected.rightsStatus,
    width: selected.width, height: selected.height,
    // No approved-editorial flag: the protected byte check and ledger come later.
  } };
}
