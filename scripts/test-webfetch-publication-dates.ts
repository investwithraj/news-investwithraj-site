import assert from "node:assert/strict";

import {
  extractCandidateLinks,
  extractCandidatePublicationDate,
} from "../lib/sources/fetchers/webfetch.js";
import {
  extractMainText,
  extractPublicationDate,
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
