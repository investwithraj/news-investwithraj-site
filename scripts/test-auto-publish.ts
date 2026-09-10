import assert from "node:assert/strict";

import {
  articleEvidenceSegments,
  assessDraft,
  assessAutoPublicationRecency,
  canonicalizeEvidenceNumericPhrases,
  classifyEvidenceRisk,
  extractFigures,
  findUnsupportedFigures,
  runAutoApprove,
  strictlyAttributedOfficialFact,
} from "../lib/news-review/auto-approve.js";
import type {
  NewsDraft,
  NewsDraftProvenance,
} from "../lib/news-review/types.js";
import { validateDraft } from "../lib/voice/validator.js";
import { draftContentHash, mediaApprovalHash } from "../lib/news-review/integrity.js";
import type { MediaApprovalLedger } from "../lib/news-review/types.js";

const sourceA = "https://www.reuters.com/world/middle-east/source-a";
const sourceB =
  "https://www.thenationalnews.com/business/property/source-b/";
const sourcePublishedAt = "2026-08-11T08:00:00.000Z";
const freshnessCheckedAt = "2026-08-12T10:00:00.000Z";
const evidence =
  "The record officially reported the transaction value at AED 10 million for the period.";

type EvidenceRecord = NonNullable<
  NewsDraftProvenance["fetchedEvidence"]
>[number];

function evidenceRecord(
  url: string,
  text = evidence,
  overrides: Partial<EvidenceRecord> = {},
): EvidenceRecord {
  return {
    url,
    finalUrl: url,
    text,
    fetchedAt: freshnessCheckedAt,
    sourcePublishedAt,
    sourceDateSource: "meta",
    freshnessCheckedAt,
    freshnessMaxAgeHours: 168,
    ...overrides,
  };
}

const draft = {
  id: "auto-publish-regression",
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T10:00:00.000Z",
  article: {
    slug: "2026-08-12-auto-publish-regression",
    title: "Transaction value record",
    tier: "news",
    market: ["Dubai"],
    body: "The official record reported the transaction value at AED 10 million.",
    citations: [
      { source: "Source A", url: sourceA },
      { source: "Source B", url: sourceB },
    ],
    cta: {
      href: "https://investwithraj.com/engage?utm_source=news",
      label: "Open my decision",
    },
  },
  validator: {
    ok: true,
    failures: [],
    metrics: {
      citationCount: 2,
      citationsFromWhitelist: 2,
    },
  },
  provenance: {
    fetchedEvidence: [
      evidenceRecord(sourceA),
      evidenceRecord(sourceB),
    ],
  },
} as unknown as NewsDraft;

const olderDraft = {
  ...draft,
  id: "auto-publish-regression-older",
  createdAt: "2026-08-11T10:00:00.000Z",
  updatedAt: "2026-08-11T10:00:00.000Z",
  article: {
    ...draft.article,
    slug: "2026-08-11-auto-publish-regression-older",
    publishedAt: "2026-08-11T10:00:00.000Z",
  },
  provenance: {
    ...draft.provenance,
    score: 80,
  },
} as NewsDraft;
const staleDraft = {
  ...draft,
  id: "auto-publish-regression-stale",
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
  article: {
    ...draft.article,
    slug: "2026-07-01-auto-publish-regression-stale",
    publishedAt: "2026-07-01T10:00:00.000Z",
  },
  provenance: {
    ...draft.provenance,
    score: 100,
  },
} as NewsDraft;
draft.article.publishedAt = "2026-08-12T10:00:00.000Z";
draft.provenance.score = 50;
// Publication selection tests use valid existing human image approvals. Missing
// media is exercised separately by test-daily-media-publication.ts.
for (const fixture of [draft, olderDraft, staleDraft]) {
  fixture.status = "review";
  fixture.revision = 1;
  fixture.recordVersion = 1;
  fixture.contentHash = draftContentHash(fixture.article, fixture.provenance);
  const record: Omit<MediaApprovalLedger, "hash"> = {
    revision: fixture.revision,
    contentHash: fixture.contentHash,
    slug: fixture.article.slug,
    repoPath: `public/news/${fixture.article.slug}/cover.jpg`,
    contentSha256: "c".repeat(64),
    mime: "image/jpeg",
    width: 6000,
    height: 4000,
    sourceUrl: "https://images.example.test/approved-original.jpg",
    rightsStatus: "licensed",
    credit: "Approved test photographer",
    reviewer: "raj-review-session",
    approvedAt: fixture.createdAt,
  };
  fixture.mediaApproval = { ...record, hash: mediaApprovalHash(record) };
}

const originalFetch = globalThis.fetch;
const calls: string[] = [];
const publishRequestBodies: Array<Record<string, unknown>> = [];
let forcePublishFailure = false;
let deploymentResponseMode: "completed" | "pending" | null = null;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push(url);
  if (url.endsWith("/api/news/draft")) {
    return Response.json({ drafts: [staleDraft, olderDraft, draft] });
  }
  if (/\/api\/news\/draft\/[^/]+\/publish$/.test(url)) {
    publishRequestBodies.push(
      JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    );
    if (forcePublishFailure) {
      return Response.json({ error: "simulated publication failure" }, { status: 503 });
    }
    return Response.json(
      {
        claimId: "00000000-0000-4000-8000-000000000000",
        commitSha: "a".repeat(40),
        url: `https://news.example.test/news/${draft.article.slug}`,
      },
      { status: 202 },
    );
  }
  if (/\/api\/news\/draft\/[^/]+\/deployment$/.test(url)) {
    if (deploymentResponseMode === "completed") {
      return Response.json({
        ok: true,
        publicationState: "completed",
        postPublish: {
          ok: true,
          pending: false,
          code: "completed",
          indexing: { status: "completed" },
          distribution: { status: "not-applicable" },
        },
      });
    }
    if (deploymentResponseMode === "pending") {
      return Response.json(
        {
          ok: false,
          publicationState: "completed",
          postPublish: {
            ok: false,
            pending: true,
            code: "pending",
            indexing: { status: "pending" },
            distribution: { status: "pending" },
            operatorAction: "Do not replay this operation key.",
          },
        },
        { status: 202 },
      );
    }
  }
  throw new Error(`Unexpected request: ${url}`);
};

async function main() {
  try {
    const oneSourceDraft = (input: {
      id: string;
      url: string;
      source: string;
      category: NewsDraft["article"]["category"];
      body: string;
    }) => ({
      ...draft,
      id: input.id,
      article: {
        ...draft.article,
        category: input.category,
        body: input.body,
        citations: [{ source: input.source, url: input.url }],
      },
      validator: {
        ...draft.validator,
        metrics: { citationCount: 1, citationsFromWhitelist: 1 },
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [evidenceRecord(input.url)],
      },
    }) as NewsDraft;

    const reutersDraft = oneSourceDraft({
      id: "single-reuters",
      url: "https://www.reuters.com/world/middle-east/example-report",
      source: "Reuters",
      category: "market-pulse",
      body: "Reuters reported that the verified transaction value was AED 10 million.",
    });
    const reutersAssessment = assessDraft(reutersDraft);
    assert.equal(reutersAssessment.verdict, "manual");
    assert.equal(reutersAssessment.evidenceLane, "corroborated-analysis");
    assert.equal(reutersAssessment.requiredPublisherCount, 2);

    const officialDraft = oneSourceDraft({
      id: "single-government",
      url: "https://dubailand.gov.ae/en/news/example-release",
      source: "Dubai Land Department",
      category: "regulatory",
      body: "Dubai Land Department confirmed its own verified transaction value of AED 10 million.",
    });
    officialDraft.article.title =
      "Dubai Land Department confirms its registration service update";
    officialDraft.provenance.fetchedEvidence![0].text =
      "Dubai Land Department confirmed an updated registration service framework in its official record. Dubai Land Department confirmed the verified transaction value at AED 10 million in its own official record.";
    assert.equal(
      assessDraft(officialDraft).evidenceLane,
      "official-fact",
    );
    assert.equal(assessDraft(officialDraft).requiredPublisherCount, 1);
    const officialAssessment = assessDraft(officialDraft);
    assert.equal(
      officialAssessment.verdict,
      "auto-approve",
      officialAssessment.reasons.join("; "),
    );

    const exactQuarantinedDldDraft = {
      ...draft,
      id: "f01d5ea6-56b3-45bd-b48c-d67bb567480c",
      contentHash:
        "118e1030f017d36619d2d95346722f2ba161e2a42a0a526aa6f660e8872e2dd3",
      article: {
        ...draft.article,
        slug:
          "2026-09-07-dubai-land-department-launches-unified-registration",
      },
    } as NewsDraft;
    const quarantinedDldAssessment = assessDraft(exactQuarantinedDldDraft);
    assert.equal(
      quarantinedDldAssessment.verdict,
      "manual",
      "the exact rejected DLD draft version must remain held",
    );
    assert.ok(
      quarantinedDldAssessment.reasons.some((reason) =>
        reason.includes(
          "editorial quarantine dld-initial-registration-semantic-overreach-2026-09-07",
        ),
      ),
      "the hold must expose its auditable quarantine rule",
    );

    const revisedDldDraft = {
      ...exactQuarantinedDldDraft,
      contentHash: "f".repeat(64),
    } as NewsDraft;
    assert.equal(
      assessDraft(revisedDldDraft).verdict,
      "manual",
      "a changed hash must not bypass the permanent rejected-slug hold",
    );
    const correctedDldDraft = {
      ...revisedDldDraft,
      article: {
        ...revisedDldDraft.article,
        slug:
          "2026-09-07-dubai-land-department-launches-initial-registration-platform",
      },
    } as NewsDraft;
    const correctedDldAssessment = assessDraft(correctedDldDraft);
    assert.equal(
      correctedDldAssessment.verdict,
      "auto-approve",
      `the separately reviewed corrected slug returns to normal assessment: ${correctedDldAssessment.reasons.join("; ")}`,
    );

    for (const [id, claim] of [
      ["broad-market-growth", "The UAE property market grew 12% last year."],
      ["analyst-forecast", "Analysts expect prices to rise by 12%."],
      ["challenged-claim", "Critics challenged the developer claim."],
      [
        "institutional-forecast",
        "Knight Frank published its own report. It expects prices to climb 12% next year.",
      ],
      [
        "unattributed-market-movement",
        "Dubai Land Department confirmed its annual report. Demand strengthened across Dubai and prices climbed.",
      ],
      [
        "lowercase-third-party-sentence",
        "Dubai Land Department announced its own service update. a contractor opened an unrelated sales centre.",
      ],
      [
        "dld-questioned-figures",
        "DLD said its own figures were questioned.",
      ],
      [
        "dld-forecast-double",
        "DLD said its own registrations are expected to double next year.",
      ],
      [
        "macro-inflation",
        "Dubai inflation increased across the wider economy.",
      ],
    ] as const) {
      const riskyOwnUpdate = {
        ...officialDraft,
        id,
        article: {
          ...officialDraft.article,
          body: `Dubai Land Department confirmed AED 10 million. ${claim}`,
        },
        provenance: {
          ...officialDraft.provenance,
          fetchedEvidence: [
            evidenceRecord(
              officialDraft.article.citations[0].url,
              `Dubai Land Department confirmed AED 10 million. ${claim}`,
            ),
          ],
        },
      } as NewsDraft;
      const assessment = assessDraft(riskyOwnUpdate);
      assert.equal(assessment.requiredPublisherCount, 2, id);
      assert.equal(assessment.verdict, "manual", id);
    }

    const developerDraft = oneSourceDraft({
      id: "single-developer",
      url: "https://www.aldar.com/en/news-and-media/example-launch",
      source: "Aldar Properties",
      category: "launch",
      body: "Aldar announced its own verified transaction value of AED 10 million.",
    });
    developerDraft.article.title = "Aldar announces its project release";
    developerDraft.provenance.fetchedEvidence![0].text =
      "Aldar announced the official project release. Aldar announced a new launch within its official project record. Aldar announced the verified transaction value at AED 10 million in its own record.";
    assert.equal(
      assessDraft(developerDraft).evidenceLane,
      "official-fact",
    );
    assert.equal(assessDraft(developerDraft).requiredPublisherCount, 1);
    const developerAssessment = assessDraft(developerDraft);
    assert.equal(
      developerAssessment.verdict,
      "auto-approve",
      developerAssessment.reasons.join(" | "),
    );

    const nakheelUrl =
      "https://www.nakheel.com/en/media-centre/news/test";
    const riskyOfficialClaims = [
      "Nakheel announced Palm Jebel Ali is certain to become Dubai\u2019s most desirable investment, making buyers wealthier.",
      "Nakheel announced Palm Jebel Ali as a world-class investment opportunity and an irresistible choice for buyers.",
      "Nakheel announced Palm Jebel Ali would deliver capital appreciation and profitable returns for purchasers.",
      "Nakheel announced investors should secure a home now because it is the smart investment choice.",
      "Nakheel announced Palm Jebel Ali will be more valuable than competing communities.",
      "Nakheel announced Palm Jebel Ali as Dubai's number one place to buy and the best choice for investors.",
    ] as const;
    for (const [index, claim] of riskyOfficialClaims.entries()) {
      const riskyDeveloperDraft = oneSourceDraft({
        id: `single-developer-promotional-${index}`,
        url: nakheelUrl,
        source: "Nakheel",
        category: "launch",
        body: claim,
      });
      riskyDeveloperDraft.article.title = claim;
      riskyDeveloperDraft.article.subtitle = claim;
      riskyDeveloperDraft.article.metaDescription = claim;
      riskyDeveloperDraft.article.tldr = [claim, claim, claim];
      riskyDeveloperDraft.provenance.fetchedEvidence = [
        evidenceRecord(nakheelUrl, `${claim} ${claim}`),
      ];

      assert.equal(
        classifyEvidenceRisk(riskyDeveloperDraft.article)
          .requiresCorroboration,
        true,
        claim,
      );
      assert.equal(
        strictlyAttributedOfficialFact(
          riskyDeveloperDraft.article,
          [nakheelUrl],
        ).ok,
        false,
        claim,
      );
      const riskyAssessment = assessDraft(riskyDeveloperDraft);
      assert.equal(riskyAssessment.evidenceLane, "corroborated-analysis", claim);
      assert.equal(riskyAssessment.requiredPublisherCount, 2, claim);
      assert.equal(riskyAssessment.verdict, "manual", claim);
    }

    const failClosedOfficialClaims = [
      "Nakheel announced the project offers an enviable waterfront lifestyle.",
      "Nakheel announced the project will redefine coastal living.",
      "Nakheel announced buyers can build long-term equity through the project.",
      "Nakheel announced the Palm Jebel Ali launch and the project offers residents a private-island lifestyle.",
      "Nakheel announced the project creates generational equity for owners.",
      "Nakheel announced its opening will reshape how families live by the sea.",
    ] as const;
    for (const [index, claim] of failClosedOfficialClaims.entries()) {
      const failClosedDraft = oneSourceDraft({
        id: `single-developer-positive-grammar-rejection-${index}`,
        url: nakheelUrl,
        source: "Nakheel",
        category: "launch",
        body: claim,
      });
      failClosedDraft.article.title = claim;
      failClosedDraft.provenance.fetchedEvidence = [
        evidenceRecord(nakheelUrl, claim),
      ];

      assert.equal(
        classifyEvidenceRisk(failClosedDraft.article).requiresCorroboration,
        false,
        `the positive grammar, not a phrase deny-list, must reject: ${claim}`,
      );
      assert.match(
        strictlyAttributedOfficialFact(failClosedDraft.article, [nakheelUrl])
          .reason,
        /outside the narrow official-act/u,
        claim,
      );
      const assessment = assessDraft(failClosedDraft);
      assert.equal(assessment.requiredPublisherCount, 2, claim);
      assert.equal(assessment.verdict, "manual", claim);
    }

    const permittedOfficialFacts = [
      {
        claim: "Nakheel announced the Palm Jebel Ali launch.",
        evidence: "Nakheel announced an official Palm Jebel Ali project launch.",
      },
      {
        claim: "Nakheel confirmed the launch location at Dubai Islands.",
        evidence:
          "Nakheel confirmed Dubai Islands as the specified location for the development launch.",
      },
      {
        claim: "Nakheel stated the opening date of 12 August 2026.",
        evidence:
          "Nakheel stated the opening date as 12 August 2026 in the project record.",
      },
      {
        claim: "Nakheel confirmed a quantity of 100 units.",
        evidence: "Nakheel confirmed the project quantity at 100 units.",
      },
      {
        claim: "Nakheel stated the applicable price of AED 2 million.",
        evidence:
          "Nakheel stated the project terms, including an applicable price of AED 2 million.",
      },
      {
        claim: "Nakheel confirmed a payment milestone of 20%.",
        evidence: "Nakheel confirmed the project payment milestone at 20%.",
      },
    ] as const;
    for (const [index, fixture] of permittedOfficialFacts.entries()) {
      const { claim, evidence: claimEvidence } = fixture;
      const factualDraft = oneSourceDraft({
        id: `single-developer-positive-grammar-fact-${index}`,
        url: nakheelUrl,
        source: "Nakheel",
        category: "launch",
        body: claim,
      });
      factualDraft.article.title = claim;
      factualDraft.provenance.fetchedEvidence = [
        evidenceRecord(
          nakheelUrl,
          `${claimEvidence} The company published the supporting project record through its official media centre.`,
        ),
      ];

      assert.equal(
        strictlyAttributedOfficialFact(factualDraft.article, [nakheelUrl]).ok,
        true,
        claim,
      );
      const assessment = assessDraft(factualDraft);
      assert.equal(assessment.requiredPublisherCount, 1, claim);
      assert.equal(
        assessment.verdict,
        "auto-approve",
        `${claim}: ${assessment.reasons.join(" | ")}`,
      );
    }

    const uncataloguedPromotion = oneSourceDraft({
      id: "single-developer-uncatalogued-promotion",
      url: nakheelUrl,
      source: "Nakheel",
      category: "launch",
      body: "Nakheel announced Palm Jebel Ali brings joy to everyone.",
    });
    uncataloguedPromotion.article.title =
      "Nakheel announced Palm Jebel Ali brings joy to everyone";
    uncataloguedPromotion.provenance.fetchedEvidence = [
      evidenceRecord(
        nakheelUrl,
        "Nakheel announced Palm Jebel Ali brings joy to everyone in its official media statement.",
      ),
    ];
    assert.equal(
      classifyEvidenceRisk(uncataloguedPromotion.article)
        .requiresCorroboration,
      false,
      "an unknown promotional phrase exercises the separate fail-closed scope gate",
    );
    assert.match(
      strictlyAttributedOfficialFact(
        uncataloguedPromotion.article,
        [nakheelUrl],
      ).reason,
      /outside the narrow official-act/u,
    );
    assert.equal(assessDraft(uncataloguedPromotion).requiredPublisherCount, 2);
    assert.equal(assessDraft(uncataloguedPromotion).verdict, "manual");

    const semicolonAttributionBleed = oneSourceDraft({
      id: "single-developer-semicolon-attribution-bleed",
      url: nakheelUrl,
      source: "Nakheel",
      category: "launch",
      body:
        "Nakheel announced its Palm Jebel Ali launch; residents received private beach-club access.",
    });
    semicolonAttributionBleed.article.title =
      "Nakheel announced its Palm Jebel Ali launch";
    semicolonAttributionBleed.provenance.fetchedEvidence = [
      evidenceRecord(
        nakheelUrl,
        "Nakheel announced its Palm Jebel Ali launch; residents received private beach-club access in the official release.",
      ),
    ];
    assert.equal(
      assessDraft(semicolonAttributionBleed).requiredPublisherCount,
      2,
      "attribution before a semicolon must not authorise a separate claim",
    );
    assert.equal(assessDraft(semicolonAttributionBleed).verdict, "manual");

    const attributedOfficialThirdPartyFact = {
      ...officialDraft,
      id: "dld-reports-emaar-launch",
      article: {
        ...officialDraft.article,
        body:
          "Dubai Land Department confirmed its applicable transaction value of AED 10 million. DLD reported that Emaar launched its own project.",
      },
      provenance: {
        ...officialDraft.provenance,
        fetchedEvidence: [
          evidenceRecord(
            officialDraft.article.citations[0].url,
            "Dubai Land Department confirmed an updated registration service framework in its official record. Dubai Land Department confirmed the official applicable transaction value of AED 10 million for the record. DLD reported that Emaar officially launched the development project.",
          ),
        ],
      },
    } as NewsDraft;
    const attributedOfficialAssessment = assessDraft(
      attributedOfficialThirdPartyFact,
    );
    assert.equal(
      attributedOfficialAssessment.verdict,
      "auto-approve",
      `a regulator's strictly attributed factual statement may use its primary record: ${attributedOfficialAssessment.reasons.join(" | ")}`,
    );

    const institutionalDraft = oneSourceDraft({
      id: "single-institutional-release",
      url: "https://www.knightfrank.com/research/article/example-release",
      source: "Knight Frank",
      category: "market-pulse",
      body:
        "Knight Frank published its own report with a verified transaction value of AED 10 million.",
    });
    assert.equal(
      assessDraft(institutionalDraft).evidenceLane,
      "corroborated-analysis",
    );
    assert.equal(
      assessDraft(institutionalDraft).verdict,
      "manual",
      "institutional findings always require an independent publisher",
    );

    const recommendationDraft = oneSourceDraft({
      id: "single-source-recommendation",
      url: "https://www.reuters.com/world/middle-east/example-analysis",
      source: "Reuters",
      category: "market-pulse",
      body: "We recommend investors buy after the verified transaction value reached AED 10 million.",
    });
    assert.equal(
      assessDraft(recommendationDraft).evidenceLane,
      "corroborated-analysis",
    );
    assert.equal(
      assessDraft(recommendationDraft).verdict,
      "manual",
      "investment recommendations must still require two publishers",
    );

    const tldrRecommendationDraft = {
      ...reutersDraft,
      id: "single-source-tldr-recommendation",
      article: {
        ...reutersDraft.article,
        tldr: [
          "We recommend investors buy.",
          "The update is directly attributed.",
          "The evidence is fresh.",
        ],
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(tldrRecommendationDraft).requiredPublisherCount,
      2,
      "recommendations outside the body must still require two publishers",
    );
    assert.equal(assessDraft(tldrRecommendationDraft).verdict, "manual");

    const disputedOneSourceDraft = {
      ...reutersDraft,
      id: "single-source-disputed-market-claim",
      article: {
        ...reutersDraft.article,
        body:
          "Reuters reported that the market-wide AED 10 million claim remains disputed.",
      },
    } as NewsDraft;
    const disputedOneSourceAssessment = assessDraft(disputedOneSourceDraft);
    assert.equal(disputedOneSourceAssessment.requiredPublisherCount, 2);
    assert.equal(disputedOneSourceAssessment.verdict, "manual");

    const disputedTwoSourceDraft = {
      ...draft,
      id: "two-source-disputed-market-claim",
      article: {
        ...draft.article,
        title: "Reuters reports the disputed market claim",
        body:
          "Both sources report that the market-wide AED 10 million claim remains disputed.",
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          evidenceRecord(sourceA, "Reuters reported the market claim as disputed in its coverage. The market-wide AED 10 million claim remains disputed. The full report supplies direct context."),
          evidenceRecord(sourceB, `${"The market-wide AED 10 million claim remains disputed."} Independent reporting supplies direct context.`),
        ],
      },
    } as NewsDraft;
    const disputedTwoSourceAssessment = assessDraft(disputedTwoSourceDraft);
    assert.equal(disputedTwoSourceAssessment.requiredPublisherCount, 2);
    assert.equal(disputedTwoSourceAssessment.fetchedEvidenceCount, 2);
    assert.equal(
      disputedTwoSourceAssessment.verdict,
      "auto-approve",
      disputedTwoSourceAssessment.reasons.join("; "),
    );

    const corroboratedAnalysisDraft = {
      ...draft,
      id: "two-source-analysis",
      article: {
        ...draft.article,
        title: "Reuters reported apartment and villa prices",
        body:
          "Apartment sale prices were higher than villa sale prices.",
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          evidenceRecord(
            sourceA,
            "Reuters reported prices for apartments and villas in its market coverage. Apartment sale prices during the measured period were higher than villa sale prices.",
          ),
          evidenceRecord(
            sourceB,
            "Apartment sale prices during the measured period were higher than villa sale prices. The publication supplies direct market context.",
          ),
        ],
      },
    } as NewsDraft;
    const corroboratedAssessment = assessDraft(corroboratedAnalysisDraft);
    assert.equal(corroboratedAssessment.requiredPublisherCount, 2);
    assert.equal(corroboratedAssessment.fetchedEvidenceCount, 2);
    assert.equal(
      corroboratedAssessment.verdict,
      "auto-approve",
      corroboratedAssessment.reasons.join("; "),
    );

    const samePublisherDraft = {
      ...draft,
      id: "auto-publish-same-publisher",
      article: {
        ...draft.article,
        body:
          "Apartment sale prices were higher than villa sale prices.",
        citations: [
          { source: "Reuters", url: sourceA },
          {
            source: "Reuters Graphics",
            url: "https://graphics.reuters.com/property/source-b",
          },
        ],
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          evidenceRecord(sourceA),
          evidenceRecord("https://graphics.reuters.com/property/source-b"),
        ],
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(samePublisherDraft).verdict,
      "manual",
      "two URLs from one publisher must not satisfy independent corroboration",
    );

    const crossPublisherRedirectDraft = {
      ...reutersDraft,
      id: "cross-publisher-redirect",
      provenance: {
        ...reutersDraft.provenance,
        fetchedEvidence: [
          evidenceRecord(reutersDraft.article.citations[0].url, evidence, {
            finalUrl: sourceB,
          }),
        ],
      },
    } as NewsDraft;
    const redirectAssessment = assessDraft(crossPublisherRedirectDraft);
    assert.equal(redirectAssessment.verdict, "manual");
    assert.ok(
      redirectAssessment.reasons.some((reason) =>
        /publisher identity changed/.test(reason),
      ),
    );

    const legacyUndatedDraft = {
      ...reutersDraft,
      id: "legacy-undated-evidence",
      provenance: {
        ...reutersDraft.provenance,
        fetchedEvidence: [
          {
            url: reutersDraft.article.citations[0].url,
            text: evidence,
            fetchedAt: freshnessCheckedAt,
          },
        ],
      },
    } as NewsDraft;
    const legacyAssessment = assessDraft(legacyUndatedDraft);
    assert.equal(legacyAssessment.verdict, "manual");
    assert.ok(
      legacyAssessment.reasons.some((reason) =>
        /publication timestamp\/date-source missing/.test(reason),
      ),
    );

    const freshnessVariant = (
      id: string,
      overrides: Partial<EvidenceRecord>,
    ): NewsDraft => ({
      ...officialDraft,
      id,
      provenance: {
        ...officialDraft.provenance,
        fetchedEvidence: [
          evidenceRecord(
            officialDraft.article.citations[0].url,
            evidence,
            overrides,
          ),
        ],
      },
    });
    const staleEvidenceDraft = freshnessVariant("stale-source-date", {
      sourcePublishedAt: "2025-11-15T08:00:00.000Z",
      freshnessCheckedAt: "2026-08-12T10:00:00.000Z",
    });
    const futureEvidenceDraft = freshnessVariant("future-source-date", {
      sourcePublishedAt: "2026-08-13T10:00:00.000Z",
      freshnessCheckedAt: "2026-08-12T10:00:00.000Z",
    });
    assert.equal(assessDraft(staleEvidenceDraft).verdict, "manual");
    assert.ok(
      assessDraft(staleEvidenceDraft).reasons.some((reason) =>
        /old at staging/.test(reason),
      ),
    );
    assert.equal(assessDraft(futureEvidenceDraft).verdict, "manual");
    assert.ok(
      assessDraft(futureEvidenceDraft).reasons.some((reason) =>
        /after the staging check/.test(reason),
      ),
    );

    const heldBacklogStillFresh = {
      ...draft,
      id: "held-backlog-fresh",
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [sourceA, sourceB].map((url) =>
          evidenceRecord(url, evidence, {
            sourcePublishedAt: "2026-08-01T08:00:00.000Z",
            fetchedAt: "2026-08-02T08:00:00.000Z",
            freshnessCheckedAt: "2026-08-02T08:00:00.000Z",
          }),
        ),
      },
    } as NewsDraft;
    const heldBacklogAssessment = assessDraft(heldBacklogStillFresh);
    assert.equal(
      heldBacklogAssessment.verdict,
      "auto-approve",
      `freshness must use the stored staging clock, not the later publication-run clock: ${heldBacklogAssessment.reasons.join("; ")}`,
    );

    const boundaryEvidenceDraft = {
      ...draft,
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [sourceA, sourceB].map((url) =>
          evidenceRecord(url, evidence, {
            sourcePublishedAt: "2026-08-12T10:00:00.000Z",
            fetchedAt: "2026-08-12T10:00:00.000Z",
            freshnessCheckedAt: "2026-08-12T10:00:00.000Z",
          }),
        ),
      },
    } as NewsDraft;
    assert.equal(
      assessAutoPublicationRecency(
        boundaryEvidenceDraft,
        new Date("2026-08-19T10:00:00.000Z"),
      ).ok,
      true,
      "the exact existing 168-hour policy boundary must remain eligible",
    );
    const expiredAtPublication = assessDraft(boundaryEvidenceDraft, {
      autoPublicationAt: new Date("2026-08-19T10:00:00.001Z"),
    });
    assert.equal(expiredAtPublication.verdict, "manual");
    assert.ok(
      expiredAtPublication.reasons.some((reason) =>
        /old at auto-publication/.test(reason),
      ),
      "a draft/evidence packet one millisecond beyond policy must fail closed",
    );

    const genericCtaDraft = {
      ...boundaryEvidenceDraft,
      id: "generic-cta-stays-out-of-evidence-entailment",
      article: {
        ...boundaryEvidenceDraft.article,
        cta: {
          ...boundaryEvidenceDraft.article.cta,
          label: "Keep in view",
        },
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(genericCtaDraft).verdict,
      "auto-approve",
      "generic CTA navigation must not require verbatim source entailment",
    );
    assert.equal(
      articleEvidenceSegments(genericCtaDraft.article).some(({ field }) =>
        field.startsWith("cta"),
      ),
      false,
      "CTA copy must remain outside the factual evidence projection",
    );
    const contextualCtaDraft = {
      ...genericCtaDraft,
      id: "market-derived-cta-pass",
      article: {
        ...genericCtaDraft.article,
        cta: {
          ...genericCtaDraft.article.cta,
          label: "Discuss your Dubai real estate decision with Raj",
        },
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(contextualCtaDraft).verdict,
      "auto-approve",
      "an exact CTA derived from an article market must remain source-free",
    );
    const wrongMarketCtaDraft = {
      ...contextualCtaDraft,
      id: "wrong-market-cta-held",
      article: {
        ...contextualCtaDraft.article,
        cta: {
          ...contextualCtaDraft.article.cta,
          label: "Open your Abu Dhabi real estate decision",
        },
      },
    } as NewsDraft;
    assert.equal(assessDraft(wrongMarketCtaDraft).verdict, "manual");

    const factualCtaDraft = {
      ...genericCtaDraft,
      id: "arbitrary-factual-cta-held",
      article: {
        ...genericCtaDraft.article,
        cta: {
          ...genericCtaDraft.article.cta,
          label: "Open the AED 10 million opportunity",
        },
      },
    } as NewsDraft;
    assert.equal(
      assessDraft(factualCtaDraft).verdict,
      "manual",
      "an arbitrary factual or outcome CTA must not inherit the source-free exception",
    );
    const pressuredCtaDraft = {
      ...genericCtaDraft,
      id: "pressured-cta-held",
      article: {
        ...genericCtaDraft.article,
        cta: {
          ...genericCtaDraft.article.cta,
          label: "Buy now — guaranteed return",
        },
      },
    } as NewsDraft;
    const pressuredCtaAssessment = assessDraft(pressuredCtaDraft);
    assert.equal(pressuredCtaAssessment.verdict, "manual");
    assert.ok(
      pressuredCtaAssessment.reasons.some((reason) =>
        /CTA voice and safety/.test(reason),
      ),
      "promotional pressure in a visible CTA must fail the voice/safety gate",
    );
    assert.ok(
      validateDraft(pressuredCtaDraft.article).failures.some(
        (failure) => failure.name === "CTA voice and safety",
      ),
      "the canonical voice validator must inspect the reader-visible CTA label",
    );

    const materialCounts =
      "The plan covers 7 towers in Phase 2, with 12 floors, 3 bedrooms, a 5 km corridor and 40 hectares for delivery in 2029.";
    const materialFigures = extractFigures(materialCounts);
    for (const figure of [
      "7 towers",
      "phase 2",
      "12 floors",
      "3 bedrooms",
      "5 km corridor",
      "40 hectares",
      "2029",
    ]) {
      assert.ok(materialFigures.includes(figure), `${figure} must be extracted`);
    }
    assert.deepEqual(
      extractFigures(
        "Dated 16 August 2026, Section 2 and pages 5-7 contain editorial navigation only.",
      ),
      [],
      "ordinary calendar dates and section/page labels must not become claims",
    );
    const project360Claim =
      "Project 360 gives developers a consolidated view of 80 transactions.";
    assert.deepEqual(
      extractFigures(project360Claim),
      ["project 360", "80 transactions"],
      "the exact Project 360 identifier and the separate quantity must form independent evidence tuples",
    );
    assert.deepEqual(
      findUnsupportedFigures(
        project360Claim,
        "Project 360 gives developers a consolidated view.",
      ),
      ["80 transactions"],
      "evidence for Project 360 must not let another figure in the sentence escape evidence binding",
    );
    assert.deepEqual(
      findUnsupportedFigures(
        project360Claim,
        "The platform gives developers a consolidated view of 80 transactions.",
      ),
      ["project 360"],
      "the Project 360 identifier must itself be present in fetched evidence",
    );
    assert.deepEqual(
      findUnsupportedFigures(project360Claim, project360Claim),
      [],
      "both independent numeric tuples must pass when exactly evidenced",
    );
    assert.equal(
      extractFigures("Project 360 gives developers a consolidated view.")[0],
      "project 360",
      "the dedicated identifier span must stop before trailing verbs and nouns",
    );
    assert.notDeepEqual(
      extractFigures("Project 361 gives developers a consolidated view."),
      [],
      "the identifier rule must remain exact and leave other product-number names governed by the ordinary parser",
    );
    assert.deepEqual(
      extractFigures("The project covers 360 units."),
      ["360 units"],
      "a lowercase ordinary project quantity must not be mistaken for the branded identifier",
    );
    assert.deepEqual(findUnsupportedFigures(materialCounts, materialCounts), []);
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The framework requires 50 per cent payment.",
        "The framework sets a 50 per cent payment threshold.",
      ),
      "The framework requires 50 per cent payment threshold.",
      "a uniquely matching complete evidence phrase may repair an incomplete model span",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The 50 per cent threshold aligns with prudential lending standards.",
        "The framework sets a 50 per cent payment threshold.",
      ),
      "The 50 per cent payment threshold aligns with prudential lending standards.",
      "body repair must preserve a trailing finite clause verb",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The 50 per cent threshold aligns with UAE Central Bank regulation, according to Aldar.",
        "Aldar states that the 50 per cent payment threshold is aligned with UAE Central Bank regulations.",
      ),
      "The 50 per cent payment threshold aligns with UAE Central Bank regulation, according to Aldar.",
      "TLDR repair must preserve a trailing finite clause verb",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The framework has a 50 per cent threshold requirement.",
        "The framework sets a 50 per cent payment threshold.",
      ),
      "The framework has a 50 per cent payment threshold.",
      "generic model wording may be replaced when a distinctive context noun overlaps",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The plan includes 7 new schools.",
        "The plan includes 7 new towers.",
      ),
      "The plan includes 7 new schools.",
      "a shared generic adjective must not bridge different claim nouns",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The framework has a 50 per cent payment requirement.",
        [
          "The framework sets a 50 per cent payment threshold.",
          "The framework sets a 50 per cent payment milestone.",
        ],
      ),
      "The framework has a 50 per cent payment requirement.",
      "equally plausible evidence phrases must remain unchanged",
    );
    assert.equal(
      canonicalizeEvidenceNumericPhrases(
        "The framework records AED 10 million payment threshold.",
        [
          "One source records AED 10 payment threshold.",
          "Another source mentions million payment threshold.",
        ],
      ),
      "The framework records AED 10 million payment threshold.",
      "numeric phrases split across evidence sources must never combine",
    );
    const adversarialDigitSpans =
      "7-tower 405-unit 3-bedroom 7 transactions 10 basis points 10 square metres H1/H2/Q1 2026 3:1 1 in 4 10 to 12% -5% 125bp + 5% - .5% .75% - AED .25 million AED 10-12 million AED 3/4 million 3/4 votes 7 new ultra luxury waterfront residential towers 7 new ultra luxury waterfront residential schools 2026-2027 plan Q1 2026-Q2 2027";
    const adversarialFigures = extractFigures(adversarialDigitSpans);
    for (const figure of [
      "7-tower",
      "405-unit",
      "3-bedroom",
      "7 transactions",
      "10 basis points",
      "10 square metres",
      "h1/h2/q1 2026",
      "3:1",
      "1 in 4",
      "10 to 12%",
      "-5%",
      "125bp",
      "+ 5%",
      "- .5%",
      ".75%",
      "- aed .25 million",
      "aed 10-12 million",
      "aed 3/4 million",
      "3/4 votes",
      "7 new ultra luxury waterfront residential towers",
      "7 new ultra luxury waterfront residential schools",
      "2026-2027 plan",
      "q1 2026-q2 2027",
    ]) {
      assert.ok(
        adversarialFigures.includes(figure),
        `${figure} must remain one evidence-bound digit span`,
      );
    }
    assert.deepEqual(
      findUnsupportedFigures(adversarialDigitSpans, adversarialDigitSpans),
      [],
    );
    assert.deepEqual(
      findUnsupportedFigures(
        `${adversarialDigitSpans} 8 transactions`,
        adversarialDigitSpans,
      ),
      ["8 transactions"],
      "one supported figure must never hide another unsupported digit span",
    );
    assert.deepEqual(
      findUnsupportedFigures("The value was AED 10 million.", [
        "One source mentioned AED 10",
        "Another source used the word million without that value.",
      ]),
      ["aed 10 million"],
      "numeric tokens split across publishers must not combine into support",
    );
    for (const [claim, wrongEvidence] of [
      ["AED 10-12 million", "USD 10-12 million"],
      ["AED 3/4 million", "3/4 votes"],
      ["7 new towers", "7 new schools"],
    ] as const) {
      assert.deepEqual(
        findUnsupportedFigures(claim, wrongEvidence),
        [claim.toLowerCase()],
        `${claim} must retain enough context to reject ${wrongEvidence}`,
      );
      assert.deepEqual(
        findUnsupportedFigures(claim, claim),
        [],
        `${claim} must pass when the exact contextual figure is in evidence`,
      );
    }
    assert.deepEqual(
      extractFigures(
        "Published 16 Aug. 2026 and August 16; see Sections 2-4 and pages 5 to 7.",
      ),
      [],
      "ordinary dates and navigation ranges must remain explicit safe exclusions",
    );
    assert.deepEqual(
      extractFigures("The movement was 5%-7%."),
      ["5%-7%"],
      "a decorated range must be one evidence tuple",
    );
    assert.deepEqual(
      findUnsupportedFigures("The movement was 5%-7%.", "It moved 5% and later 7%."),
      ["5%-7%"],
      "separate endpoints must not satisfy a range claim",
    );
    assert.deepEqual(
      findUnsupportedFigures("The movement was 5%-7%.", "The movement was 5%-7%."),
      [],
    );
    assert.deepEqual(extractFigures("The plan covers 405‑unit."), ["405-unit"]);
    assert.deepEqual(
      findUnsupportedFigures("The plan covers 405‑unit.", "The plan covers 405."),
      ["405-unit"],
    );
    assert.deepEqual(
      findUnsupportedFigures("The plan covers 405‑unit.", "The plan covers 405-school."),
      ["405-unit"],
    );
    assert.deepEqual(
      findUnsupportedFigures("The plan covers 405‑unit.", "The plan covers 405-unit."),
      [],
      "Unicode and ASCII dash variants must bind to the same contextual tuple",
    );

    const residualDigitDraft = {
      ...draft,
      id: "unconsumed-digit-with-supported-figure",
      article: {
        ...draft.article,
        body:
          "The verified transaction value was AED 10 million, while the unclassified label X7 remains visible.",
      },
    } as NewsDraft;
    const residualDigitAssessment = assessDraft(residualDigitDraft);
    assert.equal(residualDigitAssessment.verdict, "manual");
    assert.ok(
      residualDigitAssessment.reasons.some((reason) =>
        /digit-bearing span/.test(reason),
      ),
      "a supported amount must not conceal an unconsumed digit-bearing label",
    );

    const supportedCountsText =
      "The verified transaction value was AED 10 million. The plan covers 7 towers in Phase 2. The plan includes 12 floors and 3 bedrooms. The plan includes a 5 km corridor and 40 hectares for delivery in 2029.";
    const supportedCountsDraft = {
      ...draft,
      id: "supported-material-counts",
      article: {
        ...draft.article,
        title: "Reuters reported transaction figures",
        body: supportedCountsText,
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          evidenceRecord(
            sourceA,
            "Reuters reported transaction figures from the development record. The official record confirmed that the transaction value was AED 10 million for the period. The plan covers a tower programme of 7 towers in Phase 2 of the release. The plan includes a building configuration with 12 floors and a residential mix of 3 bedrooms. The plan includes land comprising a 5 km corridor, together with 40 hectares for delivery during 2029.",
          ),
          evidenceRecord(
            sourceB,
            "The publication reported verified transaction figures from the available record. The official record confirmed that the transaction value was AED 10 million for the period. The plan covers a tower programme of 7 towers in Phase 2 of the release. The plan includes a building configuration with 12 floors and a residential mix of 3 bedrooms. The plan includes land comprising a 5 km corridor, together with 40 hectares for delivery during 2029.",
          ),
        ],
      },
    } as NewsDraft;
    const supportedCountsAssessment = assessDraft(supportedCountsDraft);
    assert.equal(
      supportedCountsAssessment.verdict,
      "auto-approve",
      supportedCountsAssessment.reasons.join("; "),
    );

    const unsupportedCountsDraft = {
      ...supportedCountsDraft,
      id: "unsupported-material-counts",
      article: {
        ...supportedCountsDraft.article,
        body: supportedCountsDraft.article.body.replace("7 towers", "8 towers"),
      },
    } as NewsDraft;
    const unsupportedCountsAssessment = assessDraft(unsupportedCountsDraft);
    assert.equal(unsupportedCountsAssessment.verdict, "manual");
    assert.ok(unsupportedCountsAssessment.amberFigures.includes("8 towers"));

    const crossFieldFiguresDraft = {
      ...draft,
      id: "cross-field-figures",
      article: {
        ...draft.article,
        title: "AED 11 million headline",
        subtitle: "The subtitle claims AED 12 million.",
        tldr: [
          "The TLDR claims AED 13 million.",
          "Verified direct evidence",
          "Publication gate check",
        ],
        faq: [
          {
            q: "Was the value AED 14 million?",
            a: "No further supported value was supplied.",
          },
        ],
      },
    } as NewsDraft;
    const crossFieldAssessment = assessDraft(crossFieldFiguresDraft);
    assert.equal(crossFieldAssessment.verdict, "manual");
    assert.equal(crossFieldAssessment.figureCount, 5);
    assert.equal(crossFieldAssessment.amberFigures.length, 4);

    const typographyVariantDraft = {
      ...draft,
      article: {
        ...draft.article,
        title: "Reuters reports construction contract figures",
        body:
          "The contracts total AED3.5 billion and cover 8,000 homes. The construction awards represent 30 per cent of the programme.",
      },
      provenance: {
        ...draft.provenance,
        fetchedEvidence: [
          evidenceRecord(
            sourceA,
            "Reuters reported construction contract figures in its market coverage. In the official release, the contracts total AED 3.5 billion and cover 8000 homes across the verified development programme.",
          ),
          evidenceRecord(
            sourceB,
            "During the programme review, the construction awards represent 30% of the programme.",
          ),
        ],
      },
    } as NewsDraft;
    const typographyAssessment = assessDraft(typographyVariantDraft);
    assert.equal(
      typographyAssessment.verdict,
      "auto-approve",
      `equivalent currency, comma and percentage typography must verify: ${typographyAssessment.reasons.join("; ")}`,
    );

    const result = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 0,
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    assert.equal(result.approved, 2);
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.held, 1);
    assert.equal(result.deferred, 1);
    assert.equal(result.holdReasonCounts["source-date-or-freshness"], 1);
    assert.deepEqual(result.publicationShas, ["a".repeat(40)]);
    assert.deepEqual(result.publishedSlugs, [draft.article.slug]);
    assert.equal(result.deploymentVerified, 0);
    assert.equal(result.pendingVerification, 0);
    assert.equal(result.verificationSkipped, 1);
    assert.deepEqual(result.failureMessages, []);
    assert.equal(calls.length, 2);
    assert.match(calls[1], /\/publish$/);
    assert.ok(calls[1].includes(draft.id), "newest passing draft must publish first");
    assert.deepEqual(
      publishRequestBodies.at(-1),
      { expectedRevision: draft.revision, expectedRecordVersion: draft.recordVersion, expectedContentHash: draft.contentHash },
      "ordinary server publication must not opt into the automated morning ledger",
    );

    calls.length = 0;
    publishRequestBodies.length = 0;
    const automatedMorning = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      requiredPublishedDubaiDate: "2026-08-12",
      automatedMorningLane: true,
      deploymentAttempts: 0,
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    assert.equal(automatedMorning.published, 1);
    assert.deepEqual(publishRequestBodies, [
      {
        expectedRevision: draft.revision,
        expectedRecordVersion: draft.recordVersion,
        expectedContentHash: draft.contentHash,
        automatedMorningLane: true,
        requiredPublishedDubaiDate: "2026-08-12",
      },
    ]);
    await assert.rejects(
      runAutoApprove({
        site: "https://news.example.test",
        secret: "s".repeat(32),
        publish: true,
        automatedMorningLane: true,
        log: () => undefined,
      }),
      /requires an exact published Dubai date/u,
    );

    calls.length = 0;
    const dateScopedReview = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: false,
      requiredPublishedDubaiDate: "2026-08-12",
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    assert.equal(dateScopedReview.total, 3);
    assert.equal(dateScopedReview.eligible, 1);
    assert.equal(dateScopedReview.approved, 1);
    assert.equal(calls.length, 1);

    calls.length = 0;
    const emptyDateScopedReview = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      requiredPublishedDubaiDate: "2026-08-13",
      now: new Date("2026-08-13T08:00:00.000Z"),
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(emptyDateScopedReview.eligible, 0);
    assert.equal(emptyDateScopedReview.published, 0);
    assert.equal(
      calls.length,
      1,
      "a Dubai-date mismatch must not call the publish endpoint",
    );

    await assert.rejects(
      runAutoApprove({
        site: "https://news.example.test",
        secret: "s".repeat(32),
        publish: false,
        requiredPublishedDubaiDate: "2026-02-31",
        log: () => undefined,
      }),
      /exact YYYY-MM-DD/u,
    );

    calls.length = 0;
    deploymentResponseMode = "completed";
    const verifiedResult = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 1,
      deploymentDelayMs: 0,
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    deploymentResponseMode = null;
    assert.equal(verifiedResult.deploymentVerified, 1);
    assert.equal(verifiedResult.postPublishCompleted, 1);
    assert.equal(verifiedResult.postPublishPending, 0);
    assert.equal(verifiedResult.postPublishFailed, 0);
    assert.equal(verifiedResult.failed, 0);
    assert.equal(calls.length, 3);
    assert.match(calls[2], /\/deployment$/u);

    calls.length = 0;
    deploymentResponseMode = "pending";
    const pendingDistribution = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 3,
      deploymentDelayMs: 0,
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    deploymentResponseMode = null;
    assert.equal(pendingDistribution.deploymentVerified, 1);
    assert.equal(pendingDistribution.postPublishPending, 1);
    assert.equal(pendingDistribution.failed, 1);
    assert.equal(
      calls.length,
      3,
      "a completed deployment with pending downstream receipts must not replay the same key",
    );
    assert.match(pendingDistribution.failureMessages[0] ?? "", /downstream/u);

    calls.length = 0;
    const backlogResult = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      publishOrder: "backlog",
      now: new Date("2026-08-12T12:00:00.000Z"),
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(backlogResult.published, 1);
    assert.equal(backlogResult.eligible, 1);
    assert.equal(calls.length, 2);
    assert.ok(
      calls[1].includes(olderDraft.id),
      "backlog lane must publish the strongest still-timely draft first",
    );

    calls.length = 0;
    forcePublishFailure = true;
    const failedResult = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      deploymentAttempts: 0,
      now: new Date("2026-08-12T12:00:00.000Z"),
      log: () => undefined,
    });
    forcePublishFailure = false;
    assert.equal(failedResult.published, 0);
    assert.equal(failedResult.failed, 1);
    assert.deepEqual(failedResult.publicationShas, []);
    assert.match(failedResult.failureMessages[0] ?? "", /simulated publication failure/u);

    calls.length = 0;
    const noEligibleResult = await runAutoApprove({
      site: "https://news.example.test",
      secret: "s".repeat(32),
      publish: true,
      publishLimit: 1,
      publishOrder: "backlog",
      now: new Date("2026-09-30T12:00:00.000Z"),
      deploymentAttempts: 0,
      log: () => undefined,
    });
    assert.equal(noEligibleResult.total, 3);
    assert.equal(noEligibleResult.eligible, 0);
    assert.equal(noEligibleResult.published, 0);
    assert.equal(noEligibleResult.failed, 0);
    assert.equal(calls.length, 1, "No eligible story must not call the publish endpoint");
    console.log(
      "Auto-publish regression passed: evidence policy, publication-time recency, CTA safety and bounded newest/backlog selection are enforced.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
