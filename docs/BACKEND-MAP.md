# Backend map — news.investwithraj.com

Verified source map updated 31 July 2026. This document records repository
behaviour, not proof that a production deployment or third-party service is
connected.

## System boundary

The news property has four distinct layers:

1. Public editorial pages and read-only discovery feeds.
2. A research pipeline that creates staged drafts.
3. A protected human review desk that is the only publication authority.
4. Explicit, independently gated external operations such as IndexNow.

The advisory site consumes the public `/api/front` feed. It does not receive
internal drafts, private diagnostics, mutation credentials, or unverified
media.

## End-to-end content flow

```text
source registry
  → discovery fetch
  → deduplicate and cluster
  → research draft
  → durable draft store
  → validator and evidence assessment
  → signed human review
  → GitHub publication commit
  → deployment
  → sitemap, News sitemap, RSS and advisory feed
```

There is no automatic-publish branch.

## Security contracts

### Server mutations

`lib/security/mutation.ts` provides the shared contract for server-operated
mutations:

- rejects credential-like URL parameters;
- requires a server-only header;
- optionally accepts a cron bearer for the drafting fallback;
- uses timing-safe credential comparison;
- rejects unapproved browser origins;
- reads a bounded JSON body;
- marks responses `no-store` and `noindex`;
- normalises owned URLs to the canonical news origin.

`POST_PUBLISH_SECRET` and `CRON_SECRET` must be at least 32 bytes before their
respective paths are considered configured.

### Review mutations

`lib/news-review/auth.ts` distinguishes:

- `server-secret` — can stage and maintain drafts;
- `review-session` — signed, HttpOnly, same-origin browser session.

Browser mutations require the signed session and CSRF-origin checks. The
publication endpoint additionally requires `review-session`; a valid server
credential is rejected there.

### Idempotency

`lib/operations/idempotency.ts` validates `Idempotency-Key` and supplies a
best-effort process-local duplicate guard. IndexNow uses this guard. Provider
or durable-storage idempotency is still required for future delivery
operations.

### Feature availability

`lib/operations/features.ts` defines explicit opt-in feature checks.

- synthetic editorial media is always unavailable in production;
- diagnostic generation is always unavailable in production;
- other production operations require their named enable flag.

## Publication and evidence

### Staging

`scripts/draft-once.ts` is run by `.github/workflows/news-cron.yml`. It fetches
configured discovery sources, deduplicates and scores clusters, researches
candidates, and posts successful drafts to `/api/news/draft`.

The workflow explicitly sets `AUTO_APPROVE` to `0`.

If `AUTO_APPROVE` is deliberately set to exactly `1`, `runAutoApprove` performs
an assessment only. It does not publish.

### Fail-closed evidence assessment

`lib/news-review/auto-approve.ts` requires:

- at least two distinct allowlisted citation URLs;
- independently fetched evidence text for each counted source;
- a meaningful evidence payload;
- figure traceability against fetched evidence;
- the normal validator to pass.

Model-provided cited prose is not accepted as independent evidence. Missing,
withheld, one-source, or model-only evidence results in a hold.

### Human publication

`POST /api/news/draft/[id]/publish`:

- accepts a signed review session only;
- reloads the staged draft;
- enforces the validator;
- verifies every cited URL is represented in `verifiedSources`;
- writes the reviewed article through the GitHub publication adapter;
- removes the staged draft after the successful commit;
- does not call post-publish, distribution, or search submission in the
  background.

Publication success proves only that the commit operation succeeded. The
deployment must be verified separately.

## Route contracts

### Editorial review

| Route | Read behaviour | Mutation behaviour |
|---|---|---|
| `/api/news/draft` | Authenticated draft list | Authenticated staging only |
| `/api/news/draft/[id]` | — | Authenticated patch/delete; revalidates |
| `/api/news/draft/[id]/publish` | — | Signed human review session only |
| `/api/queue/add` | Authenticated status/listing | Authenticated queue staging |
| `/api/queue/action/[id]` | Authenticated item read | Authenticated reviewed action |

Private review responses are not public content surfaces.

### Search and post-publication

| Route | GET | POST |
|---|---|---|
| `/api/post-publish` | Read-only capability status | Authenticated dry-run URL review; no external call |
| `/api/indexnow` | Read-only capability status | Authenticated dry run by default; confirmed call is separately gated and idempotent |

Confirmed IndexNow requirements:

- `ENABLE_INDEXNOW_SUBMISSION=1`;
- body contains `confirm: true`;
- valid `Idempotency-Key`;
- at least one canonical URL owned by the news origin.

The deprecated Google and Bing public sitemap-ping clients are retained only as
truthful skipped-result shims. They return `ok: false`, `submitted: false`, and
perform no network request.

### Distribution and digest

| Route | Behaviour |
|---|---|
| `/api/distribute` | Builds reviewed channel previews only |
| `/api/digest` | Builds an email preview only |

These routes do not post, schedule, create campaigns, or send email. Their
provider configuration fields are informational only.

### Editorial media and diagnostics

| Route | Contract |
|---|---|
| `/api/stock-cover` | GET status; authenticated POST discovers real candidates only when enabled |
| `/api/cover-image` | Synthetic diagnostic output is unavailable in production and never editorially approved |
| `/api/daily-intro` | Synthetic intro generation is unavailable in production |
| `/api/veo-test` | Status plus explicit non-production diagnostic only |
| `/api/vertex-test` | Status plus explicit non-production diagnostic only |

`/api/stock-cover` calls discovery with `allowSynthetic: false` and a UHD
minimum-width preference. A returned candidate still requires provenance and
human approval; it is not automatically inserted into editorial content.

### Other operational routes

| Route | Contract |
|---|---|
| `/api/cron/draft` | GET status; authenticated, feature-gated POST stages drafts only |
| `/api/anchor` | GET state/status; authenticated POST only when the pipeline is enabled |
| `/api/press-inbox` | GET status; production POST unavailable until durable storage exists |
| `/api/sentiment` | Truthful unavailable/research response; no mock market data |
| `/api/front` | Public read-only cross-property feed with exact advisory CORS |

The production drafting fallback refuses file-system storage. The press inbox
does not expose absolute paths or mark messages seen before retained drafts
have been saved.

## Public discovery surfaces

### Generic sitemap

`app/sitemap.ts` derives URLs from reviewed content registries:

- canonical home, archive, area, developer, about, terminal and privacy routes;
- live news articles;
- area pages only when body and citations exist;
- developer and vertical pages only when reviewed reporting exists;
- editorial formats only when a reviewed edition exists.

Research-only content, empty formats, internal routes, and APIs are omitted.

### Google News sitemap

`app/news-sitemap.xml/route.ts`:

- selects reviewed live articles from the current 48-hour helper;
- excludes future dates;
- removes duplicate slugs;
- emits no more than 1,000 entries;
- uses the canonical publication identity;
- safely escapes XML.

An empty 48-hour sitemap is valid. Google News eligibility is automatic for
eligible sites; the route is not tied to a manual Publisher Center form.

### RSS

`app/rss.xml/route.ts`:

- emits the latest 30 reviewed live news articles only;
- uses canonical article URLs for links and GUIDs;
- omits unverified images;
- emits Media RSS only for a supported, verified image;
- derives the media MIME type from the actual URL extension;
- attributes Raj and uses `office@investwithraj.com`.

### Robots

`app/robots.ts` advertises both sitemaps. General and named crawler rules block
`/internal/` and `/api/`. Low-quality bulk scrapers are blocked.

### Advisory front feed

`app/api/front/route.ts`:

- selects up to six distinct reviewed live articles;
- includes source-count/evidence labelling;
- uses `cover: null` when media is not verified;
- reports `fresh`, `stale`, or `empty` plus age and threshold;
- allows CORS only from `https://investwithraj.com`;
- supports GET and OPTIONS only.

## Structured-data identity

`app/layout.tsx` emits one connected JSON-LD graph:

- `WebSite`;
- `NewsMediaOrganization`;
- `Person` for Raj.

Article and collection schemas reference the shared WebSite identity rather
than constructing disconnected entities. Structured data must not contain
unsupported academic, licensing, affiliation, award, or performance claims.

## Media truth

`lib/news-editorial.ts` is the shared verification boundary for editorial
media and evidence labelling.

- A local filename is not sufficient proof of provenance.
- A generated, placeholder, unknown, or unverified source is not editorial
  media.
- Full-screen visual use requires a genuine UHD source and verification.
- Unverified media is omitted rather than repeated across cards.
- Synthetic images and videos are not production fallbacks.

## Source registry and drafting language

Operational copy uses `FETCH_SOURCES.length`; it does not hard-code a source
count. Discovery sources and citable sources are separate concepts.

Raj is described as a Dubai property advisor or real-estate consultant.
Unsupported licensing, registration, academic, employer, award, or transaction
claims must not appear in prompts, feeds, distribution drafts, or metadata.

## Storage

| Store | Production requirement |
|---|---|
| News drafts | Durable Upstash-compatible KV |
| Outreach queue | Durable KV for reliable persistence |
| Press inbox | Production-disabled until migrated from file system |
| Daily anchor | KV when production persistence is required |
| Published articles | Git repository via reviewed publication commit |

File-system fallbacks are for local development only and must not be presented
as durable production storage.

## Relevant environment names

### Authentication and storage

```text
POST_PUBLISH_SECRET
INTERNAL_SESSION_SECRET
INTERNAL_DASHBOARD_USER
INTERNAL_DASHBOARD_PASSWORD
CRON_SECRET
KV_REST_API_URL
KV_REST_API_TOKEN
```

### Drafting

```text
ANTHROPIC_API_KEY
DRAFT_MODEL
PIPELINE_MIN_SCORE
PIPELINE_CAP
PIPELINE_MAX_ATTEMPTS
AUTO_APPROVE
ENABLE_NEWS_DRAFT_CRON
```

### Explicit operations

```text
ENABLE_INDEXNOW_SUBMISSION
ENABLE_DAILY_ANCHOR_PIPELINE
ENABLE_EDITORIAL_MEDIA_DISCOVERY
```

### Non-production-only diagnostics

```text
ENABLE_DIAGNOSTIC_GENERATION
ALLOW_SYNTHETIC_EDITORIAL_MEDIA
```

Their presence does not override the production deny rules.

## Known constraints

- Process-local idempotency does not replace a durable operation ledger.
- The draft engine does not yet populate complete independently fetched
  evidence for every draft, so automated assessment intentionally holds those
  drafts.
- Press-inbox production ingestion remains disabled pending durable storage.
- Distribution and digest delivery remain disabled pending a separate
  reviewed, idempotent delivery design.
- No repository check proves that Google, Bing, analytics, email, social, AI,
  or media-provider accounts are connected in production.
- No code claim establishes legal compliance; consent and privacy behaviour
  require separate legal and production verification.

## Release gates

The backend can be called release-ready only after the exact candidate commit
passes:

1. Batch 10 static security and truth audit.
2. Typecheck and production build.
3. Unit/integration tests with all external mutations mocked.
4. Signed-session human publication test.
5. Canonical, sitemap, News sitemap, RSS, robots, and JSON-LD validation.
6. Durable-storage failure test.
7. Real-media provenance review.
8. Production deployment verification with recorded URL and commit.

Contact and corrections: `office@investwithraj.com`.
