import assert from "node:assert/strict";

import { GET, OPTIONS, revalidate } from "@/app/api/front/route";
import { NEWS_ARTICLES } from "@/content/news";
import {
  displayMarkets,
  evidenceSummary,
  hasVerifiedEditorialImage,
  selectDistinctArticles,
} from "@/lib/news-editorial";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";

const SITE = "https://news.investwithraj.com";
const FRONT_SCHEMA_VERSION = "front-v1";
const FRESH_WINDOW_HOURS = 48;
const HOUR_MS = 3_600_000;

const CONTRACT_HEADERS = {
  "Access-Control-Allow-Origin": "https://investwithraj.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
  Vary: "Origin",
  "X-Content-Type-Options": "nosniff",
} as const;

type FrontEvidence = {
  sourceCount: number;
  label: string;
  limited: boolean;
};

type FrontItem = {
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  category: string;
  market: string[];
  signal: string | null;
  displayDate: string;
  evidence: FrontEvidence;
  cover: string | null;
  url: string;
};

type FrontPayload = {
  schemaVersion: string;
  available: boolean;
  state: "available" | "withheld";
  reason: string | null;
  items: FrontItem[];
  media: {
    withheldCoverCount: number;
    approvedCoverCount: number;
    limited: boolean;
  };
  generatedAt: string;
  freshness: {
    state: "empty" | "fresh" | "stale";
    newestPublishedAt: string | null;
    ageHours: number | null;
    thresholdHours: number;
  };
};

function assertContractHeaders(response: Response, method: string) {
  for (const [name, expected] of Object.entries(CONTRACT_HEADERS)) {
    assert.equal(
      response.headers.get(name),
      expected,
      `${method} changed the ${name} contract header.`,
    );
  }
}

async function getFrontAt(nowMs: number) {
  const originalNow = Date.now;
  Date.now = () => nowMs;

  try {
    const response = await GET();
    return {
      response,
      payload: (await response.json()) as FrontPayload,
    };
  } finally {
    Date.now = originalNow;
  }
}

function expectedItems(): FrontItem[] {
  return selectDistinctArticles(
    getPublicDiscoveryNewsArticles(),
    6,
  ).map((article) => {
    const evidence = evidenceSummary(article);
    const cover = hasVerifiedEditorialImage(article)
      ? article.heroImage.src.startsWith("/")
        ? `${SITE}${article.heroImage.src}`
        : article.heroImage.src
      : null;

    return {
      slug: article.slug,
      title: article.title,
      subtitle: article.subtitle,
      publishedAt: article.publishedAt,
      category: article.category,
      market: displayMarkets(article),
      signal: article.tldr?.[0] ?? null,
      displayDate: article.displayDate,
      evidence: {
        sourceCount: evidence.sourceCount,
        label: evidence.label,
        limited: evidence.limited,
      },
      cover,
      url: `${SITE}/news/${article.slug}`,
    };
  });
}

function assertPayload(
  payload: FrontPayload,
  expected: FrontItem[],
  nowMs: number,
) {
  assert.equal(
    payload.schemaVersion,
    FRONT_SCHEMA_VERSION,
    "The front feed must identify the explicit front-v1 schema.",
  );
  assert.ok(Array.isArray(payload.items), "The front feed items must be an array.");
  assert.ok(payload.items.length <= 6, "The front feed must contain at most six items.");
  assert.deepEqual(
    payload.items.map((item) => item.slug),
    expected.map((item) => item.slug),
    "The front feed selection or ordering changed.",
  );
  assert.deepEqual(payload.items, expected, "The front-v1 item projection changed.");

  const researchSlugs = new Set(
    NEWS_ARTICLES.filter((article) => article.status === "research").map(
      (article) => article.slug,
    ),
  );

  for (const item of payload.items) {
    assert.ok(
      !researchSlugs.has(item.slug),
      `Research record ${item.slug} leaked into the front feed.`,
    );
    assert.deepEqual(
      Object.keys(item.evidence).sort(),
      ["label", "limited", "sourceCount"],
      `${item.slug} changed the required evidence fields.`,
    );

    const article = NEWS_ARTICLES.find((candidate) => candidate.slug === item.slug);
    assert.ok(article, `Front item ${item.slug} is absent from the news registry.`);
    assert.equal(
      item.cover,
      hasVerifiedEditorialImage(article)
        ? article.heroImage.src.startsWith("/")
          ? `${SITE}${article.heroImage.src}`
          : article.heroImage.src
        : null,
      `${item.slug} bypassed the approved-editorial cover gate.`,
    );
  }

  const withheldCoverCount = expected.filter((item) => item.cover === null).length;
  assert.deepEqual(payload.media, {
    withheldCoverCount,
    approvedCoverCount: expected.length - withheldCoverCount,
    limited: withheldCoverCount > 0,
  });
  assert.equal(payload.available, expected.length > 0);
  assert.equal(payload.state, expected.length > 0 ? "available" : "withheld");
  assert.equal(
    payload.reason,
    expected.length > 0
      ? withheldCoverCount > 0
        ? `${withheldCoverCount} latest report${withheldCoverCount === 1 ? "" : "s"} rendered text-only because UHD media approval is pending.`
        : null
      : "No reviewed live article is currently available.",
  );

  const newestPublishedAt = expected[0]?.publishedAt ?? null;
  const newestTime = newestPublishedAt
    ? new Date(newestPublishedAt).getTime()
    : Number.NaN;
  const ageMs = Number.isFinite(newestTime)
    ? Math.max(0, nowMs - newestTime)
    : null;
  assert.deepEqual(payload.freshness, {
    state:
      ageMs === null
        ? "empty"
        : ageMs <= FRESH_WINDOW_HOURS * HOUR_MS
          ? "fresh"
          : "stale",
    newestPublishedAt,
    ageHours: ageMs === null ? null : Math.round(ageMs / HOUR_MS),
    thresholdHours: FRESH_WINDOW_HOURS,
  });
  assert.equal(
    new Date(payload.generatedAt).toISOString(),
    payload.generatedAt,
    "generatedAt must remain an ISO timestamp.",
  );
}

async function main() {
  assert.equal(revalidate, 1800, "The route revalidation interval changed.");

  const expected = expectedItems();
  assert.ok(expected.length > 0, "The local registry has no reviewed live front items.");
  const newestTime = new Date(expected[0].publishedAt).getTime();
  assert.ok(Number.isFinite(newestTime), "The newest front item has an invalid date.");

  const freshNow = newestTime + 47 * HOUR_MS;
  const fresh = await getFrontAt(freshNow);
  assert.equal(fresh.response.status, 200);
  assertContractHeaders(fresh.response, "GET");
  assert.match(
    fresh.response.headers.get("Content-Type") ?? "",
    /^application\/json\b/,
  );
  assertPayload(fresh.payload, expected, freshNow);
  assert.equal(fresh.payload.freshness.state, "fresh");

  const staleNow = newestTime + 49 * HOUR_MS;
  const stale = await getFrontAt(staleNow);
  assert.equal(stale.response.status, 200);
  assertContractHeaders(stale.response, "GET");
  assertPayload(stale.payload, expected, staleNow);
  assert.equal(stale.payload.freshness.state, "stale");

  const preflight = OPTIONS();
  assert.equal(preflight.status, 204);
  assertContractHeaders(preflight, "OPTIONS");
  assert.equal(await preflight.text(), "");

  console.log(
    `Front contract ${FRONT_SCHEMA_VERSION} passed: ${expected.length} live items, ${fresh.payload.media.approvedCoverCount} approved covers, fresh/stale states, GET/OPTIONS headers.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
