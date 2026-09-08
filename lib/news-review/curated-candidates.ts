import {
  CURRENT_EVIDENCE_POLICY_VERSION,
  type DraftArticle,
  type NewsDraft,
  type PublicationReceipt,
} from "./types";
import type { NewsArticle } from "@/content/news/types";
import {
  draftContentHash,
  sha256Json,
  WITHHELD_MEDIA_APPROVAL_HASH,
} from "./integrity";

export const CURATED_NEWS_CANDIDATE_KEYS = [
  "dld-initial-registration-2026-09-07",
  "rak-h1-housing-2026-09-02",
  "adgm-h1-growth-2026-09-08",
] as const;

export type CuratedNewsCandidateKey =
  (typeof CURATED_NEWS_CANDIDATE_KEYS)[number];

/** A curated candidate is review input, never a pre-published article. */
export type CuratedDraftArticle = Omit<
  DraftArticle,
  "publicationContentHash"
> & {
  publicationContentHash?: never;
  status?: never;
};

export interface CuratedNewsCandidate {
  key: CuratedNewsCandidateKey;
  draftId: string;
  topic: string;
  reviewNote: string;
  article: CuratedDraftArticle;
}

const dldInitialRegistration: CuratedNewsCandidate = {
  key: "dld-initial-registration-2026-09-07",
  draftId: "d1d10907-2026-4090-8090-700000000001",
  topic: "Dubai Land Department launches Initial Registration platform",
  reviewNote:
    "Human-edited candidate. Stage only after every cited publisher page passes direct evidence, date, identity, voice and deterministic assessment gates.",
  article: {
    slug: "2026-09-07-dubai-land-department-launches-initial-registration-platform",
    title: "Dubai Land Department launches Initial Registration platform",
    subtitle:
      "The new DLD system connects developer registration, transaction processing and escrow administration",
    publishedAt: "2026-09-07T04:50:00.000Z",
    modifiedAt: "2026-09-07T04:50:00.000Z",
    displayDate: "07 Sept 2026",
    author: "raj-tomar",
    tier: "news",
    category: "regulatory",
    market: ["Dubai"],
    tldr: [
      "DLD has launched Initial Registration for project, transaction and escrow administration.",
      "WAM reports that transactions previously taking around 30 minutes to register can now be completed in less than five minutes.",
      "The release describes an operational system for developers and DLD, not a change to buyer purchase rules.",
    ],
    body: `Registration transactions that previously took around 30 minutes to register can now be completed in less than five minutes through Dubai Land Department's new Initial Registration platform, Mustafa Al Rifai, a senior manager at DLD and the official responsible for the system, told the Emirates News Agency. He said the platform can reduce transaction-completion time and data-entry operations by up to 80 per cent. Those figures describe the system's intended administrative performance — they do not alter the terms on which a home is bought or sold.

DLD launched Initial Registration on 3 September 2026 as a connected service for real estate developers. The official release says it brings together project registration, real estate transaction registration and escrow account management. Its stated purpose is to reduce repetitive data entry and document submissions while improving coordination among developers, DLD and the banks that manage escrow accounts.

The system uses artificial intelligence to read Emirates IDs, passports and sales contracts, extract relevant information and populate fields. DLD says standard registration transactions that meet the applicable requirements and business rules may be eligible for approval when submitted. That qualification matters: the announcement does not say that every transaction will be approved automatically, nor does it remove the checks attached to a non-standard or incomplete submission.

Initial Registration also asks users a short series of questions to direct them to the appropriate procedure. If information is missing, the user can supply it while the transaction remains open instead of beginning a new application for a minor omission. DLD presents this as a way to simplify the administrative journey and increase the proportion of applications accepted on their first submission.

A feature called Project 360 gives developers a consolidated view of each project. The official description covers unit status, escrow accounts, financial data and project records, together with early-warning indicators intended to support monitoring and timely intervention. DLD also says data can be reused across connected systems to reduce discrepancies among sales, escrow and ownership records. Project 360 is therefore an internal project-management and oversight view — the release does not describe it as a public buyer portal or an investment-scoring tool.

Developers can use one account to manage multiple companies and monitor multiple projects. The platform supports defined permissions and separate roles for submitting and reviewing transactions, which allows a developer to divide responsibilities inside its own organisation. Al Rifai also told WAM that communication and transaction follow-up between developers and DLD have been integrated into the platform, reducing the need for visits, telephone calls and emails.

The rollout is phased. Al Rifai said more than 1,500 real estate developers will benefit from the transition. Major developers will receive practical training over a period of two to three weeks. The remaining developers will then be trained and onboarded in batches of between 50 and 100 through successive weekly phases until all developers have migrated to the new platform. WAM reported that this is the first phase, with further system integrations and upgrades planned for a later phase.

For market participants, the safest reading is also the narrowest one. Initial Registration changes how developers and DLD handle defined registration work, documents and project records. The DLD and WAM announcements do not state that the platform changes sale prices, reservation deposits, service charges, mortgage eligibility, payment plans, ownership rights, residency rules or the legal protections attached to an escrow account.

That distinction prevents an operational announcement from being mistaken for a new buyer incentive. A purchaser may eventually encounter a developer process supported by the new system, but the published material does not establish a universal reduction in the time taken by every buyer-facing step. It also does not establish that a faster data-entry stage shortens construction, handover or title issuance. Each of those questions still depends on the relevant project, transaction and regulatory process.

The confirmed change is a more integrated administrative layer. The official announcement includes comments from the chief executive of DLD's Real Estate Regulatory Agency (RERA), and describes a platform that combines project registration, transaction registration and escrow administration. The practical test will be whether the phased onboarding produces the stated reductions in manual entry and follow-up while preserving the business-rule checks described in the official release.

For a buyer reviewing a project, the due-diligence list therefore remains the same: verify the developer and project registration, confirm the escrow account, read the sale and purchase agreement, understand the payment schedule and check the project's reported status through the appropriate official channels. Initial Registration may improve the system used behind those records, but DLD has not presented it as a substitute for those checks.

For now, the evidence supports a specific operational conclusion: DLD has introduced a more connected workflow for developers, registration and escrow administration. Wider claims about buyer outcomes should wait for implementation evidence from the authority.`,
    faq: [
      {
        q: "What is DLD's Initial Registration platform?",
        a: "It is a developer-facing DLD system that connects project registration, real estate transaction registration and escrow account management.",
      },
      {
        q: "Does the platform change the rules for buying Dubai real estate?",
        a: "The official DLD and WAM announcements describe an operational platform for developers and DLD. They do not announce changes to buyer purchase rules, fees, ownership rights or payment-plan terms.",
      },
      {
        q: "Will every registration transaction be approved automatically?",
        a: "No such blanket approval was announced. DLD says standard transactions that meet the applicable requirements and business rules may be eligible for approval upon submission.",
      },
      {
        q: "What does Project 360 show?",
        a: "DLD says it provides a consolidated project view covering unit status, escrow accounts, financial data, project records and early-warning indicators.",
      },
      {
        q: "How is the platform being rolled out?",
        a: "Mustafa Al Rifai told WAM that more than 1,500 real estate developers will benefit from the transition. Major developers will receive practical training first, followed by batches of between 50 and 100 through successive weekly phases until all developers have migrated.",
      },
    ],
    citations: [
      {
        source: "Dubai Land Department",
        url: "https://dubailand.gov.ae/en/news-media/dubai-land-department-launches-initial-registration-a-smarter-journey-for-developers-and-greater-efficiency-for-the-real-estate-sector/",
        accessedAt: "2026-09-07T04:48:03.306Z",
        tier: "government",
      },
      {
        source: "WAM (Emirates News Agency)",
        url: "https://www.wam.ae/en/article/c227c90-dubai-land-department-launches-ai-powered-initial",
        accessedAt: "2026-09-07T04:48:03.306Z",
        tier: "government",
      },
      {
        source: "Gulf News — Property",
        url: "https://gulfnews.com/business/property/dubai-land-department-launches-ai-powered-platform-to-speed-up-real-estate-registration-for-developers-1.500662918",
        accessedAt: "2026-09-07T04:48:03.306Z",
        tier: "national-press",
      },
    ],
    heroImage: {
      src: "/news/2026-09-07-dubai-land-department-launches-initial-registration-platform/cover.jpg",
      alt: "Dubai Land Department Initial Registration platform announcement",
      credit: "Verified editorial image withheld pending UHD rights approval",
    },
    cta: {
      href: "https://investwithraj.com/engage?utm_source=news&utm_medium=internal&utm_campaign=dld_initial_registration&utm_content=article-cta",
      label: "Discuss your Dubai real estate decision with Raj",
    },
    distribution: {},
    metaDescription:
      "What Dubai Land Department's Initial Registration platform changes for developers—and what its launch does not change for buyers.",
    speakableSelector: [".article-tldr", ".article-body > p:first-child"],
  },
};

const rakH1Housing: CuratedNewsCandidate = {
  key: "rak-h1-housing-2026-09-02",
  draftId: "a1a10902-2026-4090-8090-200000000002",
  topic:
    "Ras Al Khaimah housing stays above 2025 levels as quarterly momentum eases",
  reviewNote:
    "Human-edited candidate. Stage only after both independent publisher pages pass direct evidence, date, identity, voice and deterministic assessment gates.",
  article: {
    slug: "2026-09-07-ras-al-khaimah-h1-housing-momentum-eases",
    title: "Ras Al Khaimah housing growth cools as new supply approaches",
    subtitle:
      "Annual sale prices remained higher while recent quarterly readings and forward supply point to a more measured market",
    publishedAt: "2026-09-07T04:50:55.301Z",
    modifiedAt: "2026-09-07T04:50:55.301Z",
    displayDate: "07 Sept 2026",
    author: "raj-tomar",
    tier: "news",
    category: "market-pulse",
    market: ["Ras Al Khaimah"],
    tldr: [
      "Apartment prices remained 6.5% higher year-on-year in H1 2026, while villa prices increased by almost 6%.",
      "Apartment sale prices declined 0.7%, while villa prices slipped 0.2% in the latest three-month period.",
      "Ras Al Khaimah has 13,800 new homes in the pipeline through the end of 2028.",
    ],
    body: `Apartment prices remained 6.5% higher year-on-year in H1 2026. Villa prices increased by almost 6%. The latest three-month period moved in the other direction: apartment sale prices declined 0.7%, while villa prices slipped 0.2%. Read together, the data describe a market that was still above year-earlier levels but losing some near-term momentum. That is a more useful reading than forcing the half-year and quarterly comparisons into one direction.

The two comparisons answer different questions. A half-year annual comparison shows where the broader price level stood against the corresponding period. A quarterly movement is a shorter signal and can soften while the annual position remains positive. The distinction matters because buyers who see only the annual headline may assume momentum is still accelerating, while those who see only the latest quarter may overstate the weakness. The market evidence supports neither shortcut.

Rental performance was split by housing type. Apartment rents fell 1.4%, while villa rents continued to increase by nearly 1%. That divergence does not support one blanket statement about the rental market. It suggests that tenant demand, available stock and pricing power were behaving differently across apartments and villas. Anyone evaluating a purchase should therefore work at community and typology level rather than treating the emirate as a single rental trade.

Freehold ready residential transactions reached Dh625.2 million in H1 2026. The value was down 3.3% year-on-year but up 24% compared with H2 2025. Here too, the baseline changes the story. Activity improved against the immediately preceding half-year, yet remained below the corresponding annual comparison. This is evidence of recovery from a softer prior period, not proof that every part of the market strengthened.

The transaction measure has a defined scope. It covers the reported value of ready freehold residential sales. It is not a count of homes sold, an emirate-wide valuation or a measure of off-plan activity. Using it as a proxy for the whole market would blur differences between completed stock and future inventory. The better interpretation is narrower: the ready segment regained some activity against the previous half-year but did not exceed its annual comparator.

Supply is the next part of the picture. Around 600 homes were delivered during the first half of 2026, with another 1,600 expected during the second half. A total of 2,200 units are expected during 2026, followed by 4,700 in 2027 and another 7,500 in 2028. Ras Al Khaimah has 13,800 new homes in the pipeline through the end of 2028. These are expected deliveries, not completed inventory.

The forward total should be read as a schedule rather than a certainty. Projects can move between reporting periods, and aggregate delivery plans do not show how supply is distributed by community, price bracket, developer or housing type. That composition will shape the real absorption test. A well-located villa community and a dense apartment cluster can meet very different demand pools even when both appear in the same emirate-wide pipeline.

Cavendish Maxwell linked absorption to continued employment growth and the emirate's ability to attract and retain residents. That is the structural issue behind the supply headline. New homes need recurring end-user demand, not only reservation activity at launch. Greater competition between developments may give buyers more choice, but it can also expose weaker positioning, delayed amenities and projects whose pricing depends on scarcity that no longer exists.

For an investor, the mandate is to separate a market signal from a real estate decision. Softer quarterly readings may create negotiating room, but they do not establish value on their own. Annual growth may show resilience, but it does not protect an overpaid entry. The decision still turns on the specific precinct, comparable completed stock, realistic rent, service charges, payment structure and exit liquidity. Those variables determine whether the asset can absorb a more competitive supply environment.

The practical consequence is tighter underwriting discipline. Compare the asking price with completed alternatives, test rent assumptions against observed leases, and allow for slippage in competing projects. If the purchase only works while supply remains scarce and resale demand stays effortless, its margin of safety is too thin.

The current evidence therefore supports a measured conclusion rather than a broad structural call. Price levels remained higher on the annual comparison, shorter-term sale-price momentum moderated, apartment and villa rents diverged, ready transaction activity improved against the previous half-year, and the supply pipeline is substantial. None of those signals alone proves a sustained decline or guarantees that earlier growth will continue.

The next release should be tested against the same baselines. The useful questions are whether scheduled homes actually complete, whether moderation persists across more than one reporting period, whether ready activity continues to recover and whether demand remains broad enough to absorb competing launches. Until that evidence arrives, Ras Al Khaimah looks less like a one-way momentum market and more like a selection market — one in which entry price, typology and delivery quality matter more than a general emirate narrative.`,
    faq: [
      {
        q: "Did sale prices rise or fall?",
        a: "Apartment prices remained 6.5% higher year-on-year in H1 2026, while villa prices increased by almost 6%. Apartment sale prices declined 0.7%, while villa prices slipped 0.2% in the latest three-month period. The comparisons cover different time frames.",
      },
      {
        q: "What happened to rents?",
        a: "Apartment rents fell 1.4%, while villa rents continued to increase by nearly 1%. The two housing types moved in different directions.",
      },
      {
        q: "What happened to ready transactions?",
        a: "Freehold ready residential transactions reached Dh625.2 million in H1 2026. The value was down 3.3% year-on-year but up 24% compared with H2 2025.",
      },
      {
        q: "What does the forward supply schedule show?",
        a: "Around 600 homes were delivered during the first half of 2026, with another 1,600 expected during the second half. A total of 2,200 units are expected during 2026, followed by 4,700 in 2027 and another 7,500 in 2028.",
      },
      {
        q: "Is every planned home guaranteed to arrive on schedule?",
        a: "No. The figures describe an expected delivery schedule. Project timing can change, so the pipeline should not be treated as completed inventory or a guarantee for individual developments.",
      },
    ],
    citations: [
      {
        source: "Gulf News — Property",
        url: "https://gulfnews.com/business/property/ras-al-khaimah-property-prices-rise-in-h1-2026-13800-homes-due-by-2028-1.500660431",
        accessedAt: "2026-09-07T04:50:55.301Z",
        tier: "national-press",
      },
      {
        source: "Khaleej Times — Real Estate",
        url: "https://www.khaleejtimes.com/business/ras-al-khaimah-rents-rise-in-h1-2026-but-apartment-rates-drop-in-q2",
        accessedAt: "2026-09-07T04:50:55.301Z",
        tier: "national-press",
      },
    ],
    heroImage: {
      src: "/news/2026-09-07-ras-al-khaimah-h1-housing-momentum-eases/cover.jpg",
      alt: "Ras Al Khaimah waterfront residential skyline",
      credit: "Verified editorial image withheld pending UHD rights approval",
    },
    cta: {
      href: "https://investwithraj.com/engage?utm_source=news&utm_medium=internal&utm_campaign=rak_h1_2026_market_pulse&utm_content=article-cta",
      label: "Discuss your Ras Al Khaimah real estate decision with Raj",
    },
    distribution: {},
    metaDescription:
      "Ras Al Khaimah housing analysis covering annual prices, quarterly moderation, ready sales and the forward supply schedule.",
    speakableSelector: [".article-tldr", ".article-body > p:first-child"],
  },
};

const adgmH1Growth: CuratedNewsCandidate = {
  key: "adgm-h1-growth-2026-09-08",
  draftId: "ad6d0908-2026-4090-8090-800000000003",
  topic: "ADGM H1 2026 capital, licence, entity and workforce results",
  reviewNote:
    "Human-edited candidate. Stage only after the Abu Dhabi Media Office and Gulf News pages pass fresh direct-evidence, date, identity, voice, duplicate and deterministic publication gates.",
  article: {
    slug: "2026-09-08-adgm-h1-2026-aum-licences-workforce",
    title: "ADGM H1 2026: AUM rises 54% as active licences reach 13,974",
    subtitle:
      "Abu Dhabi Media Office and Gulf News separate the centre's capital, licence, entity and workforce measures",
    publishedAt: "2026-09-08T11:15:00.000Z",
    modifiedAt: "2026-09-08T11:15:00.000Z",
    displayDate: "08 Sept 2026",
    author: "raj-tomar",
    tier: "news",
    category: "regulatory",
    market: ["Abu Dhabi"],
    tldr: [
      "Abu Dhabi Media Office and Gulf News report that AUM within ADGM rose 54% in H1 2026 from H1 2025.",
      "Both sources report 13,974 active licences and 49,027 professionals; the operational-entity count reached 3,986.",
      "Both sources identify more than US$2.1 trillion as global AUM overseen by managers entering ADGM in H1 2026.",
    ],
    body: `Abu Dhabi Media Office and Gulf News report that assets under management within ADGM rose 54% in H1 2026 from H1 2025. Both publications use H1 2025 as the comparison period. Neither publication provides the absolute amount of AUM held within ADGM, so the confirmed rate of change is 54% — not a local dollar total.

Abu Dhabi Media Office and Gulf News report that the fund and asset manager count in ADGM reached 190. Both sources report an increase of 23% from 154 in H1 2025, with 11 managers added in the second quarter. Both sources also report that the number of funds managed from ADGM reached 276. The reported annual increase was 32% from 209. These are three distinct measures: manager count, fund count and the reported rate of change in AUM.

Abu Dhabi Media Office and Gulf News report 13,974 active licences at the end of H1 2026. Both sources report that 1,814 licences were issued during the half year. Both sources separately report that operational entities reached 3,986. The reported increase was 34% from 2,972 at the end of H1 2025. The two measures should not be collapsed into a single company count because the publications present licences and operational entities as separate categories.

Abu Dhabi Media Office and Gulf News report a workforce of 49,027 professionals across Al Maryah Island and Al Reem Island at the end of H1 2026. Both sources report that the workforce increased by 4,688 during the half year. The reported year-on-year increase was 34%. The stated total spans the combined ADGM jurisdiction across both island precincts; neither publication describes it as a finance-only headcount.

Abu Dhabi Media Office and Gulf News report that the financial-services entity count in ADGM reached 392. Both sources report an increase of 27% from 308 a year earlier. Both publications report that the Financial Services Regulatory Authority issued 50 In-Principle Approvals and granted 45 new Financial Services Permissions during the period. An approval, a permission, a financial-services entity and an active licence are reported as different records and should remain different in any comparison.

Abu Dhabi Media Office and Gulf News report that asset managers established operations in ADGM during H1 2026. Both sources report that those managers collectively oversee more than US$2.1 trillion in global assets under management. Both sources define that figure as the worldwide AUM of those incoming managers. It is not presented as the amount managed within ADGM, and it should not be added to or substituted for the separate AUM rate of 54%.

Abu Dhabi Media Office and Gulf News also report more than US$100 billion in AI-focused investment held by entities established in ADGM. Both sources identify MGX as one part of that concentration. The publications do not describe the US$100 billion as ADGM's own spending. They separately report an ADGM technology roadmap of more than AED400 million through 2029.

Abu Dhabi Media Office and Gulf News report that the first phase of ADGM's internal AI programme introduced 25 business functions with AI across licensing, supervision and customer service. Both sources report that the programme reduced manual workload by more than 5,000 staff hours annually and resolved about 25% of customer enquiries immediately through digital channels. Those figures describe ADGM's own operating programme; they do not measure operations elsewhere in the jurisdiction.

For real estate and business readers, the scope boundary is important. Neither the Abu Dhabi Media Office report nor the Gulf News report provides office take-up, vacancy, rents, residential prices, transaction values or secondary market data. Both publications cover H1 2026. Their results document the scale of ADGM's regulated business community and workforce, but they do not measure a change in the value of any building, island precinct or home.

The evidence supports a precise summary. Abu Dhabi Media Office and Gulf News keep AUM, manager count, fund count, active licences, operational entities, financial-services entities and workforce as separate measures. The reports present active licences as a period-end total and do not attach a year-on-year percentage to that measure. Keeping those definitions intact is the clearest way to read the update without turning an institutional results release into a real estate investment mandate.`,
    faq: [
      {
        q: "What increased by 54%?",
        a: "Abu Dhabi Media Office and Gulf News report that AUM within ADGM increased 54% year on year in H1 2026.",
      },
      {
        q: "Are active licences the same as operating companies?",
        a: "Abu Dhabi Media Office and Gulf News report 13,974 active licences. Both sources separately report that operational entities reached 3,986. Neither source presents the measures as interchangeable.",
      },
      {
        q: "Is US$2.1 trillion the amount managed inside ADGM?",
        a: "Abu Dhabi Media Office and Gulf News identify it as the global AUM overseen by asset managers that established ADGM operations during H1 2026, not the absolute AUM held within ADGM.",
      },
      {
        q: "What workforce figure was reported?",
        a: "Abu Dhabi Media Office and Gulf News report 49,027 professionals across Al Maryah Island and Al Reem Island at the end of H1 2026. Both sources report an annual increase of 34%.",
      },
      {
        q: "Does the release establish a change in Abu Dhabi real estate values?",
        a: "Neither Abu Dhabi Media Office nor Gulf News reports office rents, vacancy, residential prices or transaction values in its coverage of H1 2026.",
      },
    ],
    citations: [
      {
        source: "Abu Dhabi Media Office",
        url: "https://www.mediaoffice.abudhabi/en/economy/adgm-reinforces-abu-dhabis-position-as-global-financial-hub/",
        accessedAt: "2026-09-08T11:10:00.000Z",
        tier: "government",
      },
      {
        source: "Gulf News — Property",
        url: "https://gulfnews.com/business/markets/adgm-assets-jump-54-workforce-nears-50000-1.500666929",
        accessedAt: "2026-09-08T11:10:00.000Z",
        tier: "national-press",
      },
    ],
    heroImage: {
      src: "/news/2026-09-08-adgm-h1-2026-aum-licences-workforce/cover.jpg",
      alt: "ADGM institutional results coverage",
      credit: "Verified editorial image withheld pending UHD rights approval",
    },
    cta: {
      href: "https://investwithraj.com/engage?utm_source=news&utm_medium=internal&utm_campaign=adgm_h1_2026&utm_content=article-cta",
      label: "Open your Abu Dhabi real estate decision",
    },
    distribution: {},
    metaDescription:
      "Abu Dhabi Media Office and Gulf News report that AUM rose 54% in H1 2026, with 13,974 active licences and 49,027 professionals across ADGM.",
    speakableSelector: [".article-tldr", ".article-body > p:first-child"],
  },
};

const CURATED_NEWS_CANDIDATES: Record<
  CuratedNewsCandidateKey,
  CuratedNewsCandidate
> = {
  "dld-initial-registration-2026-09-07": dldInitialRegistration,
  "rak-h1-housing-2026-09-02": rakH1Housing,
  "adgm-h1-growth-2026-09-08": adgmH1Growth,
};

export function isCuratedNewsCandidateKey(
  value: string,
): value is CuratedNewsCandidateKey {
  return CURATED_NEWS_CANDIDATE_KEYS.includes(
    value as CuratedNewsCandidateKey,
  );
}

/** Return a detached copy so runtime evidence assembly cannot mutate source. */
export function getCuratedNewsCandidate(
  requestedKey: string,
): CuratedNewsCandidate {
  const key = requestedKey.trim().toLowerCase();
  if (!isCuratedNewsCandidateKey(key)) {
    throw new Error(`Unknown curated news candidate key: ${key.slice(0, 80)}`);
  }
  return structuredClone(CURATED_NEWS_CANDIDATES[key]);
}

function editorialFingerprint(
  article: DraftArticle | NewsArticle,
): string {
  const editorial: Record<string, unknown> = {
    ...(article as unknown as Record<string, unknown>),
    heroImage: { alt: article.heroImage.alt },
  };
  delete editorial.status;
  delete editorial.publicationContentHash;
  return sha256Json(editorial);
}

/** Media and publication-ledger fields are pipeline-owned; all human-edited
 * article fields must still match before an existing public slug is a no-op. */
export function curatedCandidateMatchesPublishedArticle(
  candidate: CuratedNewsCandidate,
  published: NewsArticle,
): boolean {
  return editorialFingerprint(candidate.article) === editorialFingerprint(published);
}

export function assertCuratedPublicationOutcome(
  requestedKey: string,
  targetSlug: string,
  summary: { published: number; publishedSlugs: string[] },
): void {
  const candidate = getCuratedNewsCandidate(requestedKey);
  if (targetSlug !== candidate.article.slug) {
    throw new Error("Curated publication target slug does not match its key.");
  }
  if (
    summary.published !== 1 ||
    summary.publishedSlugs.length !== 1 ||
    summary.publishedSlugs[0] !== targetSlug
  ) {
    throw new Error(
      "Curated publication did not publish exactly its one staged target.",
    );
  }
}

export function assertCompletedCuratedPublication(input: {
  candidate: CuratedNewsCandidate;
  published: NewsArticle;
  archivedDraft: NewsDraft;
  receipt: PublicationReceipt;
  currentEvidenceFingerprint: string;
  archivedEvidenceFingerprint: string;
  canonicalDeploymentVerified: boolean;
}): void {
  const {
    candidate,
    published,
    archivedDraft,
    receipt,
    currentEvidenceFingerprint,
    archivedEvidenceFingerprint,
    canonicalDeploymentVerified,
  } = input;
  const publicHash = published.publicationContentHash ?? "";
  const expectedUrl = `https://news.investwithraj.com/news/${candidate.article.slug}`;
  const publication = archivedDraft.publication;
  const evidenceApproval = archivedDraft.evidenceApproval;
  const mediaApprovalHash =
    archivedDraft.mediaApproval?.hash ?? WITHHELD_MEDIA_APPROVAL_HASH;
  if (
    published.status !== "live" ||
    !/^[a-f0-9]{64}$/u.test(publicHash) ||
    !curatedCandidateMatchesPublishedArticle(candidate, published) ||
    archivedDraft.id !== candidate.draftId ||
    archivedDraft.article.slug !== candidate.article.slug ||
    !curatedCandidateMatchesPublishedArticle(
      candidate,
      archivedDraft.article as NewsArticle,
    ) ||
    archivedDraft.contentHash !== publicHash ||
    draftContentHash(archivedDraft.article, archivedDraft.provenance) !==
      publicHash ||
    !evidenceApproval ||
    evidenceApproval.policyVersion !== CURRENT_EVIDENCE_POLICY_VERSION ||
    evidenceApproval.contentHash !== publicHash ||
    evidenceApproval.revision !== archivedDraft.revision ||
    publication?.state !== "completed" ||
    publication.evidencePolicyVersion !== CURRENT_EVIDENCE_POLICY_VERSION ||
    publication.contentHash !== publicHash ||
    publication.claimId !== receipt.claimId ||
    publication.revision !== receipt.revision ||
    publication.mediaApprovalHash !== mediaApprovalHash ||
    publication.evidenceApprovalHash !== evidenceApproval.hash ||
    publication.commitSha !== receipt.commitSha ||
    publication.url !== expectedUrl ||
    receipt.draftId !== candidate.draftId ||
    receipt.evidencePolicyVersion !== CURRENT_EVIDENCE_POLICY_VERSION ||
    receipt.slug !== candidate.article.slug ||
    receipt.revision !== archivedDraft.revision ||
    receipt.contentHash !== publicHash ||
    receipt.mediaApprovalHash !== mediaApprovalHash ||
    receipt.evidenceApprovalHash !== evidenceApproval.hash ||
    !/^[a-f0-9]{40}$/u.test(receipt.commitSha) ||
    receipt.url !== expectedUrl ||
    currentEvidenceFingerprint !== archivedEvidenceFingerprint ||
    !canonicalDeploymentVerified
  ) {
    throw new Error(
      "The existing public candidate lacks an exact durable publication proof.",
    );
  }
}
