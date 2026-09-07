import assert from "node:assert/strict";

import {
  extractCandidateLinks,
  extractCandidatePublicationDate,
} from "../lib/sources/fetchers/webfetch.js";
import {
  extractMainText,
  extractPublicationDate,
  extractWamPublisherApiArticle,
  parseWamPublisherArticleDate,
  publisherArticleFetchCandidates,
  publisherRepresentationMatchesCitation,
} from "../lib/sources/extract.js";

const BASE = "https://example.gov.ae/news/";

function main(): void {
  const undated = `
    <article>
      <a href="/news/official-market-announcement">Official market announcement with enough headline text</a>
    </article>`;
  assert.deepEqual(
    extractCandidateLinks(
      undated,
      BASE,
      "Example Authority",
      "government",
      "example.gov.ae",
      10,
    ),
    [],
    "collection time must never be substituted for an unknown publication date",
  );

  const datedCard = `
    <article>
      <time datetime="2026-09-05T11:30:00+04:00">5 September 2026</time>
      <a href="/news/official-market-announcement">Official market announcement with enough headline text</a>
    </article>`;
  const datedEntries = extractCandidateLinks(
    datedCard,
    BASE,
    "Example Authority",
    "government",
    "example.gov.ae",
    10,
  );
  assert.equal(datedEntries.length, 1);
  assert.equal(datedEntries[0]?.publishedAt, "2026-09-05T07:30:00.000Z");

  const urlDated =
    "https://example.gov.ae/news/2026/09/04/official-market-announcement";
  assert.equal(
    extractCandidatePublicationDate("", 0, 0, urlDated),
    "2026-09-04T00:00:00.000Z",
  );

  const conflictingDates = `
    <article>
      <time datetime="2026-09-04">First date</time>
      <a href="/news/official-market-announcement">Official market announcement with enough headline text</a>
      <time datetime="2026-09-05">Second date</time>
    </article>`;
  assert.deepEqual(
    extractCandidateLinks(
      conflictingDates,
      BASE,
      "Example Authority",
      "government",
      "example.gov.ae",
      10,
    ),
    [],
    "ambiguous card dates must fail closed",
  );

  assert.deepEqual(
    publisherArticleFetchCandidates(
      "https://www.khaleejtimes.com/business/aldar-adcb-complete-abu-dhabis-first-off-plan-mortgage-under-new-adrec-framework",
    ),
    [
      "https://www.khaleejtimes.com/business/aldar-adcb-complete-abu-dhabis-first-off-plan-mortgage-under-new-adrec-framework?amp=1",
      "https://www.khaleejtimes.com/business/aldar-adcb-complete-abu-dhabis-first-off-plan-mortgage-under-new-adrec-framework",
    ],
    "Khaleej Times evidence should use its bounded publisher-owned AMP representation first",
  );
  assert.deepEqual(
    publisherArticleFetchCandidates(
      "https://gulfnews.com/business/property/new-mortgage-option-opens-for-abu-dhabi-off-plan-buyers-with-aldar-and-adcb-deal-1.500663048",
    ),
    [
      "https://gulfnews.com/amp/story/business/property/new-mortgage-option-opens-for-abu-dhabi-off-plan-buyers-with-aldar-and-adcb-deal-1.500663048",
      "https://gulfnews.com/business/property/new-mortgage-option-opens-for-abu-dhabi-off-plan-buyers-with-aldar-and-adcb-deal-1.500663048",
    ],
    "Gulf News evidence should use its bounded publisher-owned AMP representation first",
  );
  assert.deepEqual(
    publisherArticleFetchCandidates(
      "https://www.reuters.com/world/example-article",
    ),
    ["https://www.reuters.com/world/example-article"],
    "unrecognised publishers must not be rewritten",
  );
  const wamArticleUrl =
    "https://www.wam.ae/en/article/c227c90-dubai-land-department-launches-ai-powered-initial";
  const wamApiUrl =
    "https://www.wam.ae/api/app/articles/GetArticleBySlug?slug=c227c90-dubai-land-department-launches-ai-powered-initial";
  assert.deepEqual(publisherArticleFetchCandidates(wamArticleUrl), [
    wamArticleUrl,
    wamApiUrl,
  ]);
  const wamPayload = JSON.stringify({
    shortCode: "c227c90",
    title:
      "Dubai Land Department launches AI-powered Initial Registration platform",
    articleDate: "2026-09-03T20:48:55.081+04:00",
    body:
      "<p>Dubai Land Department launched the Initial Registration platform for developers, connecting registration and escrow administration in one official workflow.</p>",
  });
  assert.deepEqual(
    extractWamPublisherApiArticle(
      wamPayload,
      wamArticleUrl,
      wamApiUrl,
      wamApiUrl,
    ),
    {
      text:
        "Dubai Land Department launched the Initial Registration platform for developers, connecting registration and escrow administration in one official workflow.",
      publishedAt: "2026-09-03T16:48:55.081Z",
      publicationDateSource: "publisher-api",
    },
  );
  assert.equal(
    parseWamPublisherArticleDate("03/09/2026 8:48:55 PM"),
    "2026-09-03T16:48:55.000Z",
    "WAM's live dd/MM/yyyy UAE-local value must never be read as a US date",
  );
  assert.equal(
    parseWamPublisherArticleDate("31/02/2026 8:48:55 PM"),
    null,
    "an impossible WAM calendar date must fail closed",
  );
  assert.equal(
    parseWamPublisherArticleDate("09/03/2026"),
    null,
    "an incomplete locale-ambiguous date must fail closed",
  );
  assert.equal(
    parseWamPublisherArticleDate(
      "03/09/2026 8:48:55 PM / 04/09/2026 8:48:55 PM",
    ),
    null,
    "conflicting WAM timestamp values must fail closed",
  );
  assert.equal(
    extractWamPublisherApiArticle(
      wamPayload.replace("c227c90", "wrong99"),
      wamArticleUrl,
      wamApiUrl,
      wamApiUrl,
    ),
    null,
    "a publisher API response with a different short code must fail closed",
  );
  assert.equal(
    extractWamPublisherApiArticle(
      wamPayload,
      wamArticleUrl,
      wamApiUrl,
      "https://api.wam.ae/api/app/articles/GetArticleBySlug?slug=c227c90-dubai-land-department-launches-ai-powered-initial",
    ),
    null,
    "a cross-origin publisher API response must fail closed",
  );
  assert.equal(
    extractWamPublisherApiArticle(
      "{not-json",
      wamArticleUrl,
      wamApiUrl,
      wamApiUrl,
    ),
    null,
    "malformed publisher API data must fail closed",
  );

  const citedUrl =
    "https://gulfnews.com/business/property/verified-article-1.500000001";
  const ampUrl =
    "https://gulfnews.com/amp/story/business/property/verified-article-1.500000001";
  assert.equal(
    publisherRepresentationMatchesCitation(
      `<link href="${citedUrl}" rel="canonical">`,
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    true,
    "a synthetic representation with a matching publisher canonical is accepted",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      `<meta content="${citedUrl}?utm_source=amp" property="og:url">`,
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    true,
    "a matching publisher og:url is accepted when rel=canonical is absent",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      '<link rel="canonical" href="https://gulfnews.com/business/property/a-different-article-1.500000002">',
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    false,
    "a mismatched canonical must fail closed",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      [
        '<link rel="canonical" href="https://gulfnews.com/business/property/a-different-article-1.500000002">',
        `<meta property="og:url" content="${citedUrl}">`,
      ].join(""),
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    false,
    "a matching og:url must not override a mismatched rel=canonical",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      [
        `<link rel="canonical" href="${citedUrl}">`,
        '<link rel="canonical" href="https://gulfnews.com/business/property/a-different-article-1.500000002">',
      ].join(""),
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    false,
    "multiple conflicting canonical identities must fail closed",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      [
        `<meta property="og:url" content="${citedUrl}">`,
        '<meta property="og:url" content="https://gulfnews.com/business/property/a-different-article-1.500000002">',
      ].join(""),
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    false,
    "multiple conflicting og:url identities must fail closed when no canonical exists",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      '<link rel="canonical" href="https://gulfnews.com/">',
      citedUrl,
      ampUrl,
      ampUrl,
    ),
    false,
    "a soft-404 or homepage representation must fail closed",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      `<link rel="canonical" href="${citedUrl}">`,
      citedUrl,
      ampUrl,
      "https://gulfnews.com/business/property/unrelated-redirect-1.500000003",
    ),
    false,
    "an unrelated same-domain final redirect must fail before canonical evidence is considered",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      "<html><body>Publisher article without optional identity metadata</body></html>",
      citedUrl,
      citedUrl,
      citedUrl,
    ),
    true,
    "the originally cited URL keeps direct-fetch behavior without synthetic-proof requirements",
  );
  assert.equal(
    publisherRepresentationMatchesCitation(
      "<html><body>Unrelated publisher article</body></html>",
      wamArticleUrl,
      wamArticleUrl,
      "https://www.wam.ae/en/article/different1-unrelated-article",
    ),
    false,
    "a direct WAM citation redirected to a different same-domain article must fail closed",
  );

  const largePublisherPage = [
    '<script type="application/javascript">',
    "x".repeat(600_000),
    "</script>",
    '<meta property="article:published_time" content="2026-09-04T12:24:00+04:00">',
    "<article><p>",
    "A directly published real-estate report with enough readable detail to qualify as fetched evidence. ".repeat(4),
    "</p></article>",
  ].join("");
  assert.deepEqual(extractPublicationDate(largePublisherPage), {
    publishedAt: "2026-09-04T08:24:00.000Z",
    source: "meta",
  });

  const calendarMarkedVisibleDate = `
    <div class="news-detail-section">
      <h6>Official market announcement</h6>
      <small><i class="far fa-calendar-alt me-1"></i>03 September 2026</small>
      <p>A directly published statement with sufficient article detail.</p>
    </div>`;
  const dldInitialRegistrationUrl =
    "https://dubailand.gov.ae/en/news-media/dubai-land-department-launches-initial-registration-a-smarter-journey-for-developers-and-greater-efficiency-for-the-real-estate-sector/";
  assert.deepEqual(
    extractPublicationDate(
      calendarMarkedVisibleDate,
      dldInitialRegistrationUrl,
    ),
    {
    publishedAt: "2026-09-03T00:00:00.000Z",
    source: "visible",
    },
  );
  assert.deepEqual(
    extractPublicationDate(calendarMarkedVisibleDate),
    { publishedAt: null, source: null },
    "calendar-marked visible dates are not accepted without an exact opt-in URL",
  );
  assert.deepEqual(
    extractPublicationDate(
      calendarMarkedVisibleDate,
      "https://dubailand.gov.ae/en/events/initial-registration/",
    ),
    { publishedAt: null, source: null },
    "event and other unscoped DLD paths must not inherit the article opt-in",
  );
  assert.deepEqual(
    extractPublicationDate(
      '<small><i class="fa-calendar-alt"></i>Updated 03 September 2026</small>',
      dldInitialRegistrationUrl,
    ),
    { publishedAt: null, source: null },
    "an updated label must not be reclassified as a publication date",
  );
  assert.deepEqual(
    extractPublicationDate(
      "<small>03 September 2026</small>",
      dldInitialRegistrationUrl,
    ),
    { publishedAt: null, source: null },
    "an unmarked visible date must remain unknown",
  );
  assert.deepEqual(
    extractPublicationDate(
      '<small><i class="fa-calendar"></i>03 September 2026</small>' +
        '<small><i class="fa-calendar-alt"></i>04 September 2026</small>',
      dldInitialRegistrationUrl,
    ),
    { publishedAt: null, source: null },
    "conflicting calendar-marked dates must fail closed",
  );
  assert.deepEqual(
    extractPublicationDate(
      '<small><i class="fa-calendar-alt"></i>31 February 2026</small>',
      dldInitialRegistrationUrl,
    ),
    { publishedAt: null, source: null },
    "an impossible calendar-marked date must fail closed",
  );
  assert.match(
    extractMainText(largePublisherPage),
    /directly published real-estate report/,
    "large but bounded publisher HTML must still yield readable evidence text",
  );

  const splitPublisherBody = [
    "<article><p>A sufficiently long headline and byline block that should not hide the actual article copy.</p></article>",
    '<div class="entry-content"><p>The first directly reported paragraph contains the central verified fact and enough explanatory detail for evidence.</p></div>',
    '<div class="entry-content"><p>The second directly reported paragraph adds corroborating context while remaining inside the publisher page.</p></div>',
  ].join("");
  assert.match(
    extractMainText(splitPublisherBody),
    /first directly reported paragraph.*second directly reported paragraph/,
    "split publisher body containers must outrank a short article-header container",
  );

  console.log(
    "WebFetch publication-date regression passed: explicit dates are retained, unknown dates fail closed, and bounded publisher representations preserve article evidence.",
  );
}

main();
