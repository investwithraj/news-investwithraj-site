import assert from "node:assert/strict";

import { buildCitations } from "../lib/news-review/draft-engine.js";
import type { Cluster } from "../lib/pipeline/types.js";

const CITED_URL =
  "https://www.reuters.com/world/middle-east/dubai-property-test-source";
const UNRELATED_CLUSTER_URL =
  "https://www.thenationalnews.com/business/property/unrelated-cluster-source/";
const SECOND_CITED_URL =
  "https://www.reuters.com/world/middle-east/second-explicit-source";
const REUTERS_CATEGORY_URL = "https://www.reuters.com/world/middle-east/";
const REUTERS_SEARCH_URL =
  "https://www.reuters.com/site-search/?query=dubai+real+estate";
const NATIONAL_CATEGORY_URL =
  "https://www.thenationalnews.com/business/property/";
const NOW = "2026-09-08T04:00:00.000Z";

const cluster: Cluster = {
  id: "citation-boundary",
  topic: "A discovery cluster cannot expand the evidence packet",
  entries: [
    {
      id: "unrelated-cluster-entry",
      title: "Unrelated discovery headline",
      url: UNRELATED_CLUSTER_URL,
      publishedAt: NOW,
      summary: "Discovery-only text.",
      source: {
        name: "The National",
        tier: "national-press",
        domain: "thenationalnews.com",
      },
    },
  ],
  score: 50,
  scoreBreakdown: {
    uhnwRelevance: 10,
    sourceTier: 20,
    freshness: 10,
    rajAngle: 10,
  },
  entities: {
    developers: [],
    places: ["Dubai"],
    figures: [],
    hasTier1Source: false,
  },
  suggestedCategory: "market-pulse",
  suggestedMarkets: ["Dubai"],
};

const citations = buildCitations(
  [
    {
      source: "untrusted model label",
      url: `${CITED_URL}?utm_source=cluster-test#fragment`,
    },
    {
      source: "another untrusted model label",
      url: SECOND_CITED_URL,
    },
    { source: "Reuters", url: REUTERS_CATEGORY_URL },
    { source: "Reuters", url: REUTERS_SEARCH_URL },
    { source: "The National", url: NATIONAL_CATEGORY_URL },
  ],
  cluster,
  ["reuters.com", "thenationalnews.com"],
  NOW,
);

assert.equal(citations.length, 2);
assert.equal(citations[0]?.url, CITED_URL);
assert.equal(citations[1]?.url, SECOND_CITED_URL);
assert.notEqual(citations[0]?.source, "untrusted model label");
assert.equal(
  new Set(citations.map((citation) => citation.source)).size,
  1,
  "distinct exact URLs from one canonical publisher must be retained without pretending to be two publishers",
);
assert.equal(
  citations.some((citation) => citation.url === UNRELATED_CLUSTER_URL),
  false,
  "an unrelated cluster source the model did not cite must never be appended",
);
for (const navigationUrl of [
  REUTERS_CATEGORY_URL,
  REUTERS_SEARCH_URL,
  NATIONAL_CATEGORY_URL,
]) {
  assert.equal(
    citations.some((citation) => citation.url === navigationUrl),
    false,
    `${navigationUrl} is navigation/search, not an exact article or release`,
  );
}

console.log(
  "Draft-citation regression passed: only explicit model-cited canonical URLs enter the direct-fetch packet.",
);
