# News pipeline runbook

This runbook covers research, staging, human review, publication, feeds, and
optional search submission for `news.investwithraj.com`.

## Operating model

```text
configured discovery sources
  → deduplicate and cluster
  → research and draft
  → stage in durable storage
  → deterministic evidence assessment
  → bounded auto-publish or Raj reviews held drafts in The Desk
  → sitemap, News sitemap and RSS expose reviewed content
```

Automation publishes at most one evidence-ready article per scheduled run.
The single 03:07 UTC run (07:07 Dubai time) researches and selects the newest
passing story. Additional recovery runs are started manually and remain capped
at one publication each.
Anything that fails a source, figure, validator or integrity gate remains held
in The Desk. Raj can still review and publish held drafts manually.

## Scheduled drafting

`.github/workflows/news-cron.yml` runs `scripts/draft-once.ts` once each morning
at 03:07 UTC (07:07 Dubai time) and can also be started manually.

The runner:

1. Reads the configured source registry.
2. Fetches discovery feeds in parallel.
3. Deduplicates and ranks clusters.
4. Researches a bounded number of candidates.
5. Posts successful drafts to `/api/news/draft` with the server-only header.
6. Publishes at most one passing draft and leaves every failed draft in The Desk.

The workflow explicitly sets `AUTO_APPROVE` to `1` and
`AUTO_PUBLISH_LIMIT` to `1`. The kill switch is fail-closed: changing
`AUTO_APPROVE` to any other value stops publication while drafting continues.
`AUTO_PUBLISH_ORDER` is `newest` for both the morning run and manual recovery
runs.

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
checks. The publication endpoint also accepts the server credential used by the
scheduled publisher, but it independently re-runs every hard publication gate.
The server credential cannot bypass evidence policy v4 or publish a held draft.

## Draft acceptance and evidence

A staged draft is not an approved article. Before publication, verify:

- the normal validator has no blocking failures;
- a strictly attributed official fact has its authoritative government,
  regulator, or first-party developer source on the source's canonical domain;
- analysis, comparisons, market-wide claims, forecasts, and recommendations
  have two independent approved canonical publishers;
- cited facts are supported by independently fetched evidence text;
- every citation is represented in `verifiedSources`;
- figures trace to fetched evidence, not model-supplied prose;
- the real editorial image has provenance, attribution, and an approved source;
- title, subtitle, body, metadata, CTA, and canonical slug are accurate;
- Raj's identity and contact details contain no unsupported credentials.

If evidence is absent, withheld, contradictory, unsupported, or fails the
applicable evidence lane, keep the draft on hold.

## Publication

Automated publication is bounded to one draft per run and requires all
deterministic evidence gates. Articles without an approved UHD cover publish
text-only; public surfaces must never substitute unverified media.

For held drafts:

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

## Lifecycle release modes

`NEWSROOM_LIFECYCLE_CUTOVER=1` is the only enabling value. It is evaluated at
build/release time and must remain off while release sign-offs or external
proof are missing.

- Frozen lifecycle counts are baselines, not ceilings: each reviewed daily
  article without an explicit legacy lifecycle row is additive.
- Off: the sitemap is the frozen 79-path authority plus additive published
  article paths; public discovery is the frozen 41-article baseline plus those
  additive publications; lifecycle redirects remain zero.
- On: the sitemap is the frozen 31-path KEEP/IMPROVE projection plus additive
  indexable article paths; public discovery is the frozen 26-article baseline
  plus those additive publications; the 31 exact redirects remain.
- Three redirects remain held until their recorded content/indexation
  conditions are satisfied.
- Six exact removal candidates return 410 Gone when the cutover is on, with
  no redirect, removed-page metadata or cache persistence. They retain their
  current responses while the cutover is off.
- Do not activate those responses until Search Console, backlink/referral,
  analytics and access-log demand checks cover all six URLs. Kuwait and Fendi
  remain medium-confidence removal decisions.

The legacy index-candidate inventory contains 24 records missing a publication
content hash and 7 one-source records. Matrix retention does not certify those
records under evidence policy v4. Keep this debt fail-closed: do not describe
the corpus as fully migrated until each record is repaired, noindexed, or
otherwise resolved by the release owner.

For local release review only, exact `NEWSROOM_EVIDENCE_HOLD_PREVIEW=1`
previews the checked-in 24-record hold when `VERCEL_ENV` is not `production`.
The flag is default off; Production fails closed to existing behavior even if
it is set. Held articles remain readable and self-canonical, become noindex,
emit no NewsArticle, FAQ, image, or article breadcrumb schema, and are removed
from front-page/discovery, RSS, news-sitemap, and sitemap projections. Do not
certify this preview by a fixed total: evidence holds can change near-duplicate
selection and whether a vertical route remains populated. With lifecycle
cutover off, public discovery is the published registry minus the exact 24 held
slugs, and the sitemap's news paths must equal that mode's distinct indexable
projection. With lifecycle cutover on, preview discovery is exactly the
evidence-certified indexable set, while its sitemap contains the five released
static paths plus those certified article paths. Redirect and six-route removal
behavior is unchanged. The preview is non-authorizing and does not resolve the
evidence debt, enable lifecycle cutover, or approve deployment.

## Verification commands

The offline release check must not contact mutation providers:

```bash
npm run certify:newsroom-release
```

The certificate generates deterministic cutover-off and cutover-on route
manifests and checks policy/document agreement. It deliberately excludes live
KV, secrets, GitHub, DNS, cron, build, deployment, indexing, and provider
proof. Run typecheck, the production build, and deployment smoke checks as
separate exact-commit gates when the release environment is available.

Production evidence is separate. Capture the deployment URL, commit SHA,
response headers, feed output, structured-data result, and review-session
publication result for the exact release.

Contact and corrections: `office@investwithraj.com`.
