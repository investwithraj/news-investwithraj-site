import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { VerifiedSource } from "../lib/sources/registry.js";
import {
  summarizeFetchRun,
  type FetchResult,
  type FetchRun,
  type RawEntry,
} from "../lib/sources/fetchers/index.js";
import { checkOfficialSourceHealth } from "../lib/sources/fetchers/health.js";
import {
  normalizeKnownBingNewsLink,
  parseRssDocument,
} from "../lib/sources/fetchers/rss.js";

const fixture = (name: string) =>
  new URL(`./fixtures/source-truth/${name}`, import.meta.url);

const googleSource: VerifiedSource = {
  name: "Google News · Dubai real estate",
  url: "https://news.google.com",
  tier: "national-press",
  market: ["Dubai"],
  fetchType: "rss",
  rssUrl: "https://news.google.com/rss/search?q=Dubai",
  citable: false,
};

const bingSource: VerifiedSource = {
  name: "Bing News · Dubai real estate",
  url: "https://www.bing.com",
  tier: "national-press",
  market: ["Dubai"],
  fetchType: "rss",
  rssUrl: "https://www.bing.com/news/search?q=Dubai&format=rss",
  citable: false,
};

function source(name: string, domain: string): VerifiedSource {
  return {
    name,
    url: `https://${domain}`,
    tier: "industry-portal",
    market: ["Dubai"],
    fetchType: "webfetch",
  };
}

function entry(owner: VerifiedSource, publishedAt: string): RawEntry {
  return {
    id: `${owner.name}-entry`,
    title: `${owner.name} publishes an item`,
    url: `${owner.url}/news/item`,
    publishedAt,
    summary: "Fixture summary.",
    source: {
      name: owner.name,
      tier: owner.tier,
      domain: new URL(owner.url).hostname,
    },
  };
}

function fetchResult(
  owner: VerifiedSource,
  entries: RawEntry[],
  error: string | null,
): FetchResult {
  return { source: owner, entries, error, durationMs: 5 };
}

async function main(): Promise<void> {
  const googleXml = await readFile(fixture("google-news.xml"), "utf8");
  const googleEntries = parseRssDocument(googleXml, googleSource);
  assert.equal(googleEntries.length, 3);

  const known = googleEntries.find((item) => item.id === "google-known");
  assert.ok(known);
  assert.equal(known.title, "Dubai office demand strengthens");
  assert.deepEqual(known.source, {
    name: "Gulf News — Property",
    tier: "national-press",
    domain: "gulfnews.com",
  });

  const unknown = googleEntries.find((item) => item.id === "google-unknown");
  assert.ok(unknown);
  assert.equal(unknown.title, "Waterfront launch announced");
  assert.deepEqual(unknown.source, {
    name: "Example Wire",
    tier: "industry-portal",
    domain: "example-wire.invalid",
  });

  const missing = googleEntries.find((item) => item.id === "google-missing");
  assert.ok(missing);
  assert.equal(missing.source.name, googleSource.name);
  assert.equal(missing.source.tier, "industry-portal");
  assert.equal(missing.source.domain, "news.google.com");

  const bingXml = await readFile(fixture("bing-news.xml"), "utf8");
  const bingEntries = parseRssDocument(bingXml, bingSource);
  assert.equal(
    bingEntries.length,
    1,
    "only the exact same-host Bing legacy wrapper may be upgraded to HTTPS",
  );
  assert.match(
    bingEntries[0].url,
    /^https:\/\/www\.bing\.com\/news\/apiclick\.aspx\?/u,
  );
  assert.equal(
    bingEntries[0].source.tier,
    "industry-portal",
    "an aggregator without a registry-bound publisher URL gets no national-press authority",
  );
  assert.equal(
    normalizeKnownBingNewsLink(
      "http://www.bing.com/news/other.aspx?url=https%3A%2F%2Fexample.com",
      "bing.com",
    ),
    "http://www.bing.com/news/other.aspx?url=https%3A%2F%2Fexample.com",
  );
  assert.equal(
    normalizeKnownBingNewsLink(
      "http://bing.com.attacker.invalid/news/apiclick.aspx",
      "bing.com",
    ),
    "http://bing.com.attacker.invalid/news/apiclick.aspx",
  );

  const producer = source("Dated producer", "producer.example");
  const empty = source("Empty source", "empty.example");
  const failed = source("Failed source", "failed.example");
  const results = [
    fetchResult(producer, [entry(producer, "2026-09-08T04:00:00.000Z")], null),
    fetchResult(empty, [], null),
    fetchResult(failed, [], "Source request failed (503)."),
  ];
  const run: FetchRun = {
    startedAt: "2026-09-08T04:00:00.000Z",
    finishedAt: "2026-09-08T04:00:01.000Z",
    results,
    totalEntries: 1,
    okCount: 2,
    errorCount: 1,
    transportOkCount: 2,
    datedEntrySourceCount: 1,
    emptySourceCount: 1,
  };
  const summary = summarizeFetchRun(run);
  assert.match(summary, /Transport responses: 2\/3 sources/u);
  assert.match(summary, /Dated-entry producers: 1\/3 sources \(1 entries\)/u);
  assert.match(summary, /returned no dated entries[\s\S]*Empty source/u);
  assert.match(summary, /source transport error[\s\S]*Failed source/u);
  assert.doesNotMatch(summary, /healthy/iu);

  const datedHtml = await readFile(fixture("dated-index.html"), "utf8");
  const transportOnlyHtml = await readFile(
    fixture("transport-only.html"),
    "utf8",
  );
  const directSource: VerifiedSource = {
    ...source("Fixture developer", "developer.example"),
    fetchUrl: "https://developer.example/media",
    directFetchEnabled: true,
  };
  let receivedMaxBytes = 0;
  const [datedHealth] = await checkOfficialSourceHealth([directSource], {
    fetchBytesImpl: async (_input, options) => {
      receivedMaxBytes = options.maxBytes;
      assert.deepEqual(options.allowedDomains, ["developer.example"]);
      assert.equal(options.maxRedirects, 3);
      return {
        bytes: Buffer.from(datedHtml),
        finalUrl: directSource.fetchUrl!,
        contentType: "text/html",
      };
    },
  });
  assert.equal(receivedMaxBytes, 2 * 1024 * 1024);
  assert.equal(datedHealth.transportOk, true);
  assert.equal(datedHealth.discoveryOk, true);
  assert.equal(datedHealth.discoveryState, "dated-entries");
  assert.equal(datedHealth.entryCount, 1);
  assert.equal(datedHealth.newestPublishedAt, "2026-09-08T03:00:00.000Z");

  const [transportOnly] = await checkOfficialSourceHealth([directSource], {
    fetchBytesImpl: async () => ({
      bytes: Buffer.from(transportOnlyHtml),
      finalUrl: directSource.fetchUrl!,
      contentType: "text/html",
    }),
  });
  assert.equal(transportOnly.ok, true);
  assert.equal(transportOnly.transportOk, true);
  assert.equal(transportOnly.discoveryOk, false);
  assert.equal(transportOnly.discoveryState, "transport-only");
  assert.equal(transportOnly.entryCount, 0);
  assert.match(transportOnly.error ?? "", /no explicitly dated candidates/u);

  const redirectFixture = JSON.parse(
    await readFile(fixture("off-host-redirect.json"), "utf8"),
  ) as { finalUrl: string; contentType: string; body: string };
  const [offHost] = await checkOfficialSourceHealth([directSource], {
    fetchBytesImpl: async () => ({
      bytes: Buffer.from(redirectFixture.body),
      finalUrl: redirectFixture.finalUrl,
      contentType: redirectFixture.contentType,
    }),
  });
  assert.equal(offHost.ok, false);
  assert.equal(offHost.transportOk, false);
  assert.equal(offHost.discoveryOk, false);
  assert.equal(offHost.discoveryState, "review");
  assert.match(offHost.error ?? "", /outside the approved HTTPS host boundary/u);

  console.log(
    "Source-truth reporting regression passed: registry-bound publisher authority, exact Bing normalization, transport/dated-entry summaries, bounded health fetches and transport-only state are deterministic.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
