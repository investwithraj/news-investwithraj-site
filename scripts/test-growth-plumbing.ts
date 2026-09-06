import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { NextRequest } from "next/server";

import {
  POST as distributePost,
} from "@/app/api/distribute/route";
import {
  POST as indexNowPost,
} from "@/app/api/indexnow/route";
import {
  POST as postPublishPost,
} from "@/app/api/post-publish/route";
import { GET as newsSitemapGet } from "@/app/news-sitemap.xml/route";
import { GET as rssGet } from "@/app/rss.xml/route";
import sitemap from "@/app/sitemap";
import { newsroomAnalyticsConfig } from "@/lib/analytics-config";
import { hasExplicitConsent } from "@/lib/consent/state";
import {
  CONSENT_VERSION,
  PIXELS,
  defaultConsentSelection,
  rejectAllConsentSelection,
} from "@/lib/consent/types";
import {
  channelConfiguration,
  socialDistributionEnabled,
} from "@/lib/distribute/config";
import { distributionPayloadDigest } from "@/lib/distribute/receipt-ledger";
import { getIndexablePublicNewsArticles } from "@/lib/news-discovery";
import { NEWSROOM_LIFECYCLE_CUTOVER_ENV } from "@/lib/news-lifecycle";
import { newsArticleMetadata } from "@/lib/news-metadata";
import { orchestratePostPublish } from "@/lib/post-publish/orchestrator";
import { ga4Snippet } from "@/lib/pixels/snippets";
import { newsArticleSchema } from "@/lib/schema/article";
import {
  INDEXNOW_ALLOWED_HOSTS,
  normalizeIndexNowUrls,
  submitToIndexNow,
} from "@/lib/search/indexnow";
import { urlsDigest } from "@/lib/search/indexnow-ledger";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const mutableEnv = process.env as Record<string, string | undefined>;

function articleSlugsFromSitemap(): string[] {
  return sitemap()
    .map((entry) => new URL(entry.url).pathname)
    .filter((path) => path.startsWith("/news/"))
    .map((path) => path.slice("/news/".length));
}

function xmlValues(xml: string, tag: string): string[] {
  const expression = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "g");
  return [...xml.matchAll(expression)].map((match) => match[1]);
}

function jsonRequest(
  path: string,
  secret: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`https://news.investwithraj.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-post-publish-secret": secret,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  const config = newsroomAnalyticsConfig({
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-CANON1234",
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-LEGACY1234",
    NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
    NEXT_PUBLIC_LINKEDIN_PARTNER_ID: "1234567",
    NEXT_PUBLIC_LINKEDIN_INSIGHT_ID: "7654321",
    NEXT_PUBLIC_POSTHOG_KEY: "phc_1234567890abcdef",
    NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com/path-is-normalized",
  });
  assert.equal(config.ids.ga4, "G-CANON1234");
  assert.equal(config.ids.linkedin, "1234567");
  assert.equal(config.ids.meta, "123456789012345");
  assert.deepEqual(config.posthog, {
    apiKey: "phc_1234567890abcdef",
    apiHost: "https://us.i.posthog.com",
  });
  assert.deepEqual(config.crossDomainHosts, [
    "investwithraj.com",
    "news.investwithraj.com",
  ]);

  const aliases = newsroomAnalyticsConfig({
    NEXT_PUBLIC_GA_MEASUREMENT_ID: "invalid",
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-LEGACY1234",
    NEXT_PUBLIC_LINKEDIN_INSIGHT_ID: "7654321",
  });
  assert.equal(aliases.ids.ga4, "G-LEGACY1234");
  assert.equal(aliases.ids.linkedin, "7654321");
  assert.equal(newsroomAnalyticsConfig({}).ids.ga4, undefined);
  assert.equal(
    newsroomAnalyticsConfig({
      NEXT_PUBLIC_POSTHOG_KEY: "phc_1234567890abcdef",
      NEXT_PUBLIC_POSTHOG_HOST: "http://us.i.posthog.com",
    }).posthog,
    undefined,
  );

  const snippet = ga4Snippet("G-TEST12345", config.crossDomainHosts);
  assert.match(snippet, /send_page_view: false/);
  assert.match(snippet, /accept_incoming: true/);
  assert.match(snippet, /investwithraj\.com/);
  assert.match(snippet, /news\.investwithraj\.com/);

  const consentRoot = read("components/consent/ConsentRoot.tsx");
  const pixelLoader = read("components/consent/PixelLoader.tsx");
  const consentBanner = read("components/consent/ConsentBanner.tsx");
  const rootLayout = read("app/layout.tsx");
  assert.match(consentRoot, /<Suspense fallback=\{null\}>/);
  assert.match(consentRoot, /enableVercelObservability=\{process\.env\.VERCEL === "1"\}/);
  assert.match(pixelLoader, /useSearchParams/);
  assert.match(pixelLoader, /"event", "page_view"/);
  assert.match(pixelLoader, /hasExplicitConsent\(state, "posthog"\)/);
  assert.match(pixelLoader, /hasExplicitConsent\(state, "plausible"\)/);
  assert.match(
    pixelLoader,
    /hasExplicitConsent\(state, "vercelanalytics"\)/,
  );
  assert.match(
    pixelLoader,
    /hasExplicitConsent\(state, "vercelspeedinsights"\)/,
  );
  assert.match(
    pixelLoader,
    /const \[vercelConsent,[\s\S]+?useState\(\{[\s\S]+?analytics:\s*false,[\s\S]+?speedInsights:\s*false/,
  );
  assert.match(pixelLoader, /vercelConsent\.analytics \? <Analytics \/>/);
  assert.match(
    pixelLoader,
    /vercelConsent\.speedInsights \? <SpeedInsights \/>/,
  );
  assert.match(pixelLoader, /\/capture\//);
  assert.match(pixelLoader, /window\.location\.pathname/);
  assert.match(consentBanner, /rejectAllConsentSelection\(\)/);
  assert.doesNotMatch(consentRoot, /G-[A-Z0-9]{6,}/);
  assert.doesNotMatch(
    rootLayout,
    /@vercel\/(?:analytics|speed-insights)|<Analytics\s*\/>|<SpeedInsights\s*\/>/,
  );

  assert.ok(
    PIXELS.every((provider) => provider.required || provider.default === false),
    "every optional provider, including Plausible, must default off",
  );
  const defaults = defaultConsentSelection();
  const rejected = rejectAllConsentSelection();
  for (const provider of PIXELS) {
    assert.equal(defaults[provider.name], provider.default);
    assert.equal(
      rejected[provider.name],
      provider.required,
      `${provider.name} must be off after Reject All unless it is essential`,
    );
  }
  const noProviderChoices = {
    version: CONSENT_VERSION,
    timestamp: "2026-09-06T00:00:00.000Z",
    consents: rejected,
  };
  assert.equal(hasExplicitConsent(null, "plausible"), false);
  assert.equal(hasExplicitConsent(noProviderChoices, "plausible"), false);
  assert.equal(hasExplicitConsent(null, "vercelanalytics"), false);
  assert.equal(hasExplicitConsent(noProviderChoices, "vercelanalytics"), false);
  assert.equal(hasExplicitConsent(null, "vercelspeedinsights"), false);
  assert.equal(
    hasExplicitConsent(noProviderChoices, "vercelspeedinsights"),
    false,
  );
  assert.equal(
    hasExplicitConsent(
      { ...noProviderChoices, consents: { ...rejected, plausible: true } },
      "plausible",
    ),
    true,
  );
  assert.equal(
    hasExplicitConsent(
      {
        ...noProviderChoices,
        consents: { ...rejected, vercelanalytics: true },
      },
      "vercelanalytics",
    ),
    true,
  );
  assert.equal(
    hasExplicitConsent(
      {
        ...noProviderChoices,
        consents: { ...rejected, vercelspeedinsights: true },
      },
      "vercelspeedinsights",
    ),
    true,
  );

  assert.equal(socialDistributionEnabled({ ENABLE_SOCIAL_DISTRIBUTION: "1" }), true);
  assert.equal(
    socialDistributionEnabled({ ENABLE_SOCIAL_DISTRIBUTION: "true" }),
    false,
  );
  const configuredX = channelConfiguration("x", {
    ENABLE_SOCIAL_DISTRIBUTION: "1",
    POSTIZ_BASE_URL: "https://postiz.example",
    POSTIZ_API_TOKEN: "do-not-return-this-token",
    POSTIZ_X_ID: "do-not-return-this-integration",
  });
  assert.equal(configuredX.active, true);
  assert.equal(configuredX.via, "postiz");
  assert.doesNotMatch(JSON.stringify(configuredX), /do-not-return-this/);
  assert.equal(
    channelConfiguration("x", {
      ENABLE_SOCIAL_DISTRIBUTION: "1",
      POSTIZ_BASE_URL: "https://postiz.example",
      POSTIZ_API_TOKEN: "token",
    }).active,
    false,
  );
  const disabledTelegram = channelConfiguration("telegram", {
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_CHANNEL_ID: "channel",
  });
  assert.equal(disabledTelegram.configured, true);
  assert.equal(disabledTelegram.active, false);

  assert.equal(
    distributionPayloadDigest(["b", "a", "a"], ["x", "telegram", "x"]),
    distributionPayloadDigest(["a", "b"], ["telegram", "x"]),
  );
  assert.notEqual(
    distributionPayloadDigest(["a"], ["x"]),
    distributionPayloadDigest(["a"], ["telegram"]),
  );

  assert.deepEqual(INDEXNOW_ALLOWED_HOSTS, [
    "news.investwithraj.com",
    "investwithraj.com",
  ]);
  const normalized = normalizeIndexNowUrls([
    "https://news.investwithraj.com/news/example?utm_source=test#top",
    "https://investwithraj.com/areas/example?ref=news",
    "https://evil.example/news/example",
    "https://investwithraj.com:444/areas/example",
  ]);
  assert.deepEqual(new Set(normalized.urls), new Set([
    "https://news.investwithraj.com/news/example",
    "https://investwithraj.com/areas/example",
  ]));
  assert.equal(normalized.rejectedCount, 2);
  assert.equal(
    urlsDigest(["https://investwithraj.com/b", "https://investwithraj.com/a"]),
    urlsDigest(["https://investwithraj.com/a", "https://investwithraj.com/b"]),
  );
  assert.deepEqual(await submitToIndexNow([]), {
    ok: true,
    statusCode: 200,
    message: "No URLs to submit",
    submittedUrls: 0,
    receipts: [],
  });

  const previousCutover = mutableEnv[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
  const previousSecret = mutableEnv.POST_PUBLISH_SECRET;
  const previousIndexNow = mutableEnv.ENABLE_INDEXNOW_SUBMISSION;
  const previousDistribution = mutableEnv.ENABLE_SOCIAL_DISTRIBUTION;
  const secret = "s".repeat(32);

  try {
    mutableEnv[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = "1";
    const indexable = getIndexablePublicNewsArticles();
    assert.ok(indexable.length > 0);
    assert.equal(new Set(indexable.map((article) => article.slug)).size, indexable.length);
    assert.deepEqual(
      new Set(articleSlugsFromSitemap()),
      new Set(indexable.map((article) => article.slug)),
      "Every indexable article, and no noindex article, must be in sitemap.xml.",
    );

    for (const article of indexable) {
      const metadata = newsArticleMetadata(article);
      assert.equal(
        (metadata.robots as { index?: boolean } | undefined)?.index,
        true,
        `${article.slug} is sitemapped but metadata is noindex.`,
      );
      const openGraph = metadata.openGraph as {
        images?: Array<{ url?: string | URL }>;
      };
      assert.match(String(openGraph.images?.[0]?.url), /\/api\/og\?slug=/);
      assert.deepEqual(
        newsArticleSchema(
          article,
          `https://news.investwithraj.com/api/og?slug=${article.slug}`,
        ).image,
        { "@id": `https://news.investwithraj.com/news/${article.slug}#primaryimage` },
      );
    }

    const noindexSlug =
      "2026-06-22-oman-scraps-sponsor-mandate-for-property-linked-residency-pe";
    const noindexArticle = (
      await import("@/content/news")
    ).getNewsBySlug(noindexSlug);
    assert.ok(noindexArticle);
    const noindexMetadata = newsArticleMetadata(noindexArticle);
    assert.equal(
      (noindexMetadata.robots as { index?: boolean } | undefined)?.index,
      false,
    );
    assert.equal(articleSlugsFromSitemap().includes(noindexSlug), false);

    const rss = await rssGet().text();
    const rssSlugs = xmlValues(rss, "guid").map((value) =>
      new URL(value).pathname.slice("/news/".length),
    );
    assert.deepEqual(
      rssSlugs,
      indexable.slice(0, 30).map((article) => article.slug),
    );
    assert.equal(
      xmlValues(rss, "media:content").length,
      0,
      "media:content values are attributes, not text nodes.",
    );
    assert.equal(
      (rss.match(/<media:content /g) ?? []).length,
      indexable.slice(0, 30).length,
    );
    assert.doesNotMatch(rss, /Invalid Date/);

    const newsSitemap = await newsSitemapGet().text();
    const newsSitemapSlugs = xmlValues(newsSitemap, "loc").map((value) =>
      new URL(value).pathname.slice("/news/".length),
    );
    const indexableSet = new Set(indexable.map((article) => article.slug));
    assert.ok(newsSitemapSlugs.every((slug) => indexableSet.has(slug)));

    delete mutableEnv.ENABLE_INDEXNOW_SUBMISSION;
    delete mutableEnv.ENABLE_SOCIAL_DISTRIBUTION;
    const disabledReceipt = await orchestratePostPublish({
      idempotencyKey: "test-disabled-post-publish",
      callerIdentifier: "test",
      deploymentId: "test-commit",
      urls: [`https://news.investwithraj.com/news/${indexable[0].slug}`],
      articles: [indexable[0]],
      channels: ["x"],
      requestIndexing: true,
      requestDistribution: true,
    });
    assert.equal(disabledReceipt.ok, false);
    assert.equal(disabledReceipt.indexing.status, "disabled");
    assert.equal(disabledReceipt.indexing.attempted, false);
    assert.equal(disabledReceipt.distribution.status, "disabled");
    assert.equal(disabledReceipt.distribution.attempted, false);

    mutableEnv.POST_PUBLISH_SECRET = secret;
    const canonicalArticleUrl =
      `https://news.investwithraj.com/news/${indexable[0].slug}`;
    const postPublishDryRun = await postPublishPost(
      jsonRequest("/api/post-publish", secret, {
        newUrls: [canonicalArticleUrl, "https://investwithraj.com/areas/palm-jebel-ali"],
        deploymentId: "verified-test-deployment",
        confirm: false,
      }),
    );
    assert.equal(postPublishDryRun.status, 200);
    const postPublishPreview = await postPublishDryRun.json();
    assert.equal(postPublishPreview.dryRun, true);
    assert.equal(postPublishPreview.externalMutation, false);
    assert.equal(postPublishPreview.acceptedUrls.length, 2);
    assert.equal(
      postPublishPreview.planned.distribution,
      false,
      "Post-publish must not couple website publication to social fanout.",
    );

    const invalidChannel = await postPublishPost(
      jsonRequest("/api/post-publish", secret, {
        newUrls: [canonicalArticleUrl],
        channels: ["x", "not-a-channel"],
      }),
    );
    assert.equal(invalidChannel.status, 400);

    const foreignHost = await postPublishPost(
      jsonRequest("/api/post-publish", secret, {
        newUrls: ["https://example.com/news/not-owned"],
      }),
    );
    assert.equal(foreignHost.status, 400);

    const indexNowDryRun = await indexNowPost(
      jsonRequest("/api/indexnow", secret, {
        urls: [canonicalArticleUrl, "https://investwithraj.com/areas/palm-jebel-ali"],
        confirm: false,
      }),
    );
    assert.equal(indexNowDryRun.status, 200);
    const indexNowPreview = await indexNowDryRun.json();
    assert.equal(indexNowPreview.submitted, false);
    assert.equal(indexNowPreview.acceptedUrlCount, 2);

    const distributionDryRun = await distributePost(
      jsonRequest("/api/distribute", secret, {
        slugs: [indexable[0].slug],
        channels: ["x"],
        confirm: false,
      }),
    );
    assert.equal(distributionDryRun.status, 200);
    const distributionPreview = await distributionDryRun.json();
    assert.equal(distributionPreview.attempted, false);
    assert.equal(distributionPreview.deliveredCount, 0);

    const disabledConfirmedIndexNow = await indexNowPost(
      jsonRequest(
        "/api/indexnow",
        secret,
        { urls: [canonicalArticleUrl], confirm: true },
        { "idempotency-key": "disabled-indexnow-test" },
      ),
    );
    assert.equal(disabledConfirmedIndexNow.status, 503);
  } finally {
    if (previousCutover === undefined) {
      delete mutableEnv[NEWSROOM_LIFECYCLE_CUTOVER_ENV];
    } else {
      mutableEnv[NEWSROOM_LIFECYCLE_CUTOVER_ENV] = previousCutover;
    }
    if (previousSecret === undefined) delete mutableEnv.POST_PUBLISH_SECRET;
    else mutableEnv.POST_PUBLISH_SECRET = previousSecret;
    if (previousIndexNow === undefined) delete mutableEnv.ENABLE_INDEXNOW_SUBMISSION;
    else mutableEnv.ENABLE_INDEXNOW_SUBMISSION = previousIndexNow;
    if (previousDistribution === undefined) {
      delete mutableEnv.ENABLE_SOCIAL_DISTRIBUTION;
    } else {
      mutableEnv.ENABLE_SOCIAL_DISTRIBUTION = previousDistribution;
    }
  }

  console.log(
    "Growth plumbing PASS: consented measurement, canonical discovery, two-host IndexNow and explicitly gated distribution.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
