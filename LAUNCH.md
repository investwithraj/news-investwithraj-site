# Launch checklist — news.investwithraj.com

This is the release gate for the news property. It describes the source
contract as of 31 July 2026. It is not evidence that a production deployment,
provider connection, legal review, indexing result, or delivery test has
already succeeded.

## 1. Non-negotiable publication contract

- The pipeline may research and stage drafts. It does not publish them.
- A publish action requires Raj's signed internal review session.
- The server credential can stage content, but it cannot publish an article.
- `AUTO_APPROVE` is off unless its value is exactly `1`. Even when enabled it
  performs an evidence assessment only and does not publish.
- Every cited URL must be represented in the draft's verified-source record
  before publication.
- Automated evidence assessment requires at least two distinct allowlisted
  citation URLs with independently fetched source text.
- Model-provided quotations or summaries are not accepted as fetched evidence.
- Editorial images must be real, licensed or first-party, source-attributed,
  and explicitly verified. Unverified media is omitted.
- Synthetic editorial covers and daily-intro video are disabled in production.
- The sentiment endpoint reports that research data is unavailable; it does
  not emit a mock market pulse.

## 2. Required server configuration

Create separate random values of at least 32 bytes:

```text
POST_PUBLISH_SECRET=<server-to-server staging credential>
INTERNAL_SESSION_SECRET=<signed review-session credential>
CRON_SECRET=<Vercel cron bearer credential, if the fallback cron is used>
```

Never put a credential in a URL. Server operations use:

```text
x-post-publish-secret: <POST_PUBLISH_SECRET>
```

The cron fallback may instead use:

```text
Authorization: Bearer <CRON_SECRET>
```

The application rejects credential-like URL parameters. Mutation responses
are private, non-cacheable, and excluded from indexing.

## 3. Durable storage before production

Configure the Upstash-compatible KV variables used by the repository:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

Production drafting must not use the file-system fallback. The fallback cron
returns an unavailable response when durable draft storage is absent.

The press-inbox operation is intentionally unavailable in production until
its file-system storage is replaced with a durable, idempotent store.

## 4. Feature gates

All external or expensive mutations are off by default.

```text
ENABLE_NEWS_DRAFT_CRON=1
ENABLE_DAILY_ANCHOR_PIPELINE=1
ENABLE_EDITORIAL_MEDIA_DISCOVERY=1
ENABLE_INDEXNOW_SUBMISSION=1
```

Enable only the operation being reviewed. Do not set synthetic-media or
diagnostic-generation flags in production: the source contract blocks those
paths regardless.

`/api/digest`, `/api/distribute`, and `/api/post-publish` are preview or
dry-run operations. They do not send email, post to social channels, or submit
search-engine requests.

## 5. Review and publication test

1. Run the local build and Batch 10 audits.
2. Start a clean production-mode preview.
3. Open `/internal/review` and complete the protected sign-in flow.
4. Confirm that a staged draft shows its citations, fetched evidence, media
   provenance, validator result, and hold reasons.
5. Confirm that a server-header request can stage a draft but receives a
   forbidden response from the publish endpoint.
6. Confirm that a signed same-origin review session can publish only after all
   hard gates pass.
7. Confirm that the resulting article uses a canonical news URL and appears in
   the generic sitemap and RSS feed.
8. Record the deployed commit and deployment URL. A local pass is not
   production proof.

## 6. Search discovery

The public discovery surfaces are:

- `/sitemap.xml` — reviewed, indexable public routes.
- `/news-sitemap.xml` — at most 1,000 reviewed articles from the last 48 hours.
- `/rss.xml` — the latest reviewed live news stories.
- `/robots.txt` — advertises both sitemaps and excludes internal/API routes.

Google News eligibility is automatic for policy-compliant sites. There is no
manual Publisher Center inclusion step in this runbook. Use Google Search
Console to submit and monitor the sitemaps.

The retired Google and Bing public sitemap-ping endpoints are not used.
IndexNow is a separate, explicit operation:

- `GET /api/indexnow` is status-only.
- `POST /api/indexnow` requires server authentication.
- The request is a dry run unless `"confirm": true`.
- Confirmed submission also requires `ENABLE_INDEXNOW_SUBMISSION=1` and a
  unique `Idempotency-Key` header.
- Only canonical URLs owned by `news.investwithraj.com` are accepted.

## 7. Read-only smoke checks

Run these against the exact deployment under review:

```bash
curl -i https://news.investwithraj.com/robots.txt
curl -i https://news.investwithraj.com/sitemap.xml
curl -i https://news.investwithraj.com/news-sitemap.xml
curl -i https://news.investwithraj.com/rss.xml
curl -i https://news.investwithraj.com/api/front
curl -i https://news.investwithraj.com/api/indexnow
curl -i https://news.investwithraj.com/api/post-publish
```

Expected facts:

- `/api/front` allows only `https://investwithraj.com`, reports freshness, and
  returns `cover: null` for media that is not verified.
- RSS uses canonical article URLs and includes media only when verified.
- An empty News sitemap is valid when nothing was published in the last
  48 hours.
- Status endpoints do not trigger external work.

## 8. Release evidence

Do not describe the site as live, compliant, indexed, connected, or
production-ready without recorded evidence for that exact deployment:

- build and audit logs;
- desktop, tablet, mobile, and reduced-motion checks;
- canonical, sitemap, RSS, and structured-data validation;
- authenticated staging and human-publication test;
- real-media provenance review;
- Google Search Console and Bing Webmaster verification where applicable;
- analytics/consent testing and a separate legal review.

Contact and correction address: `office@investwithraj.com`.
