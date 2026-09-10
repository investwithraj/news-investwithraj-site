import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DAILY_NEWS_MEDIA, expectedDailyMediaFields, hasApprovedDailyMediaContext,
  selectDailyNewsMedia, withDailyNewsMedia } from "../lib/news-review/daily-media-catalog";
import type { DraftArticle } from "../lib/news-review/types";
import { verifyImageBytes } from "../lib/media/image-integrity";

async function main() {
  const input = { slug: "2026-09-10-dubai-planning-update", tier: "news", format: "short-update",
    market: ["Dubai"], body: "Dubai planning update.",
    heroImage: { src: "/placeholder.jpg", alt: "Unapproved", credit: "To be set at review" },
  } as DraftArticle;
  const article = withDailyNewsMedia(input);
  assert.notEqual(article, input);
  assert.equal(input.heroImage.alt, "Unapproved");
  assert.equal(article.heroImage.approval, undefined);
  assert.ok(hasApprovedDailyMediaContext(article));
  assert.deepEqual(selectDailyNewsMedia(article), selectDailyNewsMedia({ ...article }));
  assert.equal(expectedDailyMediaFields(article)?.repoPath, `public/news/${article.slug}/cover.jpg`);
  const abuDhabi = withDailyNewsMedia({ ...input, market: ["Abu Dhabi"], body: "Abu Dhabi has an update." });
  assert.equal(selectDailyNewsMedia(abuDhabi)?.id, "abu-dhabi-sunset");
  assert.equal(expectedDailyMediaFields(abuDhabi)?.reviewer, "approved-open-stock-reuse");
  assert.equal(expectedDailyMediaFields(abuDhabi)?.reuseReceipt?.basis, "open-stock-licence");
  const rak = { ...input, category: "market-pulse", market: ["Ras Al Khaimah"],
    body: "Ras Al Khaimah tourism and hotels on Al Marjan Island." };
  assert.equal(selectDailyNewsMedia(rak)?.id, "ras-al-khaimah-coast");
  assert.equal(selectDailyNewsMedia({ ...rak, category: "launch" }), null);
  assert.equal(selectDailyNewsMedia({ ...rak, body: "Ras Al Khaimah schools." }), null);
  for (const change of [
    { market: ["Ras Al Khaimah"] }, { market: ["Dubai", "Abu Dhabi"] }, { market: [] },
    { body: "A different city." }, { slug: "../image" }, { slug: "2026-09-10-a/b" },
    { format: "long-report" }, { tier: "insight" },
    { slug: "2026-09-10-prestige-one-dubai-investment-plan" },
  ]) assert.equal(selectDailyNewsMedia({ ...article, ...change }), null);
  for (const [key, value] of Object.entries({ src: "/elsewhere.jpg", alt: "Dubai prices doubled",
    credit: "Wrong photographer", sourceUrl: "https://example.com", rightsStatus: "unknown",
    width: 3840, height: 2160, approval: "withheld" })) {
    assert.equal(hasApprovedDailyMediaContext({ ...article, heroImage: { ...article.heroImage, [key]: value } }), false);
  }
  for (const entry of DAILY_NEWS_MEDIA) {
    const bytes = await readFile(entry.catalogueRepoPath);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.contentSha256);
    const decoded = await verifyImageBytes(bytes);
    assert.equal(decoded.width, entry.width);
    assert.equal(decoded.height, entry.height);
    assert.ok(entry.width >= 3840 && entry.height >= 2160);
  }
  console.log(`Daily media catalogue passed: ${DAILY_NEWS_MEDIA.length} native originals, exact metadata, geography and unpublished staging.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
