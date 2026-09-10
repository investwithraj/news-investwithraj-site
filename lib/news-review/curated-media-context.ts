/** Pure static context registry. This is not a publication or rights bypass. */
export const PRESTIGE_ONE_CONTEXT_MEDIA = {
  candidateKey: "prestige-one-investment-2026-09-10",
  draftId: "be570910-2026-4090-8090-100000000004",
  slug: "2026-09-10-prestige-one-dubai-investment-plan",
  repoPath: "public/news/2026-09-10-prestige-one-dubai-investment-plan/cover.jpg",
  alt: "Dubai skyline at sunset, shown as city context",
  contentSha256: "8841d0f06bc9c51a034691724dc14d0c4a5b58dc2d5ac32a2340ffb7437d8688",
  mime: "image/jpeg",
  width: 7728,
  height: 5152,
  sourceUrl: "https://www.investwithraj.com/media/licensed-real/dubai-golden.jpg",
  rightsStatus: "licensed",
  credit: "Invest With Raj stock-account archive; Dubai city context, not a Prestige One project",
  reuseReceipt: {
    id: "prestige-one-dubai-context-stock-reuse-2026-09-10",
    path: "docs/editorial/2026-09-10-prestige-one-media-reuse-receipt.md",
    ownerApprovalSha256: "31f102591465fa587e75fae9f60942dc9cfe8ea08f40b1b83d6fb61cf1dc6351",
    sourceAssetPath: "public/media/licensed-real/dubai-golden.jpg",
    sourceAssetSha256: "8841d0f06bc9c51a034691724dc14d0c4a5b58dc2d5ac32a2340ffb7437d8688",
    approvedBy: "Raj Tomar",
    ownerApprovalDate: "2026-09-09",
    reuseAuthorizedAt: "2026-09-10",
    basis: "owner-approved-stock-account",
  },
} as const;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * This exact description comes from the approved photograph, not the news
 * source. Matching it never establishes that bytes or a publication ledger
 * are approved; the reuse service and publisher enforce those independently.
 */
export function hasApprovedCuratedMediaContext(article: unknown): boolean {
  if (!record(article) || !record(article.heroImage)) return false;
  const image = article.heroImage;
  const approved = PRESTIGE_ONE_CONTEXT_MEDIA;
  return article.slug === approved.slug &&
    image.src === `/${approved.repoPath.replace(/^public\//u, "")}` &&
    image.alt === approved.alt && image.credit === approved.credit &&
    (image.sourceUrl === undefined || image.sourceUrl === approved.sourceUrl) &&
    (image.rightsStatus === undefined || image.rightsStatus === approved.rightsStatus) &&
    (image.width === undefined || image.width === approved.width) &&
    (image.height === undefined || image.height === approved.height) &&
    (image.approval === undefined || image.approval === "approved-editorial");
}
