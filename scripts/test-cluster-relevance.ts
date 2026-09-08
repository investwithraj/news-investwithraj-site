import assert from "node:assert/strict";

import { clusterAndScore } from "../lib/pipeline/cluster.js";
import type { RawEntry } from "../lib/sources/fetchers/types.js";

function entry(
  id: string,
  title: string,
  summary: string,
  source: RawEntry["source"] = {
    name: "Official test source",
    tier: "government",
    domain: "example.gov.ae",
  },
): RawEntry {
  return {
    id,
    title,
    summary,
    url: `https://example.gov.ae/news/${id}`,
    publishedAt: new Date().toISOString(),
    source,
  };
}

function scoreBeforeHeadlineBonus(
  cluster: ReturnType<typeof clusterAndScore>[number],
): number {
  const breakdown = cluster.scoreBreakdown;
  return Math.round(
    breakdown.uhnwRelevance * 0.3 +
      breakdown.sourceTier * 0.25 +
      breakdown.freshness * 0.2 +
      breakdown.rajAngle * 0.25,
  );
}

// A short developer name must be a complete token, never a substring of an
// unrelated publisher/editorial word.
const magazineProperty = clusterAndScore([
  entry(
    "magazine-property",
    "Property magazine reviews housing activity",
    "A residential market editorial.",
  ),
]);
assert.equal(magazineProperty.length, 1);
assert.deepEqual(magazineProperty[0].entities.developers, []);
assert.notEqual(magazineProperty[0].id, "dev--mag");
assert.equal(
  clusterAndScore([
    entry(
      "magazine-lifestyle",
      "Design magazine publishes its annual lifestyle issue",
      "Interviews cover fashion, food and travel.",
    ),
  ]).length,
  0,
  "magazine must not manufacture a MAG developer match",
);

// ADGM is a precise named entity, like DIFC, and can carry a first-party
// institutional release through the gate without inventing a property angle.
const adgm = clusterAndScore([
  entry(
    "adgm-h1",
    "ADGM reinforces Abu Dhabi's position as global financial hub",
    "The official H1 release reports licence, entity and workforce results.",
  ),
]);
assert.equal(adgm.length, 1);
assert.deepEqual(adgm[0].entities.places, ["ADGM"]);
assert.equal(adgm[0].id, "place--adgm");

// The new property phrases must earn the explicit 15-point headline bonus.
const seiSaadiyat = clusterAndScore([
  entry(
    "sei-saadiyat",
    "Aldar unveils Sei Saadiyat residential project",
    "The release covers the first homes in the Saadiyat development.",
  ),
]);
assert.equal(seiSaadiyat.length, 1);
assert.equal(
  seiSaadiyat[0].score,
  Math.min(100, scoreBeforeHeadlineBonus(seiSaadiyat[0]) + 15),
  "residential project must receive the property-headline bonus",
);

// Cluster insertion order must not hide a qualifying headline in a later
// source entry. Both entries deliberately share the Meraas + City Walk entity
// signature while only the second headline is a property headline.
const crestlane = clusterAndScore([
  entry(
    "crestlane-corporate",
    "Meraas publishes a City Walk corporate update",
    "The statement contains a general management update.",
  ),
  entry(
    "crestlane-contract",
    "Meraas awards construction contract for City Walk Crestlane",
    "The contract covers the next phase of the development.",
  ),
]);
assert.equal(crestlane.length, 1);
assert.equal(crestlane[0].topic, "Meraas publishes a City Walk corporate update");
assert.equal(
  crestlane[0].score,
  Math.min(100, scoreBeforeHeadlineBonus(crestlane[0]) + 15),
  "any qualifying headline in the cluster must receive the bonus",
);

// High-tier freshness is not enough on its own for unrelated finance or
// lifestyle coverage to enter the property candidate pool.
const unrelated = clusterAndScore([
  entry(
    "liquidity",
    "Central bank reviews overnight liquidity facilities",
    "The notice concerns interbank settlement operations.",
  ),
  entry(
    "travel",
    "Travel journal names its favourite restaurant openings",
    "The lifestyle list covers dining and culture.",
  ),
]);
assert.equal(unrelated.length, 0);

console.log(
  "Cluster relevance regression passed: bounded entities, ADGM, property phrases, cluster-wide bonus and off-desk filtering.",
);
