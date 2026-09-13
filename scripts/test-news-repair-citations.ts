import assert from "node:assert/strict";

import { selectRepairCitations } from "../lib/news-review/repair-citations.js";
import type { DraftArticle, NewsDraftProvenance } from "../lib/news-review/types.js";

// Synthetic records only: no providers, network requests or private draft writes.
const NOW = "2026-09-13T04:00:00.000Z";
const FIRST = "https://dubailand.gov.ae/en/news/repair-citation-fixture";
const SECOND = "https://www.reuters.com/world/middle-east/repair-citation-fixture";
const THIRD = "https://www.thenationalnews.com/business/property/repair-citation-fixture/";
const UNSELECTED = "https://www.reuters.com/world/middle-east/not-currently-cited";
const REDIRECT = "https://dubailand.gov.ae/en/news/redirected-fixture";

const article: DraftArticle = {
  slug: "repair-citation-fixture",
  title: "Citation selection fixture",
  subtitle: "Synthetic copy for a selection-only test.",
  publishedAt: NOW,
  modifiedAt: NOW,
  displayDate: "13 September 2026",
  author: "raj-tomar",
  tier: "news",
  format: "short-update",
  category: "regulatory",
  market: ["Dubai"],
  tldr: ["First fixture summary.", "Second fixture summary.", "Third fixture summary."],
  body: "These fixtures exercise citation selection, not publication approval.",
  faq: [],
  citations: [
    { source: "Dubai Land Department", url: FIRST, accessedAt: NOW, tier: "government" },
    { source: "Reuters", url: SECOND, accessedAt: NOW, tier: "national-press" },
    { source: "The National", url: THIRD, accessedAt: NOW, tier: "national-press" },
  ],
  heroImage: { src: "/fixture.jpg", alt: "Fixture", credit: "Fixture" },
  cta: { href: "https://investwithraj.com/engage", label: "Fixture" },
  distribution: {},
};

const evidence: NonNullable<NewsDraftProvenance["fetchedEvidence"]> = [THIRD, SECOND, FIRST, UNSELECTED]
  .map((url, index) => ({
    url,
    finalUrl: url === FIRST ? REDIRECT : url,
    text: `Independently fetched synthetic source text ${index}.`,
    fetchedAt: NOW,
    contentHash: `fixture-hash-${index}`,
    sourcePublishedAt: "2026-09-12T08:00:00.000Z",
    sourceDateSource: "meta",
    freshnessCheckedAt: NOW,
    freshnessMaxAgeHours: 72,
  }));

const before = structuredClone({ article, evidence });
for (const record of [...article.citations, ...evidence]) Object.freeze(record);
Object.freeze(article.citations);
Object.freeze(evidence);
Object.freeze(article);

const selectedUrls = Object.freeze([THIRD, FIRST]);
const subset = selectRepairCitations(article, evidence, selectedUrls);
assert.equal(subset.ok, true);
assert.deepEqual(subset.citations, [article.citations[0], article.citations[2]]);
assert.deepEqual(subset.evidence, [evidence[2], evidence[0]]);
assert.deepEqual(selectedUrls, [THIRD, FIRST], "model selection must not be reordered in place");
assert.notEqual(subset.citations, article.citations);
assert.notEqual(subset.evidence, evidence);
assert.notEqual(subset.citations[0], article.citations[0]);
assert.notEqual(subset.evidence[0], evidence[2]);
subset.citations[0].source = "Changed returned citation";
subset.evidence[0].text = "Changed returned evidence";
subset.evidence[0].contentHash = "Changed returned hash";
subset.citations.pop();
subset.evidence.pop();
assert.deepEqual({ article, evidence }, before, "changing returned records/arrays cannot mutate the original packet");

const omitted = selectRepairCitations(article, evidence, undefined);
assert.equal(omitted.ok, true);
assert.deepEqual(omitted.citations, article.citations);
assert.deepEqual(omitted.evidence, evidence, "omission cannot infer a subset or prune existing uncited evidence");
for (let index = 0; index < article.citations.length; index++) {
  assert.notEqual(omitted.citations[index], article.citations[index]);
}
for (let index = 0; index < evidence.length; index++) {
  assert.notEqual(omitted.evidence[index], evidence[index]);
}
omitted.citations[1].url = UNSELECTED;
omitted.evidence[1].freshnessCheckedAt = "changed";
assert.deepEqual({ article, evidence }, before);

function rejects(raw: unknown, pattern: RegExp, input = article, records = evidence) {
  const result = selectRepairCitations(input, records, raw);
  assert.equal(result.ok, false, `selection should fail: ${String(raw)}`);
  if (result.ok) throw new Error("Expected rejected selection");
  assert.match(result.reason, pattern);
}

for (const raw of [null, false, true, 0, FIRST, { citationUrls: [FIRST] }, new Set([FIRST]), []]) {
  rejects(raw, /nonempty array/u);
}
for (const raw of [[null], [undefined], [1], [false], [{}], [[FIRST]], [""], [FIRST, null], Array(1)]) {
  rejects(raw, /only nonempty exact URL strings/u);
}
rejects([FIRST, FIRST], /duplicate/u);
for (const raw of [
  [UNSELECTED],
  ["https://unknown.example/new-source"],
  [REDIRECT],
  [` ${FIRST}`],
  [`${FIRST} `],
  [`${FIRST}?utm_source=repair`],
  [`${FIRST}#source`],
  [FIRST.toUpperCase()],
  [{ url: FIRST, source: "Model-owned metadata" }],
]) {
  rejects(raw, /cannot add or alter|only nonempty exact URL strings/u);
}

rejects([FIRST], /already-fetched evidence/u, article, evidence.filter((record) => record.url !== FIRST));
rejects([FIRST], /already-fetched evidence/u, article, [{ ...evidence[2], url: UNSELECTED, finalUrl: FIRST }]);
const citationWithoutFetch = { ...article, citations: [...article.citations, { ...article.citations[0], url: "https://dubailand.gov.ae/en/news/not-fetched" }] };
rejects([citationWithoutFetch.citations[3].url], /already-fetched evidence/u, citationWithoutFetch);

const withBasis: DraftArticle = {
  ...article,
  reportingBasis: { sourceUrl: SECOND, speaker: "Fixture Speaker", organization: "Fixture Company", statementKind: "corporate-intent" },
};
const basisBefore = structuredClone(withBasis);
rejects([FIRST, THIRD], /retain the exact reportingBasis sourceUrl/u, withBasis);
const basisSubset = selectRepairCitations(withBasis, evidence, [THIRD, SECOND]);
assert.equal(basisSubset.ok, true);
assert.deepEqual(basisSubset.citations.map((citation) => citation.url), [SECOND, THIRD]);
assert.deepEqual(basisSubset.evidence.map((record) => record.url), [SECOND, THIRD]);
assert.deepEqual(withBasis, basisBefore, "selection must not change reportingBasis or any article field");
assert.equal(selectRepairCitations(withBasis, evidence, undefined).ok, true);

// Membership is against the CURRENT packet, never a prior repair's original set.
const reducedArticle = { ...article, citations: [article.citations[0]] };
rejects([SECOND], /cannot add or alter/u, reducedArticle);

// Do not silently discard records when multiple fetched records have one URL.
const extraEvidence = { ...evidence[2], contentHash: "second-retained-record" };
const duplicateEvidence = selectRepairCitations(article, [...evidence, extraEvidence], [FIRST]);
assert.equal(duplicateEvidence.ok, true);
assert.deepEqual(duplicateEvidence.evidence, [evidence[2], extraEvidence]);
assert.deepEqual({ article, evidence }, before, "rejected and successful selections leave all inputs unchanged");

console.log("Repair-citation selection passed: strict explicit current/fetched URL subsets, original order, detached records, reporting-basis retention, no inferred selection.");
