import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ABU_DHABI_MEDIA_OFFICE_SOURCE,
  FETCH_SOURCES,
  OFFICIAL_DIRECT_FEEDS,
  SOURCE_WHITELIST,
  findSourceByUrl,
} from "../lib/sources/registry.js";
import { checkOfficialSourceHealth } from "../lib/sources/fetchers/health.js";
import { parseRssDocument } from "../lib/sources/fetchers/rss.js";
import {
  extractMainText,
  extractPublicationDate,
  publisherRepresentationMatchesCitation,
} from "../lib/sources/extract.js";

const ARTICLE_URL =
  "https://www.mediaoffice.abudhabi/en/economy/adgm-reinforces-abu-dhabis-position-as-global-financial-hub/";
const fixture = (name: string) =>
  new URL(`./fixtures/abu-dhabi-media-office/${name}`, import.meta.url);

function deterministicClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

async function main(): Promise<void> {
  const rss = await readFile(fixture("latest-news.xml"), "utf8");
  const detail = await readFile(fixture("adgm-h1-detail.html"), "utf8");

  assert.equal(ABU_DHABI_MEDIA_OFFICE_SOURCE.fetchType, "rss");
  assert.equal(
    ABU_DHABI_MEDIA_OFFICE_SOURCE.rssUrl,
    "https://www.mediaoffice.abudhabi/en/latest-news/rss/",
  );
  assert.equal(ABU_DHABI_MEDIA_OFFICE_SOURCE.tier, "government");
  assert.ok(SOURCE_WHITELIST.includes(ABU_DHABI_MEDIA_OFFICE_SOURCE));
  assert.ok(OFFICIAL_DIRECT_FEEDS.includes(ABU_DHABI_MEDIA_OFFICE_SOURCE));
  assert.ok(FETCH_SOURCES.includes(ABU_DHABI_MEDIA_OFFICE_SOURCE));
  assert.equal(findSourceByUrl(ARTICLE_URL), ABU_DHABI_MEDIA_OFFICE_SOURCE);

  const entries = parseRssDocument(rss, ABU_DHABI_MEDIA_OFFICE_SOURCE);
  assert.equal(
    entries.length,
    1,
    "only dated, same-publisher feed items may enter the pipeline",
  );
  assert.deepEqual(entries[0], {
    id: ARTICLE_URL,
    title: "ADGM reinforces Abu Dhabi’s position as global financial hub",
    url: ARTICLE_URL,
    publishedAt: "2026-09-07T20:00:00.000Z",
    summary:
      "ADGM, the international financial centre of Abu Dhabi, delivered strong growth in the first half of 2026, with assets under management (AUM) rising 54 per cent year on year and its workforce reaching 49,027 professionals.",
    source: {
      name: "Abu Dhabi Media Office",
      tier: "government",
      domain: "mediaoffice.abudhabi",
    },
    categories: undefined,
  });

  const detailDate = extractPublicationDate(detail, ARTICLE_URL);
  assert.deepEqual(detailDate, {
    publishedAt: "2026-09-08T05:57:34.357Z",
    source: "json-ld",
  });
  assert.match(extractMainText(detail), /assets under management rising 54 per cent/);
  assert.match(extractMainText(detail), /number of funds managed from ADGM rose to 276/);
  assert.equal(
    publisherRepresentationMatchesCitation(
      detail,
      ARTICLE_URL,
      ARTICLE_URL,
      ARTICLE_URL,
    ),
    true,
    "the detail page must bind its content to the feed's canonical URL",
  );

  const [healthy] = await checkOfficialSourceHealth(
    [ABU_DHABI_MEDIA_OFFICE_SOURCE],
    {
      fetchBytesImpl: async (input, options) => {
        assert.equal(String(input), ABU_DHABI_MEDIA_OFFICE_SOURCE.rssUrl);
        assert.deepEqual(options.allowedDomains, ["www.mediaoffice.abudhabi"]);
        return {
          bytes: Buffer.from(rss),
          finalUrl: ABU_DHABI_MEDIA_OFFICE_SOURCE.rssUrl!,
          contentType: "application/rss+xml;charset=UTF-8",
        };
      },
      clock: deterministicClock(1_000, 1_025),
    },
  );
  assert.deepEqual(healthy, {
    name: "Abu Dhabi Media Office",
    target: "https://www.mediaoffice.abudhabi/en/latest-news/rss/",
    ok: true,
    transportOk: true,
    discoveryOk: true,
    discoveryState: "dated-entries",
    status: 200,
    latencyMs: 25,
    entryCount: 1,
    newestPublishedAt: "2026-09-07T20:00:00.000Z",
  });

  const undatedRss = rss.replace(
    /<pubDate>Tue, 8 Sep 2026 00:00:00 \+0400<\/pubDate>/g,
    "",
  );
  const [undated] = await checkOfficialSourceHealth(
    [ABU_DHABI_MEDIA_OFFICE_SOURCE],
    {
      fetchBytesImpl: async () => ({
        bytes: Buffer.from(undatedRss),
        finalUrl: ABU_DHABI_MEDIA_OFFICE_SOURCE.rssUrl!,
        contentType: "application/rss+xml",
      }),
      clock: deterministicClock(2_000, 2_010),
    },
  );
  assert.equal(undated.ok, false);
  assert.equal(undated.transportOk, true);
  assert.equal(undated.discoveryOk, false);
  assert.equal(undated.discoveryState, "review");
  assert.equal(undated.status, 200);
  assert.equal(undated.entryCount, 0);
  assert.match(
    undated.error ?? "",
    /no publisher-hosted entries with an explicit publication date/,
  );

  console.log(
    "Abu Dhabi Media Office source regression passed: official feed discovery, dated canonical ingestion, detail evidence and source health are deterministic.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
