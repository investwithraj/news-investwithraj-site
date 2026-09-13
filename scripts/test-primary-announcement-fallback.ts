import assert from "node:assert/strict";

import { clusterAndScore, isTimelyPrimaryPropertyEntry } from "../lib/pipeline/cluster.js";
import { selectDraftClusters } from "../lib/news-review/manual-candidate.js";
import type { Cluster } from "../lib/pipeline/types.js";
import type { RawEntry } from "../lib/sources/fetchers/types.js";

const NOW = new Date("2026-09-13T06:12:34.000Z");
const HOUR = 60 * 60 * 1_000;
// Real observed WAM headline/date; no source body or network calls are needed.
const government: RawEntry = {
  id: "wam-groundbreaking",
  title: "Dubai Healthcare City marks groundbreaking of AED3 billion Dubai Creek Gardens residential development",
  url: "https://www.wam.ae/en/article/c26dded-dubai-healthcare-city-marks-groundbreaking-aed3",
  publishedAt: "2026-09-10T15:48:35.069Z",
  summary: "",
  source: { name: "WAM (Emirates News Agency)", domain: "wam.ae", tier: "government" },
};
// A plain, synthetic first-party developer release without luxury/angle words.
const developer: RawEntry = {
  id: "developer-fixture",
  title: "Nakheel completes Dubai residential development",
  url: "https://www.nakheel.com/media-centre/press-release/news-detail/plain-residential-development-fixture",
  publishedAt: new Date(NOW.getTime() - HOUR).toISOString(),
  summary: "(WebFetch source — full content extracted in-session from Nakheel)",
  source: { name: "Nakheel", domain: "nakheel.com", tier: "industry-portal" },
};

const originalNow = Date.now;
Date.now = () => NOW.getTime();
try {
  const governmentCluster = clusterAndScore([government])[0];
  const developerCluster = clusterAndScore([developer])[0];
  assert.ok(governmentCluster && developerCluster);
  assert.equal(governmentCluster.score, 39, "The real 62-hour plain government headline falls below 45.");
  assert.deepEqual(governmentCluster.scoreBreakdown, { uhnwRelevance: 0, sourceTier: 70, freshness: 30, rajAngle: 0 });
  assert.equal(developerCluster.score, 44, "A fresh plain developer announcement can miss 45 even within two hours.");
  assert.deepEqual(developerCluster.scoreBreakdown, { uhnwRelevance: 0, sourceTier: 35, freshness: 100, rajAngle: 0 });
  for (const cluster of [governmentCluster, developerCluster]) {
    assert.deepEqual(selectDraftClusters([cluster], 45, "auto", NOW), [cluster]);
    assert.equal(cluster.score < 45, true, "Fallback eligibility must not rewrite ranking scores.");
  }
  assert.deepEqual(selectDraftClusters([developerCluster, governmentCluster], 45, "auto", NOW), [developerCluster],
    "Only one fallback may be selected, preserving the incoming rank order.");
  const ranked: Cluster = { ...governmentCluster, id: "ordinary-ranked", score: 55 };
  const secondRanked: Cluster = { ...governmentCluster, id: "ordinary-second-ranked", score: 49 };
  assert.deepEqual(selectDraftClusters([ranked, developerCluster, secondRanked, governmentCluster], 45, "auto", NOW), [ranked, secondRanked],
    "A nonempty ordinary pool must not gain a fallback or have its order changed.");

  function expectRejected(label: string, patch: Partial<RawEntry>): void {
    const entry: RawEntry = { ...government, ...patch };
    assert.equal(isTimelyPrimaryPropertyEntry(entry, NOW.getTime()), false, label);
    const candidate: Cluster = { ...governmentCluster, topic: entry.title, entries: [entry] };
    assert.deepEqual(selectDraftClusters([candidate], 45, "auto", NOW), [], label);
  }
  for (const [label, publishedAt] of [
    ["older than 72 hours", new Date(NOW.getTime() - 72 * HOUR - 1).toISOString()],
    ["future", new Date(NOW.getTime() + 1).toISOString()],
    ["undated", ""], ["malformed", "not-a-date"], ["date-only", "2026-09-13"],
    ["timezone-free", "2026-09-13T06:00:00"],
  ]) expectRejected(label, { publishedAt });
  for (const age of [0, 72 * HOUR]) {
    assert.equal(isTimelyPrimaryPropertyEntry({ ...government, publishedAt: new Date(NOW.getTime() - age).toISOString() }, NOW.getTime()), true,
      "Explicit dates at both ends of the 0–72 hour window are eligible.");
  }
  assert.equal(isTimelyPrimaryPropertyEntry({ ...government, publishedAt: "2026-02-30T06:00:00Z" }, Date.parse("2026-03-02T06:00:00Z")), false,
    "A normalised impossible calendar date is not an explicit valid publication date.");
  assert.equal(isTimelyPrimaryPropertyEntry(government, NaN), false);
  expectRejected("title date cannot supply missing publication date", {
    title: "Dubai announces residential development on 13 September 2026", publishedAt: "",
  });
  for (const url of [
    "https://www.wam.ae/", "https://www.wam.ae/en", "https://www.wam.ae/en/latest-news",
    "https://www.wam.ae/en/search/dubai-residential-development",
    "https://www.wam.ae/en/category/dubai-residential-development",
    "https://www.wam.ae/api/app/articles/GetArticleBySlug",
    "https://news.google.com/rss/articles/wam-property-fixture",
    "https://www.wam.ae.evil.example/en/article/property-fixture",
    "https://unverified.wam.ae/en/article/property-fixture",
    government.url.replace("https:", "http:"),
    government.url.replace("www.wam.ae", "user@www.wam.ae"),
    government.url.replace("www.wam.ae", "www.wam.ae:8443"),
    `${government.url}?tracking=1`, `${government.url}#fragment`,
  ]) expectRejected(`noncanonical URL: ${url}`, { url });
  expectRejected("publisher metadata cannot upgrade a press source", {
    url: "https://www.reuters.com/world/middle-east/dubai-property-fixture",
    source: { name: "WAM", domain: "reuters.com", tier: "government" },
  });
  expectRejected("unknown .ae publisher is not a verified primary source", {
    url: "https://example.gov.ae/news/dubai-property-fixture",
    source: { name: "Official publisher", domain: "example.gov.ae", tier: "government" },
  });
  expectRejected("mismatched source domain", { source: { ...government.source, domain: "reuters.com" } });
  expectRejected("mismatched source tier", { source: { ...government.source, tier: "national-press" } });
  for (const title of [
    "UAE announces new diplomatic agreement with Germany",
    "Abu Dhabi opens its annual cultural summit on Saadiyat",
    "Dubai confirms new healthcare research partnership",
    "Dubai property market outlook",
    "Dubai publishes property price forecasts for investors",
    "Dubai announces celebrity penthouse home tour",
    "New Zealand Golden Visa Adds Rental Housing Option From December",
    "V Escapes announces Villa Moira in Goa",
  ]) expectRejected(`not a local property announcement: ${title}`, { title });
  expectRejected("source placeholder cannot create UAE geography", {
    title: "New Zealand announces Golden Visa rental housing rules",
    summary: "(WebFetch source — full content extracted in-session from Dubai Holding)",
  });
  expectRejected("URL location cannot supply absent content geography", { title: "Residential development breaks ground" });
  expectRejected("company origin is not a local project", {
    title: "Company announces villa development in Goa", summary: "The company is Dubai-based.",
  });
  assert.equal(isTimelyPrimaryPropertyEntry({ ...developer, title: "Nakheel announces foreign residential development", summary: "The project is in India." }, NOW.getTime()), false);
  assert.equal(isTimelyPrimaryPropertyEntry({ ...developer, url: "https://www.nakheel.com/en/media-centre" }, NOW.getTime()), false);

  const geographicBrand: RawEntry = { ...developer, id: "dubai-holding-london",
    title: "Dubai Holding announces residential development in London",
    summary: "The new housing project is in the UK.",
    url: "https://www.dubaiholding.com/en/media-hub/press-releases/residential-development-fixture",
    source: { name: "Dubai Holding", domain: "dubaiholding.com", tier: "industry-portal" },
  };
  assert.equal(isTimelyPrimaryPropertyEntry(geographicBrand, NOW.getTime()), false,
    "A verified first-party company name cannot supply geography for a London development.");
  assert.deepEqual(clusterAndScore([geographicBrand]), []);
  assert.deepEqual(selectDraftClusters([{ ...developerCluster, topic: geographicBrand.title, entries: [geographicBrand] }], 45, "auto", NOW), []);
  for (const place of ["Dubai", "Business Bay"]) {
    const localBrand = { ...geographicBrand, title: `Dubai Holding announces residential development in ${place}`, summary: "The company outlined the new housing project." };
    assert.equal(isTimelyPrimaryPropertyEntry(localBrand, NOW.getTime()), true);
    const localCluster = clusterAndScore([localBrand])[0];
    assert.ok(localCluster.entities.developers.includes("Dubai Holding"), "Local eligibility retains normal developer entities and ranking.");
    assert.deepEqual(selectDraftClusters([localCluster], 45, "auto", NOW), [localCluster]);
  }

  // A cluster cannot combine another entry's official publisher, publication
  // date or geography with its own ineligible editorial topic.
  const foreign = { ...government, title: "Company announces villa development in Goa", summary: "" };
  const split: Cluster = { ...governmentCluster, topic: foreign.title, entries: [foreign, government] };
  assert.deepEqual(selectDraftClusters([split], 45, "auto", NOW), []);
  const staleTopic = { ...government, publishedAt: "2026-08-20T00:00:00.000Z" };
  const unrelatedCurrent = { ...government, title: "Dubai announces cultural festival", publishedAt: NOW.toISOString() };
  assert.deepEqual(selectDraftClusters([{ ...governmentCluster, entries: [staleTopic, unrelatedCurrent] }], 45, "auto", NOW), []);

  const manualEntry: RawEntry = { ...government, title: "Dubai Land Department launches Initial Registration service", publishedAt: "2026-08-20T00:00:00.000Z" };
  const manual: Cluster = { ...governmentCluster, topic: manualEntry.title, entries: [manualEntry] };
  assert.deepEqual(selectDraftClusters([governmentCluster, manual], 45, "dld-initial-registration", NOW), [manual],
    "Explicit manual targets remain exact event selections, independent of fallback freshness.");
  assert.throws(() => selectDraftClusters([governmentCluster], 45, "unreviewed-story", NOW), /Unknown manual news candidate key/u);
} finally {
  Date.now = originalNow;
}

console.log("Primary announcement fallback passed: one automatic-only current direct UAE-property candidate, unchanged ranking/manual targets and no metadata/date/source bypass.");
