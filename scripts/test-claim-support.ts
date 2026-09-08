import assert from "node:assert/strict";

import {
  assessClaimSupport,
  type ClaimSupportEvidence,
  type ClaimSupportSegment,
} from "../lib/news-review/claim-support.js";

const admo: ClaimSupportEvidence = {
  url: "https://www.mediaoffice.abudhabi/en/economy/adgm-results/",
  publisher: "Abu Dhabi Media Office",
  publisherAliases: ["ADMO"],
  text: `Abu Dhabi Global Market (ADGM) said active licences reached 13,974 at the end of H1 2026. The ADGM workforce across Al Maryah Island and Al Reem Island rose to 49,027 professionals. ADGM did not report office rents in the H1 2026 release.`,
};
const gulfNews: ClaimSupportEvidence = {
  url: "https://gulfnews.com/business/markets/adgm-results-1.1",
  publisher: "Gulf News — Property",
  publisherAliases: ["Gulf News"],
  text: `ADGM's total of active licences stood at 13,974 by the end of H1 2026. Across Al Maryah Island and Al Reem Island, ADGM's professional workforce increased to 49,027. Gulf News did not identify office-rent data in the report.`,
};

function assess(
  segments: readonly ClaimSupportSegment[],
  evidence: readonly ClaimSupportEvidence[] = [admo, gulfNews],
) {
  return assessClaimSupport({ segments, evidence });
}

const paraphrase = assess([
  {
    field: "body",
    text: `ADGM's active licence total reached 13,974 at the end of H1 2026. The ADGM workforce increased to 49,027 professionals across Al Maryah Island and Al Reem Island.`,
  },
]);
assert.equal(
  paraphrase.ok,
  true,
  `bounded fact signatures should support ordinary paraphrase: ${JSON.stringify(paraphrase)}`,
);
assert.equal(paraphrase.verdict, "anchor-supported");
assert.equal(paraphrase.supported.length, 2);
assert.deepEqual(paraphrase.unusedEvidenceUrls, []);

const unrelatedFreshSource = assess(
  [
    {
      field: "body",
      text: `ADGM's active licence total reached 13,974 at the end of H1 2026.`,
    },
  ],
  [
    admo,
    {
      url: "https://example.test/unrelated-fresh-story",
      publisher: "Unrelated Publisher",
      text: "A newly opened airport terminal includes additional passenger gates and retail areas.",
    },
  ],
);
assert.equal(unrelatedFreshSource.ok, false);
assert.deepEqual(unrelatedFreshSource.unusedEvidenceUrls, [
  "https://example.test/unrelated-fresh-story",
]);

const subjectObjectSwap = assess(
  [
    {
      field: "body",
      text: "Modon acquired Aldar's coastal development.",
    },
  ],
  [
    {
      url: "https://example.test/transaction",
      publisher: "Transaction Wire",
      text: "Aldar acquired Modon's coastal development.",
    },
  ],
);
assert.equal(subjectObjectSwap.ok, false);
assert.equal(subjectObjectSwap.failures[0]?.code, "unsupported");

const numericOnlyObject = assess(
  [{ field: "body", text: "Dubai Land Department reported AED 10 million." }],
  [
    {
      url: "https://example.test/dld-numeric-only-object",
      publisher: "Dubai Land Department",
      publisherAliases: ["DLD"],
      text: "Dubai Land Department reported AED 10 million.",
    },
  ],
);
assert.equal(
  numericOnlyObject.ok,
  true,
  `an explicit subject plus exact scalar binding must support a numeric-only object: ${JSON.stringify(numericOnlyObject)}`,
);

const pronounOnly = assess(
  [{ field: "body", text: "It reached 3,986 operational entities." }],
  [
    {
      url: "https://example.test/entities",
      publisher: "Institutional News",
      text: "ADGM reached 3,986 operational entities.",
    },
  ],
);
assert.equal(pronounOnly.ok, false);
assert.equal(pronounOnly.failures[0]?.code, "ambiguous-pronoun");

const inferredAbsence = assess(
  [
    {
      field: "body",
      text: "Dubai Land Department did not announce changes to buyer fees.",
    },
  ],
  [
    {
      url: "https://example.test/dld-platform",
      publisher: "Dubai Land Department",
      publisherAliases: ["DLD"],
      text: "Dubai Land Department announced a registration platform for developers and escrow administrators.",
    },
  ],
);
assert.equal(inferredAbsence.ok, false);
assert.equal(inferredAbsence.failures[0]?.code, "negative-absence");

const explicitAbsence = assess(
  [
    {
      field: "body",
      text: "Dubai Land Department did not announce changes to buyer fees.",
    },
  ],
  [
    {
      url: "https://example.test/dld-explicit-boundary",
      publisher: "Dubai Land Department",
      publisherAliases: ["DLD"],
      text: "Dubai Land Department did not announce any change to fees paid by buyers.",
    },
  ],
);
assert.equal(
  explicitAbsence.ok,
  true,
  `explicit negative evidence should retain a passing lane: ${JSON.stringify(explicitAbsence.failures)}`,
);

const mixedDirection = assess(
  [{ field: "body", text: "ADGM workforce rose and fell in H1 2026." }],
  [admo],
);
assert.equal(mixedDirection.ok, false);
assert.equal(mixedDirection.failures[0]?.code, "mixed-signature");

const overstatedCompletion = assess(
  [{ field: "body", text: "Aldar delivered 600 coastal homes in 2026." }],
  [
    {
      url: "https://example.test/aldar-plan",
      publisher: "Aldar Properties Bots",
      publisherAliases: ["Aldar"],
      text: "Aldar expects to deliver 600 coastal homes during 2026.",
    },
  ],
);
assert.equal(overstatedCompletion.ok, false);

const plannedDelivery = assess(
  [{ field: "body", text: "Aldar expects to deliver 600 coastal homes in 2026." }],
  [
    {
      url: "https://example.test/aldar-plan",
      publisher: "Aldar Properties Bots",
      publisherDomain: "aldar.example",
      publisherAliases: ["Aldar"],
      text: "Aldar is projected to deliver 600 coastal homes during 2026.",
    },
    {
      url: "https://second.example.test/aldar-plan",
      publisher: "Independent Development Report",
      publisherDomain: "second.example.test",
      text: "Aldar expects to deliver 600 coastal homes during 2026.",
    },
  ],
);
assert.equal(
  plannedDelivery.ok,
  true,
  `equivalent forecast modality should pass: ${JSON.stringify(plannedDelivery.failures)}`,
);

const wrongDirection = assess(
  [
    {
      field: "body",
      text: "Apartment sale prices increased 0.7% quarter-on-quarter.",
    },
  ],
  [
    {
      url: "https://example.test/housing",
      publisher: "Housing Report",
      text: "Apartment sale prices declined 0.7% quarter-on-quarter.",
    },
  ],
);
assert.equal(wrongDirection.ok, false);

const publisherSwap = assess(
  [
    {
      field: "body",
      text: "Gulf News reports that ADGM active licences reached 13,974 in H1 2026.",
    },
  ],
  [admo, { ...gulfNews, text: "A separate report covered regional tourism arrivals." }],
);
assert.equal(publisherSwap.ok, false);

const bothPublisherBinding = assess([
  {
    field: "body",
    text: "Both sources report that ADGM active licences reached 13,974 in H1 2026.",
  },
]);
assert.equal(
  bothPublisherBinding.ok,
  true,
  `both-source attribution must require and accept both matching publishers: ${JSON.stringify(bothPublisherBinding.failures)}`,
);

const boundedEditorial = assess(
  [
    {
      field: "body",
      text: "ADGM records licence and entity measures separately. ADGM's active licence total reached 13,974. ADGM's operational entity count reached 3,986. ADGM's fund total reached 276. ADGM's manager total reached 190. These licence and entity measures should remain separate in this analysis.",
    },
  ],
  [
    {
      url: "https://example.test/adgm-measures",
      publisher: "ADGM",
      text: "ADGM records active licences and operational entities as separate measures. ADGM's active licence total reached 13,974. ADGM's operational entity count reached 3,986. ADGM's fund total reached 276. ADGM's manager total reached 190.",
    },
  ],
);
assert.equal(
  boundedEditorial.ok,
  true,
  `premise-bound editorial analysis should retain a narrow passing lane: ${JSON.stringify(boundedEditorial.failures)}`,
);
assert.equal(
  boundedEditorial.supported.at(-1)?.editorial,
  true,
  JSON.stringify(boundedEditorial),
);

const editorialRatioExceeded = assess(
  [
    {
      field: "body",
      text: "ADGM records licence and entity measures separately. ADGM's active licence total reached 13,974. These licence and entity measures should remain separate in this analysis.",
    },
  ],
  [
    {
      url: "https://example.test/adgm-ratio",
      publisher: "ADGM",
      text: "ADGM records active licences and operational entities as separate measures. ADGM's active licence total reached 13,974.",
    },
  ],
);
assert.equal(editorialRatioExceeded.ok, false);
assert.ok(
  editorialRatioExceeded.failures.some(
    (failure) =>
      failure.code === "editorial-overreach" && /maximum 20%/u.test(failure.detail),
  ),
);

const repeatedFact = "ADGM records licence and entity measures separately.";
const consecutiveEditorialExceeded = assess(
  [
    {
      field: "body",
      text: `${Array.from({ length: 15 }, () => repeatedFact).join(" ")} These licence and entity measures should remain separate in this analysis. These entity and licence measures should keep a narrow evidence scope. These licence and entity measures should keep specific definitions in this analysis.`,
    },
  ],
  [
    {
      url: "https://example.test/adgm-consecutive",
      publisher: "ADGM",
      text: "ADGM records active licences and operational entities as separate measures.",
    },
  ],
);
assert.equal(
  consecutiveEditorialExceeded.ok,
  false,
  JSON.stringify(consecutiveEditorialExceeded),
);
assert.ok(
  consecutiveEditorialExceeded.failures.some(
    (failure) =>
      failure.code === "editorial-overreach" &&
      /two consecutive body clauses/u.test(failure.detail),
  ),
);

const editorialNewClaim = assess(
  [
    {
      field: "body",
      text: "ADGM records licence and entity measures separately. These licence measures should remain separate because Dubai demand will rise.",
    },
  ],
  [
    {
      url: "https://example.test/adgm-measures",
      publisher: "ADGM",
      text: "ADGM records active licences and operational entities as separate measures.",
    },
  ],
);
assert.equal(editorialNewClaim.ok, false);

const tradeCall = assess(
  [
    { field: "body", text: "ADGM records licence and entity measures separately." },
    { field: "semaform.howIdTradeIt.action", text: "Watch" },
  ],
  [
    {
      url: "https://example.test/adgm-measures",
      publisher: "ADGM",
      text: "ADGM records active licences and operational entities as separate measures.",
    },
  ],
);
assert.equal(tradeCall.ok, false);
assert.equal(tradeCall.failures.at(-1)?.code, "trade-call");

const onePublisherCannotCorroborateItself = assess(
  [
    {
      field: "body",
      text: "Apartment prices were higher than villa prices.",
    },
  ],
  [
    {
      url: "https://same-publisher.test/report-a",
      publisher: "Same Publisher",
      publisherDomain: "same-publisher.test",
      text: "Apartment prices were higher than villa prices in the measured period.",
    },
    {
      url: "https://same-publisher.test/report-b",
      publisher: "Same Publisher",
      publisherDomain: "same-publisher.test",
      text: "The report found apartment prices were higher than villa prices.",
    },
  ],
);
assert.equal(onePublisherCannotCorroborateItself.ok, false);
assert.ok(
  onePublisherCannotCorroborateItself.failures.some((failure) =>
    /lacks two anchor-supporting publishers/u.test(failure.detail),
  ),
);

const ambiguousBothSources = assess(
  [
    {
      field: "body",
      text: "Both sources report that ADGM active licences reached 13,974 in H1 2026.",
    },
  ],
  [
    admo,
    gulfNews,
    {
      url: "https://third-publisher.test/adgm",
      publisher: "Third Publisher",
      text: "ADGM active licences reached 13,974 in H1 2026.",
    },
  ],
);
assert.equal(ambiguousBothSources.ok, false);
assert.ok(
  ambiguousBothSources.failures.some((failure) =>
    /ambiguous unless exactly two independent/u.test(failure.detail),
  ),
);

const copiedSentence =
  "Abu Dhabi Global Market records active licences and operational entities as separate measures across its regulated international financial centre jurisdiction";
const copied = assess(
  [{ field: "body", text: `${copiedSentence}.` }],
  [
    {
      url: "https://example.test/copied",
      publisher: "Institutional Release",
      text: `${copiedSentence}. Additional publisher context follows here.`,
    },
  ],
);
assert.equal(copied.ok, false);
assert.equal(copied.failures[0]?.code, "source-copying");

const singleTokenEntitySwap = assess(
  [{ field: "body", text: "Emaar launched waterfront homes in Dubai." }],
  [
    {
      url: "https://example.test/entity-swap",
      publisher: "Developer News",
      text: "Aldar launched waterfront homes in Dubai.",
    },
  ],
);
assert.equal(singleTokenEntitySwap.ok, false);

const adjacentPolaritySmear = assess(
  [{ field: "body", text: "Aldar did not launch waterfront homes." }],
  [
    {
      url: "https://example.test/adjacent-polarity",
      publisher: "Developer News",
      text: "No buyer fee data were reported. Aldar launched waterfront homes.",
    },
  ],
);
assert.equal(adjacentPolaritySmear.ok, false);

const partialPredicateMatch = assess(
  [{ field: "body", text: "Aldar acquired and sold coastal villas." }],
  [
    {
      url: "https://example.test/partial-predicate",
      publisher: "Transaction Wire",
      text: "Aldar acquired coastal villas.",
    },
  ],
);
assert.equal(partialPredicateMatch.ok, false);

const unknownPredicateReversal = assess(
  [{ field: "body", text: "Aldar Properties unveiled a coastal project." }],
  [
    {
      url: "https://example.test/action-reversal",
      publisher: "Developer News",
      text: "Aldar Properties cancelled a coastal project.",
    },
  ],
);
assert.equal(unknownPredicateReversal.ok, false);

const attributedPronoun = assess(
  [{ field: "body", text: "According to Reuters, it acquired coastal villas." }],
  [
    {
      url: "https://reuters.test/pronoun",
      publisher: "Reuters",
      text: "Reuters reported that Aldar acquired coastal villas.",
    },
  ],
);
assert.equal(attributedPronoun.ok, false);
assert.ok(
  attributedPronoun.failures.some(
    (failure) => failure.code === "ambiguous-pronoun",
  ),
  JSON.stringify(attributedPronoun),
);

const unsupportedSummary = assess(
  [
    { field: "body", text: "Aldar launched coastal homes in Dubai." },
    { field: "subtitle", text: "Demand accelerates." },
  ],
  [
    {
      url: "https://example.test/summary",
      publisher: "Developer News",
      text: "Aldar introduced coastal homes in Dubai.",
    },
  ],
);
assert.equal(unsupportedSummary.ok, false);

const shortVerbatim = assess(
  [{ field: "body", text: "Aldar launched waterfront homes across the Dubai coastal district." }],
  [
    {
      url: "https://example.test/short-copy",
      publisher: "Developer News",
      text: "Aldar launched waterfront homes across the Dubai coastal district.",
    },
  ],
);
assert.equal(shortVerbatim.ok, false);
assert.equal(shortVerbatim.failures[0]?.code, "source-copying");

const swappedNumericObjects = assess(
  [{ field: "body", text: "Aldar delivered 200 villas and 100 apartments." }],
  [
    {
      url: "https://example.test/numeric-swap",
      publisher: "Developer News",
      text: "Aldar delivered 100 villas and 200 apartments.",
    },
  ],
);
assert.equal(swappedNumericObjects.ok, false);

const coordinatedSubjectScalarLaundering = assess(
  [{ field: "body", text: "Aldar sold 100 villas." }],
  [
    {
      url: "https://example.test/coordinated-subject-scalars",
      publisher: "Transaction Wire",
      text: "Aldar sold 200 villas and Emaar sold 100 villas.",
    },
  ],
);
assert.equal(coordinatedSubjectScalarLaundering.ok, false);

const coordinatedDateEntityLaundering = assess(
  [{ field: "body", text: "Aldar launched Creek Tower in 2026." }],
  [
    {
      url: "https://example.test/coordinated-date-entities",
      publisher: "Development News",
      text: "Aldar launched Marina Tower in 2025 and Emaar launched Creek Tower in 2026.",
    },
  ],
);
assert.equal(coordinatedDateEntityLaundering.ok, false);

const coordinatedPredicateScalarLaundering = assess(
  [{ field: "body", text: "Aldar sold 100 villas." }],
  [
    {
      url: "https://example.test/coordinated-predicate-scalars",
      publisher: "Transaction Wire",
      text: "Aldar acquired 100 villas and sold 200 villas.",
    },
  ],
);
assert.equal(coordinatedPredicateScalarLaundering.ok, false);

const swappedDateObjects = assess(
  [
    {
      field: "body",
      text: "Creek Tower opens in 2027 and Marina Tower opens in 2028.",
    },
  ],
  [
    {
      url: "https://example.test/date-swap",
      publisher: "Development News",
      text: "Creek Tower opens in 2028 and Marina Tower opens in 2027.",
    },
  ],
);
assert.equal(swappedDateObjects.ok, false);

const reversedComparison = assess(
  [
    {
      field: "body",
      text: "Apartment sale prices were higher than villa sale prices.",
    },
  ],
  [
    {
      url: "https://publisher-one.test/comparison",
      publisher: "Publisher One",
      publisherDomain: "publisher-one.test",
      text: "Villa sale prices were higher than apartment sale prices.",
    },
    {
      url: "https://publisher-two.test/comparison",
      publisher: "Publisher Two",
      publisherDomain: "publisher-two.test",
      text: "Villa sale prices were higher than apartment sale prices.",
    },
  ],
);
assert.equal(reversedComparison.ok, false);

for (const [claim, source] of [
  [
    "Aldar Properties abandons coastal project",
    "Aldar Properties advances coastal project",
  ],
  ["Dubai demand weakens", "Dubai demand strengthens"],
] as const) {
  const reversedTitleAction = assess(
    [{ field: "title", text: claim }],
    [
      {
        url: "https://example.test/title-action-reversal",
        publisher: "Development News",
        text: source,
      },
    ],
  );
  assert.equal(reversedTitleAction.ok, false, claim);
}

const lowercaseNumericSubjectSwap = assess(
  [
    {
      field: "body",
      text: "dubai land department reported AED 10 million.",
    },
  ],
  [
    {
      url: "https://example.test/lowercase-subject-swap",
      publisher: "Dubai Land Department",
      publisherAliases: ["DLD"],
      text: "abu dhabi land department reported AED 10 million.",
    },
  ],
);
assert.equal(lowercaseNumericSubjectSwap.ok, false);

const unresolvedPassiveSubjectSwap = assess(
  [
    {
      field: "body",
      text: "AED 10 million was reported by Dubai developer Emaar.",
    },
  ],
  [
    {
      url: "https://example.test/passive-subject-swap",
      publisher: "Development News",
      text: "AED 10 million was reported by Dubai developer Aldar.",
    },
  ],
);
assert.equal(unresolvedPassiveSubjectSwap.ok, false);

const exactShortNumericSubject = assess(
  [{ field: "body", text: "Emaar reported AED 10 million." }],
  [
    {
      url: "https://example.test/exact-short-numeric-subject",
      publisher: "Development News",
      text: "Emaar reported AED 10 million.",
    },
  ],
);
assert.equal(
  exactShortNumericSubject.ok,
  true,
  JSON.stringify(exactShortNumericSubject),
);

const fullNameFromAcronym = assess(
  [
    {
      field: "body",
      text: "Abu Dhabi Global Market reached 13,974 active licences.",
    },
  ],
  [
    {
      url: "https://example.test/acronym",
      publisher: "ADGM",
      publisherAliases: ["Abu Dhabi Global Market"],
      text: "ADGM reached 13,974 active licences.",
    },
  ],
);
assert.equal(
  fullNameFromAcronym.ok,
  true,
  JSON.stringify(fullNameFromAcronym),
);

const canonicalDateOrder = assess(
  [
    {
      field: "body",
      text: "Aldar launched coastal homes on 8 September 2026.",
    },
  ],
  [
    {
      url: "https://example.test/date-order",
      publisher: "Developer News",
      text: "Aldar introduced coastal homes on September 8, 2026.",
    },
  ],
);
assert.equal(canonicalDateOrder.ok, true, JSON.stringify(canonicalDateOrder));

for (const sourceText of [
  "Aldar aims to deliver 600 coastal homes in 2026.",
  "Aldar is likely to deliver 600 coastal homes in 2026.",
  "Aldar is slated to deliver 600 coastal homes in 2026.",
  "Aldar failed to deliver 600 coastal homes in 2026.",
  "Aldar has yet to deliver 600 coastal homes in 2026.",
]) {
  const overstated = assess(
    [{ field: "body", text: "Aldar delivered 600 coastal homes in 2026." }],
    [
      {
        url: "https://example.test/modality-polarity",
        publisher: "Developer News",
        text: sourceText,
      },
    ],
  );
  assert.equal(overstated.ok, false, sourceText);
}

function independentPair(
  firstText: string,
  secondText: string,
): ClaimSupportEvidence[] {
  return [
    {
      url: "https://publisher-one.test/releases/qualifier-check",
      publisher: "Publisher One",
      publisherDomain: "publisher-one.test",
      text: firstText,
    },
    {
      url: "https://publisher-two.test/releases/qualifier-check",
      publisher: "Publisher Two",
      publisherDomain: "publisher-two.test",
      text: secondText,
    },
  ];
}

const unlikelyFromLikely = assess(
  [{
    field: "body",
    text: "Dubai Grade A office rents are unlikely to rise amid constrained supply.",
  }],
  independentPair(
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
    "Dubai Grade A office rents will probably climb while available supply remains constrained.",
  ),
);
assert.equal(unlikelyFromLikely.ok, false, JSON.stringify(unlikelyFromLikely));
assert.match(
  unlikelyFromLikely.failures.map(({ detail }) => detail).join(" | "),
  /probability polarity or strength differs/u,
);

const nestedProbability = assess(
  [{
    field: "body",
    text: "Dubai Grade A office rents may be unlikely to rise amid constrained supply.",
  }],
  independentPair(
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
    "Dubai Grade A office rents are likely to climb while available supply remains constrained.",
  ),
);
assert.equal(nestedProbability.ok, false, JSON.stringify(nestedProbability));
assert.equal(nestedProbability.failures[0]?.code, "mixed-signature");

const likelyFromPossible = assess(
  [{
    field: "body",
    text: "Dubai Grade A office rents are likely to rise amid constrained supply.",
  }],
  independentPair(
    "Dubai Grade A office rents may increase while available supply remains constrained.",
    "Dubai Grade A office rents could climb while available supply remains constrained.",
  ),
);
assert.equal(likelyFromPossible.ok, false, JSON.stringify(likelyFromPossible));
assert.match(
  likelyFromPossible.failures.map(({ detail }) => detail).join(" | "),
  /probability polarity or strength differs/u,
);

const certainFromProbable = assess(
  [{
    field: "body",
    text: "Coastal home supply will rise across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply will probably increase throughout Dubai districts.",
    "Coastal home supply will likely climb across Dubai districts.",
  ),
);
assert.equal(certainFromProbable.ok, false, JSON.stringify(certainFromProbable));
assert.match(
  certainFromProbable.failures.map(({ detail }) => detail).join(" | "),
  /probability polarity or strength differs/u,
);

const likelyFromLikely = assess(
  [{
    field: "body",
    text: "Dubai Grade A office rents are likely to rise amid constrained supply.",
  }],
  independentPair(
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
  ),
);
assert.equal(likelyFromLikely.ok, true, JSON.stringify(likelyFromLikely));

const possibleFromLikely = assess(
  [{
    field: "body",
    text: "Dubai Grade A office rents may rise amid constrained supply.",
  }],
  independentPair(
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
    "Dubai Grade A office rents are likely to increase while available supply remains constrained.",
  ),
);
assert.equal(possibleFromLikely.ok, true, JSON.stringify(possibleFromLikely));

for (const [claimModal, sourceModal] of [
  ["will", "is expected to"],
  ["will", "is forecast to"],
  ["is expected to", "will"],
  ["is forecast to", "will"],
  ["plans to", "is forecast to"],
  ["is forecast to", "plans to"],
] as const) {
  const modalityStrengthening = assess(
    [{
      field: "body",
      text: `Coastal home supply ${claimModal} rise across Dubai districts.`,
    }],
    independentPair(
      `Coastal home supply ${sourceModal} increase throughout Dubai districts.`,
      `Coastal home supply ${sourceModal} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    modalityStrengthening.ok,
    false,
    `${claimModal} <- ${sourceModal}: ${JSON.stringify(modalityStrengthening)}`,
  );
  assert.match(
    modalityStrengthening.failures.map(({ detail }) => detail).join(" | "),
    /modality differs/u,
  );
}

for (const prospectiveSource of [
  "is going to",
  "is about to",
  "is bound to",
  "is certain to",
] as const) {
  const presentFromProspective = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${prospectiveSource} increase throughout Dubai districts.`,
      `Coastal home supply ${prospectiveSource} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    presentFromProspective.ok,
    false,
    `${prospectiveSource}: ${JSON.stringify(presentFromProspective)}`,
  );
}

const presentFromBareHeadlineFuture = assess(
  [{ field: "title", text: "Aldar launches coastal homes" }],
  independentPair(
    "Aldar to introduce coastal homes throughout Dubai districts.",
    "Aldar to launch coastal homes across Dubai districts.",
  ),
);
assert.equal(
  presentFromBareHeadlineFuture.ok,
  false,
  JSON.stringify(presentFromBareHeadlineFuture),
);
assert.match(
  presentFromBareHeadlineFuture.failures.map(({ detail }) => detail).join(" | "),
  /modality differs/u,
);

const unresolvedBareInfinitive = assess(
  [{ field: "body", text: "Aldar to launch coastal homes across Dubai districts." }],
  independentPair(
    "Aldar to introduce coastal homes throughout Dubai districts.",
    "Aldar to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(unresolvedBareInfinitive.ok, false, JSON.stringify(unresolvedBareInfinitive));

const compatibleProspectiveFuture = assess(
  [{
    field: "body",
    text: "Coastal home supply will rise across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply is going to increase throughout Dubai districts.",
    "Coastal home supply is about to rise across Dubai districts.",
  ),
);
assert.equal(
  compatibleProspectiveFuture.ok,
  true,
  JSON.stringify(compatibleProspectiveFuture),
);

const compatibleForecast = assess(
  [{
    field: "body",
    text: "Coastal home supply is expected to rise across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply is forecast to increase throughout Dubai districts.",
    "Coastal home supply is projected to climb across Dubai districts.",
  ),
);
assert.equal(compatibleForecast.ok, true, JSON.stringify(compatibleForecast));

const compatibleIntent = assess(
  [{
    field: "body",
    text: "Aldar plans to launch coastal homes in Dubai districts.",
  }],
  independentPair(
    "Aldar proposes to introduce coastal homes throughout Dubai districts.",
    "Aldar intends to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(compatibleIntent.ok, true, JSON.stringify(compatibleIntent));

const ambiguousFutureMode = assess(
  [{
    field: "body",
    text: "Coastal home supply is expected to rise and will increase across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply is forecast to increase throughout Dubai districts.",
    "Coastal home supply is projected to rise across Dubai districts.",
  ),
);
assert.equal(ambiguousFutureMode.ok, false, JSON.stringify(ambiguousFutureMode));
assert.equal(ambiguousFutureMode.failures[0]?.code, "mixed-signature");

for (const hedge of [
  "reportedly",
  "allegedly",
  "apparently",
  "purportedly",
  "presumably",
  "seemingly",
] as const) {
  const plainFromHedge = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${hedge} increases throughout Dubai districts.`,
      `Coastal home supply ${hedge} rises across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromHedge.ok,
    false,
    `${hedge}: ${JSON.stringify(plainFromHedge)}`,
  );
}

for (const hedgePhrase of [
  "appears to",
  "seems to",
  "is believed to",
  "is thought to",
] as const) {
  const plainFromHedgePhrase = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${hedgePhrase} increase throughout Dubai districts.`,
      `Coastal home supply ${hedgePhrase} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromHedgePhrase.ok,
    false,
    `${hedgePhrase}: ${JSON.stringify(plainFromHedgePhrase)}`,
  );
}

for (const hedgePhrase of [
  "is alleged to",
  "is reported to",
  "is assumed to",
  "is purported to",
  "is presumed to",
  "is estimated to",
] as const) {
  const plainFromPassiveEpistemic = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${hedgePhrase} increase throughout Dubai districts.`,
      `Coastal home supply ${hedgePhrase} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromPassiveEpistemic.ok,
    false,
    `${hedgePhrase}: ${JSON.stringify(plainFromPassiveEpistemic)}`,
  );
}

for (const hedge of [
  "perhaps",
  "maybe",
  "conceivably",
  "plausibly",
  "ostensibly",
  "supposedly",
] as const) {
  const plainFromSentenceHedge = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${hedge} increases throughout Dubai districts.`,
      `Coastal home supply ${hedge} rises across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromSentenceHedge.ok,
    false,
    `${hedge}: ${JSON.stringify(plainFromSentenceHedge)}`,
  );
}

for (const attribution of [
  "reports say",
  "sources say",
  "analysts say",
  "according to reports",
  "according to preliminary estimates",
] as const) {
  const categoricalFromGenericAttribution = assess(
    [{
      field: "body",
      text: "Coastal home supply will rise across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply will increase throughout Dubai districts, ${attribution}.`,
      `Coastal home supply will rise across Dubai districts, ${attribution}.`,
    ),
  );
  assert.equal(
    categoricalFromGenericAttribution.ok,
    false,
    `${attribution}: ${JSON.stringify(categoricalFromGenericAttribution)}`,
  );
}

for (const parentheticalAttribution of [
  "it is alleged",
  "it is understood",
  "according to market chatter",
] as const) {
  const plainFromParentheticalAttribution = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply increases throughout Dubai districts, ${parentheticalAttribution}.`,
      `Coastal home supply rises across Dubai districts, ${parentheticalAttribution}.`,
    ),
  );
  assert.equal(
    plainFromParentheticalAttribution.ok,
    false,
    `${parentheticalAttribution}: ${JSON.stringify(plainFromParentheticalAttribution)}`,
  );
}

const compatibleReportedConstruction = assess(
  [{
    field: "body",
    text: "Coastal home supply reportedly rises across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply is said to increase throughout Dubai districts.",
    "Coastal home supply is reported to rise across Dubai districts.",
  ),
);
assert.equal(
  compatibleReportedConstruction.ok,
  true,
  JSON.stringify(compatibleReportedConstruction),
);

for (const hedgePhrase of [
  "is said to",
  "is understood to",
  "is claimed to",
  "is rumoured to",
  "is rumored to",
] as const) {
  const plainFromReportedSpeech = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${hedgePhrase} increase throughout Dubai districts.`,
      `Coastal home supply ${hedgePhrase} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromReportedSpeech.ok,
    false,
    `${hedgePhrase}: ${JSON.stringify(plainFromReportedSpeech)}`,
  );
  assert.match(
    plainFromReportedSpeech.failures.map(({ detail }) => detail).join(" | "),
    /probability polarity or strength differs/u,
  );
}

const likelyFromBeliefHedge = assess(
  [{
    field: "body",
    text: "Coastal home supply is likely to rise across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply is believed likely to increase throughout Dubai districts.",
    "Coastal home supply is thought likely to rise across Dubai districts.",
  ),
);
assert.equal(
  likelyFromBeliefHedge.ok,
  false,
  JSON.stringify(likelyFromBeliefHedge),
);

for (const parentheticalHedge of ["it appears", "it seems"] as const) {
  const categoricalFromParentheticalHedge = assess(
    [{
      field: "body",
      text: "Coastal home supply will rise across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply will increase throughout Dubai districts, ${parentheticalHedge}.`,
      `Coastal home supply will rise across Dubai districts, ${parentheticalHedge}.`,
    ),
  );
  assert.equal(
    categoricalFromParentheticalHedge.ok,
    false,
    `${parentheticalHedge}: ${JSON.stringify(categoricalFromParentheticalHedge)}`,
  );
}

const hedgedFromPlain = assess(
  [{
    field: "body",
    text: "Coastal home supply reportedly rises across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply increases throughout Dubai districts.",
    "Coastal home supply rises across Dubai districts.",
  ),
);
assert.equal(hedgedFromPlain.ok, false, JSON.stringify(hedgedFromPlain));

const compatibleHedges = assess(
  [{
    field: "body",
    text: "Coastal home supply reportedly rises across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply allegedly increases throughout Dubai districts.",
    "Coastal home supply allegedly increases throughout Dubai districts.",
  ),
);
assert.equal(compatibleHedges.ok, true, JSON.stringify(compatibleHedges));

for (const negativeModal of ["cannot", "won't"] as const) {
  const negativeFromPositive = assess(
    [{
      field: "body",
      text: `Coastal home supply ${negativeModal} rise across Dubai districts.`,
    }],
    independentPair(
      "Coastal home supply increases throughout Dubai districts.",
      "Coastal home supply rises across Dubai districts.",
    ),
  );
  assert.equal(
    negativeFromPositive.ok,
    false,
    `${negativeModal}: ${JSON.stringify(negativeFromPositive)}`,
  );
  assert.match(
    negativeFromPositive.failures.map(({ detail }) => detail).join(" | "),
    /polarity differs/u,
  );

  const positiveFromNegative = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${negativeModal} increase throughout Dubai districts.`,
      `Coastal home supply ${negativeModal} rise across Dubai districts.`,
    ),
  );
  assert.equal(
    positiveFromNegative.ok,
    false,
    `${negativeModal}: ${JSON.stringify(positiveFromNegative)}`,
  );
  assert.match(
    positiveFromNegative.failures.map(({ detail }) => detail).join(" | "),
    /polarity differs/u,
  );
}

const groundedNegativeModal = assess(
  [{
    field: "body",
    text: "Dubai Coastal Supply cannot rise across city districts.",
  }],
  independentPair(
    "Dubai Coastal Supply cannot increase throughout city districts.",
    "Dubai Coastal Supply cannot climb within city districts.",
  ),
);
assert.equal(
  groundedNegativeModal.ok,
  true,
  JSON.stringify(groundedNegativeModal),
);

for (const certainty of [
  "almost certainly",
  "certainly",
  "surely",
  "definitely",
  "inevitably",
] as const) {
  const certaintyFromPlain = assess(
    [{
      field: "body",
      text: `Coastal home supply ${certainty} rises across Dubai districts.`,
    }],
    independentPair(
      "Coastal home supply increases throughout Dubai districts.",
      "Coastal home supply rises across Dubai districts.",
    ),
  );
  assert.equal(
    certaintyFromPlain.ok,
    false,
    `${certainty}: ${JSON.stringify(certaintyFromPlain)}`,
  );

  const plainFromCertainty = assess(
    [{
      field: "body",
      text: "Coastal home supply rises across Dubai districts.",
    }],
    independentPair(
      `Coastal home supply ${certainty} increases throughout Dubai districts.`,
      `Coastal home supply ${certainty} rises across Dubai districts.`,
    ),
  );
  assert.equal(
    plainFromCertainty.ok,
    false,
    `${certainty}: ${JSON.stringify(plainFromCertainty)}`,
  );
}

const possibleFromCertain = assess(
  [{
    field: "body",
    text: "Coastal home supply may rise across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply certainly increases throughout Dubai districts.",
    "Coastal home supply surely rises across Dubai districts.",
  ),
);
assert.equal(possibleFromCertain.ok, true, JSON.stringify(possibleFromCertain));

const ungroundedIntensity = assess(
  [{
    field: "body",
    text: "Coastal home supply rises sharply across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply increases throughout Dubai districts.",
    "Coastal home supply rises across Dubai districts.",
  ),
);
assert.equal(ungroundedIntensity.ok, false, JSON.stringify(ungroundedIntensity));
assert.match(
  ungroundedIntensity.failures.map(({ detail }) => detail).join(" | "),
  /intensity qualifiers differ/u,
);

const plainFromIntensity = assess(
  [{
    field: "body",
    text: "Coastal home supply rises across Dubai districts.",
  }],
  independentPair(
    "Coastal home supply increases sharply throughout Dubai districts.",
    "Coastal home supply rises sharply across Dubai districts.",
  ),
);
assert.equal(plainFromIntensity.ok, true, JSON.stringify(plainFromIntensity));

for (const force of ["must", "should"] as const) {
  const ungroundedForce = assess(
    [{
      field: "body",
      text: `Coastal home supply ${force} rise across Dubai districts.`,
    }],
    independentPair(
      "Coastal home supply increases throughout Dubai districts.",
      "Coastal home supply rises across Dubai districts.",
    ),
  );
  assert.equal(
    ungroundedForce.ok,
    false,
    `${force}: ${JSON.stringify(ungroundedForce)}`,
  );
  assert.match(
    ungroundedForce.failures.map(({ detail }) => detail).join(" | "),
    /necessity or normative qualifier differs/u,
  );
}

const groundedNecessity = assess(
  [{
    field: "body",
    text: "Developers must report residential sale contracts.",
  }],
  independentPair(
    "Developers must report every residential sale contract.",
    "Developers must report residential contracts for each sale.",
  ),
);
assert.equal(groundedNecessity.ok, true, JSON.stringify(groundedNecessity));

for (const nonAssertedFuture of [
  "hopes to",
  "wants to",
  "promises to",
  "pledges to",
  "commits to",
  "is poised to",
  "is on track to",
  "is ready to",
  "aspires to",
  "prepares to",
  "looks to",
  "agrees to",
] as const) {
  const assertedLaunchFromQualifiedFuture = assess(
    [{ field: "body", text: "Aldar launched coastal homes across Dubai districts." }],
    independentPair(
      `Aldar ${nonAssertedFuture} launch coastal homes throughout Dubai districts.`,
      `Aldar ${nonAssertedFuture} introduce coastal homes across Dubai districts.`,
    ),
  );
  assert.equal(
    assertedLaunchFromQualifiedFuture.ok,
    false,
    `${nonAssertedFuture}: ${JSON.stringify(assertedLaunchFromQualifiedFuture)}`,
  );
  assert.match(
    assertedLaunchFromQualifiedFuture.failures.map(({ detail }) => detail).join(" | "),
    /modality differs/u,
  );
}

const compatibleCommitment = assess(
  [{ field: "body", text: "Aldar promises to launch coastal homes across Dubai districts." }],
  independentPair(
    "Aldar pledges to introduce coastal homes throughout Dubai districts.",
    "Aldar commits to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(compatibleCommitment.ok, true, JSON.stringify(compatibleCommitment));

const compatibleReadiness = assess(
  [{ field: "body", text: "Aldar is poised to launch coastal homes across Dubai districts." }],
  independentPair(
    "Aldar is on track to introduce coastal homes throughout Dubai districts.",
    "Aldar is on course to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(compatibleReadiness.ok, true, JSON.stringify(compatibleReadiness));

const compatibleExpandedIntent = assess(
  [{ field: "body", text: "Aldar plans to launch coastal homes across Dubai districts." }],
  independentPair(
    "Aldar aspires to introduce coastal homes throughout Dubai districts.",
    "Aldar prepares to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(compatibleExpandedIntent.ok, true, JSON.stringify(compatibleExpandedIntent));

const compatibleAgreement = assess(
  [{ field: "body", text: "Aldar agrees to launch coastal homes across Dubai districts." }],
  independentPair(
    "Aldar pledges to introduce coastal homes throughout Dubai districts.",
    "Aldar commits to unveil coastal homes across Dubai districts.",
  ),
);
assert.equal(compatibleAgreement.ok, true, JSON.stringify(compatibleAgreement));

for (const qualifier of [
  "approximately",
  "around",
  "more than",
  "less than",
  "at least",
  "at most",
  "no fewer than",
  "up to",
  "as many as",
  "as much as",
  "upwards of",
  "in excess of",
  "as high as",
  "as low as",
  "close to",
  "some",
  "~",
  "≤",
  "<",
  "roughly",
  "nearly",
] as const) {
  const exactFromQualifiedPair = assess(
    [{ field: "body", text: "Dubai recorded 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${qualifier} 10,000 residential transactions in the period.`,
      `Dubai records ${qualifier} 10,000 residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactFromQualifiedPair.ok,
    false,
    `${qualifier}: ${JSON.stringify(exactFromQualifiedPair)}`,
  );
  assert.match(
    exactFromQualifiedPair.failures.map(({ detail }) => detail).join(" | "),
    /numeric exactness or bound qualifiers differ/u,
  );

  const exactFromQualifiedOfficial = assess(
    [{
      field: "body",
      text: "Dubai Land Department recorded 10,000 residential transactions.",
    }],
    [{
      url: "https://dubailand.gov.ae/en/news/qualifier-check",
      publisher: "Dubai Land Department",
      publisherDomain: "dubailand.gov.ae",
      publisherAliases: ["DLD"],
      text: `Dubai Land Department recorded ${qualifier} 10,000 residential transactions in its release.`,
    }],
  );
  assert.equal(
    exactFromQualifiedOfficial.ok,
    false,
    `${qualifier}: ${JSON.stringify(exactFromQualifiedOfficial)}`,
  );
}

for (const sourceRange of [
  "between 9,000 and 10,000",
  "from 9,000 to 10,000",
  "9,000–10,000",
] as const) {
  const exactFromRangePair = assess(
    [{ field: "body", text: "Dubai recorded 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${sourceRange} residential transactions in the period.`,
      `Dubai records ${sourceRange} residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactFromRangePair.ok,
    false,
    `${sourceRange}: ${JSON.stringify(exactFromRangePair)}`,
  );
  assert.match(
    exactFromRangePair.failures.map(({ detail }) => detail).join(" | "),
    /numeric exactness or bound qualifiers differ/u,
  );

  const exactFromRangeOfficial = assess(
    [{
      field: "body",
      text: "Dubai Land Department recorded 10,000 residential transactions.",
    }],
    [{
      url: "https://dubailand.gov.ae/en/news/range-check",
      publisher: "Dubai Land Department",
      publisherDomain: "dubailand.gov.ae",
      publisherAliases: ["DLD"],
      text: `Dubai Land Department recorded ${sourceRange} residential transactions in its release.`,
    }],
  );
  assert.equal(
    exactFromRangeOfficial.ok,
    false,
    `${sourceRange}: ${JSON.stringify(exactFromRangeOfficial)}`,
  );
}

const compatibleRange = assess(
  [{
    field: "body",
    text: "Dubai recorded between 9,000 and 10,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded from 9,000 to 10,000 residential transactions during the period.",
    "Dubai records 9,000–10,000 residential transactions in its release.",
  ),
);
assert.equal(compatibleRange.ok, true, JSON.stringify(compatibleRange));

const reversedRange = assess(
  [{
    field: "body",
    text: "Dubai recorded between 10,000 and 9,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded from 9,000 to 10,000 residential transactions during the period.",
    "Dubai records 9,000–10,000 residential transactions in its release.",
  ),
);
assert.equal(reversedRange.ok, false, JSON.stringify(reversedRange));
assert.match(
  reversedRange.failures.map(({ detail }) => detail).join(" | "),
  /ordered numeric range bindings differ/u,
);

const exactFromSuffixPlus = assess(
  [{ field: "body", text: "Dubai recorded 10,000 residential transactions." }],
  independentPair(
    "Dubai recorded 10,000+ residential transactions during the period.",
    "Dubai records 10,000+ residential transactions in its release.",
  ),
);
assert.equal(exactFromSuffixPlus.ok, false, JSON.stringify(exactFromSuffixPlus));
assert.match(
  exactFromSuffixPlus.failures.map(({ detail }) => detail).join(" | "),
  /numeric exactness or bound qualifiers differ/u,
);

const exactFromPlusMinus = assess(
  [{ field: "body", text: "Dubai real estate deals reached AED 10 million." }],
  independentPair(
    "Dubai real estate deals reached AED10m ± AED1m during the period.",
    "Dubai real estate deals totalled AED10m +/- AED1m in the release.",
  ),
);
assert.equal(exactFromPlusMinus.ok, false, JSON.stringify(exactFromPlusMinus));
assert.match(
  exactFromPlusMinus.failures.map(({ detail }) => detail).join(" | "),
  /numeric exactness or bound qualifiers differ/u,
);

const exactFromSpacedCurrencyTolerance = assess(
  [{
    field: "body",
    text: "Average Dubai office price reached AED 10 million in August.",
  }],
  independentPair(
    "Average Dubai office price reached AED 10 million ± AED 1 million during August.",
    "Average Dubai office price totalled AED 10 million +/- AED 1 million in August.",
  ),
);
assert.equal(
  exactFromSpacedCurrencyTolerance.ok,
  false,
  JSON.stringify(exactFromSpacedCurrencyTolerance),
);
assert.match(
  exactFromSpacedCurrencyTolerance.failures.map(({ detail }) => detail).join(" | "),
  /numeric exactness or bound qualifiers differ/u,
);

const compatibleSpacedCurrencyTolerance = assess(
  [{
    field: "body",
    text: "Average Dubai office price reached AED ten million plus or minus AED one million in August.",
  }],
  independentPair(
    "Average Dubai office price reached AED 10 million ± AED 1 million during August.",
    "Average Dubai office price totalled AED 10 million +/- AED 1 million in August.",
  ),
);
assert.equal(
  compatibleSpacedCurrencyTolerance.ok,
  true,
  JSON.stringify(compatibleSpacedCurrencyTolerance),
);

for (const qualifiedWords of [
  "about ten thousand",
  "roughly ten thousand",
  "more than ten thousand",
  "up to ten thousand",
  "ten thousand+",
  "between nine thousand and ten thousand",
  "from nine thousand to ten thousand",
  "ten thousand ± one thousand",
] as const) {
  const exactFromQualifiedWords = assess(
    [{ field: "body", text: "Dubai recorded 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${qualifiedWords} residential transactions during the period.`,
      `Dubai records ${qualifiedWords} residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactFromQualifiedWords.ok,
    false,
    `${qualifiedWords}: ${JSON.stringify(exactFromQualifiedWords)}`,
  );
}

const exactWordsMatchDigits = assess(
  [{ field: "body", text: "Dubai recorded ten thousand residential transactions." }],
  independentPair(
    "Dubai recorded 10,000 residential transactions during the period.",
    "Dubai records 10,000 residential transactions in its release.",
  ),
);
assert.equal(exactWordsMatchDigits.ok, true, JSON.stringify(exactWordsMatchDigits));

for (const compoundQualifiedSource of [
  "roughly up to 10,000",
  "nearly up to 10,000",
  "up to roughly 10,000",
  "as many as approximately 10,000",
] as const) {
  const simplerClaimFromCompoundSource = assess(
    [{ field: "body", text: "Dubai recorded up to 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${compoundQualifiedSource} residential transactions during the period.`,
      `Dubai records ${compoundQualifiedSource} residential transactions in its release.`,
    ),
  );
  assert.equal(
    simplerClaimFromCompoundSource.ok,
    false,
    `${compoundQualifiedSource}: ${JSON.stringify(simplerClaimFromCompoundSource)}`,
  );
}

const approximateClaimFromBoundedApproximation = assess(
  [{ field: "body", text: "Dubai recorded roughly 10,000 residential transactions." }],
  independentPair(
    "Dubai recorded up to roughly 10,000 residential transactions during the period.",
    "Dubai records as many as approximately 10,000 residential transactions in its release.",
  ),
);
assert.equal(
  approximateClaimFromBoundedApproximation.ok,
  false,
  JSON.stringify(approximateClaimFromBoundedApproximation),
);

for (const compoundRange of [
  "roughly between 9,000 and 10,000",
  "approximately from 9,000 to 10,000",
] as const) {
  const exactRangeFromCompoundSource = assess(
    [{
      field: "body",
      text: "Dubai recorded between 9,000 and 10,000 residential transactions.",
    }],
    independentPair(
      `Dubai recorded ${compoundRange} residential transactions during the period.`,
      `Dubai records ${compoundRange} residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactRangeFromCompoundSource.ok,
    false,
    `${compoundRange}: ${JSON.stringify(exactRangeFromCompoundSource)}`,
  );
}

const likeForLikeCompoundQuantityHeld = assess(
  [{
    field: "body",
    text: "Dubai recorded roughly up to 10,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded roughly up to 10,000 residential transactions during the period.",
    "Dubai records roughly up to 10,000 residential transactions in its release.",
  ),
);
assert.equal(
  likeForLikeCompoundQuantityHeld.ok,
  false,
  JSON.stringify(likeForLikeCompoundQuantityHeld),
);
assert.equal(likeForLikeCompoundQuantityHeld.failures[0]?.code, "mixed-signature");

for (const qualifiedUnscaledWords of [
  "about ten",
  "up to ten",
  "as many as ten",
  "between nine and ten",
  "from nine to ten",
] as const) {
  const exactUnscaledWordFromQualified = assess(
    [{ field: "body", text: "Dubai recorded ten residential transactions." }],
    independentPair(
      `Dubai recorded ${qualifiedUnscaledWords} residential transactions during the period.`,
      `Dubai records ${qualifiedUnscaledWords} residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactUnscaledWordFromQualified.ok,
    false,
    `${qualifiedUnscaledWords}: ${JSON.stringify(exactUnscaledWordFromQualified)}`,
  );
}

const exactUnscaledWordsMatchDigits = assess(
  [{ field: "body", text: "Dubai recorded ten residential transactions." }],
  independentPair(
    "Dubai recorded 10 residential transactions during the period.",
    "Dubai records 10 residential transactions in its release.",
  ),
);
assert.equal(
  exactUnscaledWordsMatchDigits.ok,
  true,
  JSON.stringify(exactUnscaledWordsMatchDigits),
);

const compatibleApproximateUnscaledWords = assess(
  [{ field: "body", text: "Dubai recorded about ten residential transactions." }],
  independentPair(
    "Dubai recorded approximately 10 residential transactions during the period.",
    "Dubai records roughly ten residential transactions in its release.",
  ),
);
assert.equal(
  compatibleApproximateUnscaledWords.ok,
  true,
  JSON.stringify(compatibleApproximateUnscaledWords),
);

for (const punctuatedApproximation of ["(about)", "about:"] as const) {
  const exactFromPunctuatedApproximation = assess(
    [{ field: "body", text: "Dubai recorded 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${punctuatedApproximation} 10,000 residential transactions during the period.`,
      `Dubai records ${punctuatedApproximation} 10,000 residential transactions in its release.`,
    ),
  );
  assert.equal(
    exactFromPunctuatedApproximation.ok,
    false,
    `${punctuatedApproximation}: ${JSON.stringify(exactFromPunctuatedApproximation)}`,
  );

  const likeForLikePunctuatedApproximation = assess(
    [{ field: "body", text: "Dubai recorded roughly 10,000 residential transactions." }],
    independentPair(
      `Dubai recorded ${punctuatedApproximation} 10,000 residential transactions during the period.`,
      `Dubai records ${punctuatedApproximation} 10,000 residential transactions in its release.`,
    ),
  );
  assert.equal(
    likeForLikePunctuatedApproximation.ok,
    true,
    `${punctuatedApproximation}: ${JSON.stringify(likeForLikePunctuatedApproximation)}`,
  );
}

for (const fractionalSource of [
  "half a million dirhams",
  "a quarter million dirhams",
  "one-and-a-half million dirhams",
] as const) {
  const wholeFromFraction = assess(
    [{
      field: "body",
      text: "Average Dubai office price reached one million dirhams.",
    }],
    independentPair(
      `Average Dubai office price reached ${fractionalSource} during the period.`,
      `Average Dubai office price totalled ${fractionalSource} in its release.`,
    ),
  );
  assert.equal(
    wholeFromFraction.ok,
    false,
    `${fractionalSource}: ${JSON.stringify(wholeFromFraction)}`,
  );
}

const compatibleFraction = assess(
  [{
    field: "body",
    text: "Average Dubai office price reached half a million dirhams.",
  }],
  independentPair(
    "Average Dubai office price reached AED 500,000 during the period.",
    "Average Dubai office price totalled AED 0.5 million in its release.",
  ),
);
assert.equal(compatibleFraction.ok, true, JSON.stringify(compatibleFraction));

const compatiblePlusMinus = assess(
  [{
    field: "body",
    text: "Dubai real estate deals reached AED ten million plus or minus AED one million.",
  }],
  independentPair(
    "Dubai real estate deals reached AED10m ± AED1m during the period.",
    "Dubai real estate deals totalled AED10m +/- AED1m in the release.",
  ),
);
assert.equal(compatiblePlusMinus.ok, true, JSON.stringify(compatiblePlusMinus));

const approximateFromExact = assess(
  [{
    field: "body",
    text: "Dubai recorded about 10,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded 10,000 residential transactions during the period.",
    "Dubai records 10,000 residential transactions in the release.",
  ),
);
assert.equal(approximateFromExact.ok, true, JSON.stringify(approximateFromExact));

const inclusiveBoundFromExact = assess(
  [{
    field: "body",
    text: "Dubai recorded at least 10,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded 10,000 residential transactions during the period.",
    "Dubai records 10,000 residential transactions in the release.",
  ),
);
assert.equal(
  inclusiveBoundFromExact.ok,
  true,
  JSON.stringify(inclusiveBoundFromExact),
);

const upperInclusiveBoundFromExact = assess(
  [{
    field: "body",
    text: "Dubai recorded at most 10,000 residential transactions.",
  }],
  independentPair(
    "Dubai recorded 10,000 residential transactions during the period.",
    "Dubai records 10,000 residential transactions in the release.",
  ),
);
assert.equal(
  upperInclusiveBoundFromExact.ok,
  true,
  JSON.stringify(upperInclusiveBoundFromExact),
);

for (const strictBound of ["more than", "less than"] as const) {
  const strictBoundFromExact = assess(
    [{
      field: "body",
      text: `Dubai recorded ${strictBound} 10,000 residential transactions.`,
    }],
    independentPair(
      "Dubai recorded 10,000 residential transactions during the period.",
      "Dubai records 10,000 residential transactions in the release.",
    ),
  );
  assert.equal(
    strictBoundFromExact.ok,
    false,
    `${strictBound}: ${JSON.stringify(strictBoundFromExact)}`,
  );
}

const stressEvidence: ClaimSupportEvidence[] = Array.from(
  { length: 25 },
  (_, publisherIndex) => ({
    url: `https://source-${publisherIndex}.test/releases/coastal-launch`,
    publisher: `Source ${publisherIndex}`,
    publisherDomain: `source-${publisherIndex}.test`,
    text: Array.from(
      { length: 19 },
      (_, sentenceIndex) =>
        `Aldar launched 100 coastal villas in district ${sentenceIndex}.`,
    ).join(" "),
  }),
);
const stressStart = performance.now();
const stressAssessment = assess(
  Array.from({ length: 75 }, (_, index) => ({
    field: `stress[${index}]`,
    text: "Aldar launched 100 coastal villas.",
  })),
  stressEvidence,
);
const stressElapsedMs = performance.now() - stressStart;
assert.equal(stressAssessment.ok, true, JSON.stringify(stressAssessment.failures));

console.log(
  `Claim-support regression passed: bounded anchor matching, publisher/entity binding, polarity, modality, direction, object roles, editorial limits, originality and citation use are enforced; 75x475 stress ${stressElapsedMs.toFixed(1)}ms.`,
);
