# News pipeline runbook

This runbook covers research, staging, human review, publication, feeds, and
optional search submission for `news.investwithraj.com`.

## Operating model

```text
configured discovery sources
  → deduplicate and cluster
  → research and draft
  → stage in durable storage
  → evidence assessment
  → Raj reviews in The Desk
  → signed review session publishes
  → sitemap, News sitemap and RSS expose reviewed content
```

Automation stops at staging. No scheduled job or server credential can publish
an article.

## Scheduled drafting

`.github/workflows/news-cron.yml` runs `scripts/draft-once.ts` at 03:07,
09:07, and 15:07 UTC and can also be started manually.

The runner:

1. Reads the configured source registry.
2. Fetches discovery feeds in parallel.
3. Deduplicates and ranks clusters.
4. Researches a bounded number of candidates.
5. Posts successful drafts to `/api/news/draft` with the server-only header.
6. Leaves every draft in The Desk.

The workflow explicitly sets `AUTO_APPROVE` to `0`. If an operator deliberately
sets it to exactly `1`, the script runs a fail-closed evidence assessment only.
It still does not publish.

`POST /api/cron/draft` is a fallback. It requires an authenticated server or
cron request, `ENABLE_NEWS_DRAFT_CRON=1`, a configured drafting provider, and
durable production storage. `GET /api/cron/draft` is status-only.

## Authentication contract

Never transmit a secret in a URL.

Server-to-server request:

```bash
curl -X POST "https://news.investwithraj.com/api/news/draft" \
  -H "content-type: application/json" \
  -H "x-post-publish-secret: $POST_PUBLISH_SECRET" \
  --data-binary @draft.json
```

Cron request:

```bash
curl -X POST "https://news.investwithraj.com/api/cron/draft" \
  -H "authorization: Bearer $CRON_SECRET"
```

Browser mutations use the signed, HttpOnly review-session cookie and same-origin
checks. The publication endpoint accepts that review session only; a valid
server credential is deliberately insufficient.

## Draft acceptance and evidence

A staged draft is not an approved article. Before publication, verify:

- the normal validator has no blocking failures;
- there are at least two distinct allowlisted citation URLs;
- cited facts are supported by independently fetched evidence text;
- every citation is represented in `verifiedSources`;
- figures trace to fetched evidence, not model-supplied prose;
- the real editorial image has provenance, attribution, and an approved source;
- title, subtitle, body, metadata, CTA, and canonical slug are accurate;
- Raj's identity and contact details contain no unsupported credentials.

If evidence is absent, withheld, contradictory, or source-only, keep the draft
on hold.

## Human publication

1. Sign in through `/internal/review`.
2. Inspect the article, citations, fetched evidence, media provenance, and
   validator output.
3. Resolve every hard hold.
4. Publish from the same-origin review interface.
5. Record the commit SHA and deployment result.
6. Confirm the article canonical and appearance in `/sitemap.xml` and
   `/rss.xml`.

The publish route no longer triggers a background search submission. Search
submission is a separate, reviewable operation.

## IndexNow

Read capability without side effects:

```bash
curl "https://news.investwithraj.com/api/indexnow"
```

Review accepted owned URLs without submitting:

```bash
curl -X POST "https://news.investwithraj.com/api/indexnow" \
  -H "content-type: application/json" \
  -H "x-post-publish-secret: $POST_PUBLISH_SECRET" \
  -d '{"urls":["https://news.investwithraj.com/news/example"],"confirm":false}'
```

An actual submission additionally requires:

- `ENABLE_INDEXNOW_SUBMISSION=1`;
- `"confirm": true`;
- a unique `Idempotency-Key` header of 8–128 safe characters.

```bash
curl -X POST "https://news.investwithraj.com/api/indexnow" \
  -H "content-type: application/json" \
  -H "x-post-publish-secret: $POST_PUBLISH_SECRET" \
  -H "Idempotency-Key: indexnow-2026-07-31-example" \
  -d '{"urls":["https://news.investwithraj.com/news/example"],"confirm":true}'
```

Do not run the confirmed form as a smoke test. Mock or intercept it in tests.
Google and Bing public sitemap-ping URLs are retired and are not part of the
pipeline.

## Post-publish, distribution, and digest

- `/api/post-publish` validates owned URLs and returns a dry-run discovery
  plan. It does not call IndexNow or sitemap-ping services.
- `/api/distribute` creates channel-specific previews. It does not post or
  schedule them.
- `/api/digest` creates an email preview. It does not create or send a
  Listmonk campaign.

Each POST requires the server-only header. Each GET is read-only capability
status.

## Press inbox

`/api/press-inbox` is unavailable in production while its storage remains
file-system based. In non-production it requires authentication, bounded input,
and explicit configuration. It does not mark messages seen by default, does not
expose absolute file paths, and marks selected messages only after all retained
drafts are saved.

## Media operations

- `/api/stock-cover` is status-only on GET. Authenticated POST can discover
  real candidates only when `ENABLE_EDITORIAL_MEDIA_DISCOVERY=1`.
- A discovered candidate is not approved editorial media.
- `/api/cover-image` and `/api/daily-intro` cannot generate synthetic
  editorial media in production.
- `/api/veo-test` and `/api/vertex-test` are unavailable in production.
- Diagnostic generation is explicit and non-production only.
- The production site must omit unverified media rather than substitute a fake
  or repeated placeholder.

## Public feeds

### Generic sitemap

`/sitemap.xml` contains reviewed, indexable routes and live content. Internal,
API, research-only, and empty editorial routes stay out.

### Google News sitemap

`/news-sitemap.xml` contains at most 1,000 unique reviewed articles from the
last 48 hours and excludes future publication dates. An empty document is
valid. Google News eligibility is automatic; Publisher Center is not a manual
inclusion gate.

### RSS

`/rss.xml` exposes the latest reviewed live news only. Article links and GUIDs
are canonical. Media RSS is emitted only for verified editorial images and
uses the actual supported MIME type.

### Advisory feed

`/api/front` returns up to six distinct live stories to
`https://investwithraj.com` only. It includes an explicit freshness state and
uses `null` when a cover is not verified.

## Failure handling

| Failure | Required response |
|---|---|
| Source fetch fails | Continue with other sources; record the source error. |
| Only one source or model-only evidence | Hold the draft. |
| Evidence cannot be fetched | Hold for human verification. |
| Durable storage absent in production | Stop drafting; do not use file-system fallback. |
| Publication validation fails | Keep the draft staged and resolve the hold. |
| GitHub publication fails | Keep the draft; do not claim it is live. |
| Deployment fails | Keep the previous deployment and record the failure. |
| IndexNow fails | Release the operation claim for a reviewed retry. |
| Feed validation fails | Stop release until corrected. |

## Verification commands

The Batch 10 checks are local and must not contact mutation providers:

```bash
npm run audit:batch10:news
npm run build
```

Production evidence is separate. Capture the deployment URL, commit SHA,
response headers, feed output, structured-data result, and review-session
publication result for the exact release.

Contact and corrections: `office@investwithraj.com`.
