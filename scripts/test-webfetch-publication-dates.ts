import assert from "node:assert/strict";

import {
  extractCandidateLinks,
  extractCandidatePublicationDate,
} from "../lib/sources/fetchers/webfetch.js";

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

  console.log(
    "WebFetch publication-date regression passed: explicit dates are retained and unknown or ambiguous dates are excluded.",
  );
}

main();
