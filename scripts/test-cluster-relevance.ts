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
    "A Dubai residential market editorial.",
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

// These exact headlines consumed two research attempts in hosted run
// 34740233471. Publisher location/tier and property words are not a UAE link.
const foreignVisaTitle =
  "New Zealand Golden Visa Adds Rental Housing Option From December";
const foreignVillaTitle =
  "V Escapes expands luxury portfolio with the launch of Villa Moira in Goa";
const publisherFixtures: RawEntry["source"][] = [
  { name: "Zawya", tier: "regional-press", domain: "zawya.com" },
  { name: "Dubai Eye", tier: "national-press", domain: "dubaieye1038.com" },
  { name: "UAE official source", tier: "government", domain: "example.gov.ae" },
  { name: "Reuters", tier: "national-press", domain: "reuters.com" },
];
for (const source of publisherFixtures) {
  assert.equal(
    clusterAndScore([
      entry("foreign-visa", foreignVisaTitle, foreignVisaTitle, source),
      entry("foreign-villa", foreignVillaTitle, foreignVillaTitle, source),
      entry("unlocated", "Luxury property market records new sales", "", source),
    ]).length,
    0,
    `${source.name} must not confer UAE relevance on foreign/unlocated stories`,
  );
}

// Developer names, RERA and generic community-like words occur overseas too.
for (const [id, title, summary] of [
  ["sobha-india", "Sobha launches luxury apartments in Bengaluru", "The residential project is in India."],
  ["wynn-macau", "Wynn Resorts announces luxury residences in Macau", "The developer announces its new project."],
  ["rera-india", "RERA sets escrow rules for Mumbai property developers", "The housing rules cover Maharashtra."],
  ["foreign-valley", "Luxury villas launch in the valley near Cape Town", "The developer reports new off-plan sales."],
  ["foreign-square", "Rental apartments planned beside the town square in London", "The launch includes waterfront housing."],
  ["dubai-origin", foreignVillaTitle, "The Dubai-based company is expanding its Indian holiday-home portfolio."],
  ["uae-origin", foreignVillaTitle, "The company is headquartered in the UAE and operates holiday homes in India."],
  ["substring-city", "Luxury villa market grows in Dubailandia", "A housing report on this fictional foreign city."],
]) {
  assert.equal(
    clusterAndScore([entry(id, title, summary)]).length,
    0,
    `${id} must not manufacture a UAE market link`,
  );
}

// Local content is eligible regardless of publisher. Specific projects and
// institutional aliases need no repeated "Dubai" or "UAE" label in the copy.
for (const [id, title, summary] of [
  ["explicit-dubai", "Dubai property sales rise", "The update covers residential transactions."],
  ["summary-uae", "Golden Visa property rules clarified", "The United Arab Emirates announces new residency procedures."],
  ["fujairah", "Fujairah announces residential development", "New housing is planned."],
  ["umm-al-quwain", "Umm Al Quwain waterfront villas launch", "The developer outlines the project."],
  ["dld", "DLD publishes property transaction update", "The release reports residential sales."],
  ["jvc", "JVC apartment rents increase", "The residential market update covers new leases."],
  ["saadiyat", "Aldar unveils Sei Saadiyat residential project", "The developer announces the first homes."],
  ["valley", "Emaar launches villas at The Valley", "The community adds new homes."],
  ["oasis", "Emaar unveils new mansions at The Oasis", "The residential development enters a new phase."],
  ["square", "Nshama launches apartments at Town Square", "The residential development adds new homes."],
  ["district-one", "Nakheel awards District One construction contract", "The developer announces a project milestone."],
  ["difc", "DIFC announces family office expansion", "The financial centre reports new registrations."],
  ["uae-linked-overseas", "UK property investment fund opens to UAE investors", "The fund announces cross-border access for local investors."],
  ["uae-linked-rates", "US interest rate cut affects UAE mortgage lending", "Banks explain the effect on residential borrowing."],
  ["local-origin-project", "Dubai-based developer launches apartments", "The new residential project is on Yas Island."],
]) {
  assert.equal(
    clusterAndScore([entry(id, title, summary, publisherFixtures[3])]).length,
    1,
    `${id} must retain its content-based UAE relevance`,
  );
}

// The geographic filter must operate before broad policy/developer grouping,
// not on the combined text afterwards. Test both insertion orders, because the
// first entry supplies the topic. Rejected items must not alter scores either.
const localVisa = entry(
  "local-visa",
  "UAE Golden Visa property investment rules clarified",
  "The announcement concerns residency for property investors.",
);
const foreignVisa = entry("foreign-visa", foreignVisaTitle, foreignVisaTitle);
const localSobha = entry(
  "local-sobha",
  "Sobha announces Dubai property sales results",
  "The developer reports its residential sales.",
);
const foreignSobha = entry(
  "foreign-sobha",
  "Sobha announces Bengaluru property sales results",
  "The developer reports its Indian residential sales.",
);
for (const [local, foreign] of [[localVisa, foreignVisa], [localSobha, foreignSobha]]) {
  const expected = clusterAndScore([local]);
  for (const inputs of [[foreign, local], [local, foreign]]) {
    assert.deepEqual(
      clusterAndScore(inputs),
      expected,
      "foreign entries must not contaminate a local cluster, topic, entities or score",
    );
  }
}

// Filtering happens before the top-N cap as well as before paid research.
assert.deepEqual(
  clusterAndScore([
    foreignVisa,
    entry("foreign-villa", foreignVillaTitle, "Luxury villa investors examine the launch, off-plan yield, ROI and payment plan."),
    localVisa,
  ], 1).map((cluster) => cluster.topic),
  [localVisa.title],
  "irrelevant high-scoring stories must not consume bounded candidate slots",
);

console.log(
  "Cluster relevance regression passed: bounded entities, UAE linkage before grouping/ranking, foreign-headline exclusions, local aliases, international UAE links and mixed-cluster isolation.",
);
