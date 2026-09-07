import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  NEWS_ARCHIVE_PAGE_URL,
  newsArchiveCanonical,
  newsArchiveMetadata,
} from "@/app/news/metadata";
import { SITE } from "@/lib/constants";
import { NEWS_ARCHIVE_PAGE_SIZE } from "@/lib/news-archive";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const PAGE_COUNT = 4;
const ITEM_COUNT = PAGE_COUNT * NEWS_ARCHIVE_PAGE_SIZE;

assert.deepEqual(newsArchiveCanonical({}, ITEM_COUNT), {
  url: NEWS_ARCHIVE_PAGE_URL,
  page: null,
});
assert.deepEqual(newsArchiveCanonical({ page: "1" }, ITEM_COUNT), {
  url: NEWS_ARCHIVE_PAGE_URL,
  page: null,
});
assert.deepEqual(newsArchiveCanonical({ page: "2" }, ITEM_COUNT), {
  url: `${NEWS_ARCHIVE_PAGE_URL}?page=2`,
  page: 2,
});
assert.deepEqual(newsArchiveCanonical({ page: "4" }, ITEM_COUNT), {
  url: `${NEWS_ARCHIVE_PAGE_URL}?page=4`,
  page: 4,
});

for (const invalidParams of [
  { page: "02" },
  { page: "0" },
  { page: "5" },
  { page: ["2", "3"] },
  { page: "2", q: "Dubai" },
  { page: "2", desk: "dld-pulse" },
]) {
  assert.deepEqual(newsArchiveCanonical(invalidParams, ITEM_COUNT), {
    url: NEWS_ARCHIVE_PAGE_URL,
    page: null,
  });
}

const pageTwoMetadata = newsArchiveMetadata({ page: "2" }, ITEM_COUNT);
assert.equal(
  pageTwoMetadata.alternates?.canonical,
  `${NEWS_ARCHIVE_PAGE_URL}?page=2`,
);
assert.equal(pageTwoMetadata.openGraph?.url, `${NEWS_ARCHIVE_PAGE_URL}?page=2`);
assert.match(String(pageTwoMetadata.title), /page 2/i);

const openGraphImages = pageTwoMetadata.openGraph?.images;
assert.ok(Array.isArray(openGraphImages));
assert.equal(openGraphImages.length, 1);
assert.deepEqual(openGraphImages[0], {
  url: `${SITE.url}/api/og`,
  width: 1200,
  height: 630,
  alt: `UAE real estate news archive — ${SITE.name}`,
});

for (const path of [
  "app/page.tsx",
  "app/news/metadata.ts",
  "app/areas/page.tsx",
  "app/areas/[slug]/page.tsx",
  "app/developers/page.tsx",
  "app/developer/[slug]/page.tsx",
  "app/v/[slug]/page.tsx",
  "app/terminal/page.tsx",
  "app/map/page.tsx",
  "app/about/page.tsx",
  "app/about/editorial-standards/page.tsx",
  "app/legal/privacy/page.tsx",
]) {
  const source = read(path);
  assert.match(
    source,
    /url:\s*`\$\{SITE\.url\}\/api\/og`/,
    `${path} must expose the crawlable generic newsroom card directly or as a verified-media fallback.`,
  );
  assert.match(source, /width:\s*1200/);
  assert.match(source, /height:\s*630/);
}

for (const unpublishedPath of [
  "app/closing-bell/page.tsx",
  "app/power-list/[year]/page.tsx",
]) {
  assert.doesNotMatch(
    read(unpublishedPath),
    /url:\s*`\$\{SITE\.url\}\/api\/og`/,
    `${unpublishedPath} is not currently public and must not be added to the public-card contract.`,
  );
}

console.log(
  "Open Graph metadata PASS: indexable public templates expose 1200×630 crawlable cards and valid unfiltered archive pages self-canonicalize.",
);
