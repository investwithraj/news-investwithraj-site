import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";

import {
  GET as getBrief,
  POST as postBrief,
} from "@/app/api/brief/route";
import { GET as getOg } from "@/app/api/og/route";
import { GET as getLlms } from "@/app/llms.txt/route";
import { GET as getRss } from "@/app/rss.xml/route";
import { NEWS_ARTICLES } from "@/content/news";
import { EDITORIAL } from "@/lib/constants";
import {
  isApprovedPublicLifecycleArticleSlug,
  NEWSROOM_LIFECYCLE_CUTOVER_ENV,
} from "@/lib/news-lifecycle";
import { INDEXABLE_NEWS_ARTICLES } from "@/lib/public-content";
import { newsArticleSchema } from "@/lib/schema/article";
import { NEWS_ORG_ID } from "@/lib/schema/organization";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

async function main() {
const originalCutover = process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];

const indexableSlug =
  "2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction";
const publicNoindexSlug =
  "2026-06-22-oman-scraps-sponsor-mandate-for-property-linked-residency-pe";
const heldSlug =
  "2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may";
const removedSlug =
  "2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop";
const redirectSourceSlug =
  "2026-06-28-dubai-mandates-monthly-rent-option-across-12-landlords-in-fl";
const researchSlug = "2026-05-26-dld-21b-week";

assert.equal(isApprovedPublicLifecycleArticleSlug(indexableSlug), true);
assert.equal(isApprovedPublicLifecycleArticleSlug(publicNoindexSlug), true);
assert.equal(isApprovedPublicLifecycleArticleSlug(heldSlug), true);
assert.equal(isApprovedPublicLifecycleArticleSlug(removedSlug), false);
assert.equal(isApprovedPublicLifecycleArticleSlug(redirectSourceSlug), false);
assert.equal(isApprovedPublicLifecycleArticleSlug(researchSlug), false);
assert.ok(
  INDEXABLE_NEWS_ARTICLES.every((article) =>
    isApprovedPublicLifecycleArticleSlug(article.slug),
  ),
);

const briefResponse = getBrief();
assert.equal(briefResponse.status, 200);
assert.equal(
  briefResponse.headers.get("X-Robots-Tag"),
  "noindex, nofollow, noarchive",
);
assert.match(briefResponse.headers.get("Cache-Control") ?? "", /no-store/);

const unsupportedBriefResponse = await postBrief(
  new NextRequest("https://news.investwithraj.com/api/brief", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://news.investwithraj.com",
      "sec-fetch-site": "same-origin",
      "x-real-ip": "192.0.2.42",
    },
    body: JSON.stringify({ topic: "Ethiopia" }),
  }),
);
assert.equal(
  unsupportedBriefResponse.status,
  422,
  "The removed Ethiopia report must not seed an unrelated automated brief.",
);
assert.equal(
  unsupportedBriefResponse.headers.get("X-Robots-Tag"),
  "noindex, nofollow, noarchive",
);
assert.match(
  unsupportedBriefResponse.headers.get("Cache-Control") ?? "",
  /no-store/,
);

for (const slug of [removedSlug, redirectSourceSlug, researchSlug]) {
  const response = await getOg(
    new NextRequest(
      "https://news.investwithraj.com/api/og?slug=" + slug,
    ),
  );
  assert.equal(response.status, 404, slug + " leaked through /api/og.");
  assert.equal(
    response.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive",
  );
  assert.match(response.headers.get("Cache-Control") ?? "", /no-store/);
}

for (const slug of [indexableSlug, publicNoindexSlug, heldSlug]) {
  const response = await getOg(
    new NextRequest(
      "https://news.investwithraj.com/api/og?slug=" + slug,
    ),
  );
  assert.equal(
    response.status,
    200,
    slug + " was wrongly withheld by /api/og.",
  );
  assert.equal(
    response.headers.get("X-Robots-Tag"),
    "noindex, nofollow, noarchive",
  );
}

const malformedOg = await getOg(
  new NextRequest(
    "https://news.investwithraj.com/api/og?slug=" +
      indexableSlug +
      "&extra=1",
  ),
);
assert.equal(malformedOg.status, 400);
assert.equal(
  malformedOg.headers.get("X-Robots-Tag"),
  "noindex, nofollow, noarchive",
);

const apiSources = {
  brief: read("app/api/brief/route.ts"),
  digest: read("app/api/digest/route.ts"),
  distribute: read("app/api/distribute/route.ts"),
  queue: read("app/api/queue/add/route.ts"),
  queueAction: read("app/api/queue/action/[id]/route.ts"),
  og: read("app/api/og/route.tsx"),
};
assert.match(apiSources.brief, /isApprovedPublicLifecycleArticleSlug/);
assert.match(apiSources.brief, /terms\.length === 0 \|\| strongestScore === 0/);
assert.doesNotMatch(apiSources.digest, /import \{ NEWS_ARTICLES \}/);
assert.doesNotMatch(apiSources.distribute, /import \{ NEWS_ARTICLES \}/);
assert.doesNotMatch(apiSources.queue, /import \{ NEWS_ARTICLES \}/);
assert.match(apiSources.digest, /INDEXABLE_NEWS_ARTICLES/);
assert.match(apiSources.distribute, /INDEXABLE_NEWS_ARTICLES/);
assert.match(apiSources.queue, /validateQueueLifecycleFields/);
assert.match(apiSources.queueAction, /validateQueueLifecycleFields/);
assert.match(apiSources.og, /isApprovedPublicLifecycleArticleSlug/);

const removed = NEWS_ARTICLES.find((article) => article.slug === removedSlug);
assert.ok(removed);
assert.equal(
  INDEXABLE_NEWS_ARTICLES.some((article) => article.slug === removedSlug),
  false,
  "The unsupported Ethiopia record entered an outbound selector.",
);

const indexable = NEWS_ARTICLES.find((article) => article.slug === indexableSlug);
assert.ok(indexable);
const schema = newsArticleSchema(indexable);
assert.deepEqual(schema.author, { "@id": NEWS_ORG_ID });

const articleComponent = read("components/redesign/NewsArticle.tsx");
const articleRoute = read("app/news/[slug]/page.tsx");
const editorialStandards = read("app/about/editorial-standards/page.tsx");
const layout = read("app/layout.tsx");
assert.match(articleComponent, /EDITORIAL\.articleByline/);
assert.match(articleComponent, /News Desk analysis/);
assert.match(articleComponent, /About the publication/);
assert.doesNotMatch(
  articleComponent,
  /Dubai-based property advisor and author/,
);
assert.doesNotMatch(articleRoute, /#raj/);
assert.match(editorialStandards, /Publishing identity/);
assert.match(editorialStandards, /Invest With Raj News Desk/);
assert.match(editorialStandards, /News Desk interpretation/);
assert.doesNotMatch(editorialStandards, /Raj's interpretation/);
assert.doesNotMatch(editorialStandards, /Accountable editor/);
assert.match(layout, /creator: "Invest With Raj News Desk"/);
assert.match(layout, /name: "Invest With Raj News Desk"/);
assert.doesNotMatch(layout, /creator: "@rajtomar_dxb"/);

const rss = await getRss().text();
assert.ok(rss.includes("(" + EDITORIAL.articleByline + ")"));
assert.ok(
  !rss.includes("<author>office@investwithraj.com (Raj Tomar)</author>"),
);
const llms = await getLlms().text();
assert.ok(llms.includes("Article byline: " + EDITORIAL.articleByline));
assert.ok(llms.includes("Do not attribute an article personally to Raj"));

if (originalCutover === undefined) {
  delete process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
} else {
  process.env[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = originalCutover;
}

console.log(
  "Lifecycle public API PASS: brief, OG, outbound selectors and News Desk authorship fail closed.",
);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
