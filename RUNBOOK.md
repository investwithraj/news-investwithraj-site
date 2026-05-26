# news.investwithraj.com — Pipeline Runbook

How the daily content firehose actually runs. Living document — updated
when the pipeline evolves.

---

## Overview

The pipeline is a **two-phase** system:

**Phase 1 — Fetch + cluster (pure Node, ~30 sec):**
- Runs `scripts/news-pipeline.ts`
- Fetches all 20 verified sources in parallel (RSS + WebFetch)
- Dedupes by URL + headline similarity
- Clusters by topic/entity, scores by `(UHNW × Source-tier × Freshness × Raj-angle)`
- Writes top-N clusters to `pipeline-runs/YYYY-MM-DD/clusters.json`
- Does NOT touch the article repo

**Phase 2 — Draft + validate + commit (Claude Code session, ~5-10 min):**
- The `schedule` skill invokes a Claude session each morning
- Claude reads `pipeline-runs/YYYY-MM-DD/clusters.json`
- Claude reads `lib/voice/raj-profile.md` (the Voice Profile)
- For each cluster, Claude drafts a 600-1200 word article in Raj's voice
- Each draft is validated by `lib/voice/validator.ts` (8 gates)
- Failed drafts get up to 2× redraft attempts → if still failing, dropped
- Passing articles written to `content/news/YYYY-MM-DD-{slug}.ts`
- Added to `NEWS_ARTICLES` registry in `content/news/index.ts`
- Git commit + push → Vercel auto-deploys (~60-90 sec)
- IndexNow ping (Block 2.4) → Postiz schedule (Block 2.5) → Listmonk queued (Block 2.6)

---

## Manual invocation (for dry-runs + debugging)

### Phase 1 only — see what would get drafted

```bash
cd ~/news-investwithraj
npm run news:fetch
# Output:
#   ━━━ news-investwithraj pipeline · 2026-05-26T06:00:00.000Z ━━━
#   📋 Article cap this run: 10
#   ⏬ Fetching all 20 verified sources in parallel…
#   📰 Fetched 247 entries from 18/20 sources
#   ⚠️  2 source(s) errored:
#       - Mubasher: HTTP 503 from https://english.mubasher.info/rss
#       - Asteco: WebFetch timeout
#   📊 By tier: government=42 national-press=98 institutional-research=18 …
#   🧹 Deduped 247 → 198 entries
#   🧩 Formed 10 top-scored clusters
#   🏆 Top 3 by score:
#      78  Modon launches phase 2 of Hudayriyat Golf Estates...
#           UHNW=60 Tier=100 Fresh=85 Angle=72
#           Sources: Modon · Khaleej Times · Bayut
#      71  RERA Q1 2026 bulletin — Dubai transaction volumes up 24% YoY
#           UHNW=40 Tier=100 Fresh=85 Angle=80
#           Sources: RERA · The National · Gulf News
#      68  Knight Frank Dubai Q1 Residential Insight published
#           UHNW=70 Tier=80 Fresh=85 Angle=64
#           Sources: Knight Frank · Khaleej Times
#   📦 Wrote clusters.json + fetch-log.txt to pipeline-runs/2026-05-26/
```

The cluster artifact is at `pipeline-runs/2026-05-26/clusters.json` —
read it manually to see the structure if you want to inspect.

### Phase 2 only — draft from existing clusters.json

If you have an existing clusters.json (e.g. from a previous fetch run),
the draft phase happens inside a Claude Code session by prompting:

> Read `pipeline-runs/2026-05-26/clusters.json`. For each cluster, draft a
> 600-1200 word news article per the Voice Profile at
> `lib/voice/raj-profile.md`. Validate each draft via `lib/voice/validator.ts`.
> Write passing drafts to `content/news/YYYY-MM-DD-{slug}.ts`. Register in
> `content/news/index.ts`. Commit + push.

The Voice Profile + validator + source-registry are all in-context for
the session, so Claude has everything needed to draft correctly.

---

## Scheduled invocation

Register the daily routine via the `schedule` skill in Claude Code:

```bash
# In any Claude Code session (one-time setup):
/schedule create news-pipeline
  cron: "0 2 * * *"               # 02:00 UTC = 06:00 GST
  cwd: ~/news-investwithraj
  prompt: |
    Run the daily news pipeline:
    1. Execute `npm run news:fetch` to refresh source data.
    2. Read pipeline-runs/$(date +%Y-%m-%d)/clusters.json
    3. For each cluster scoring ≥ 50, draft a 600-1200 word article per
       the Voice Profile at lib/voice/raj-profile.md. Each article must:
       - Cite ≥1 source from lib/sources/registry.ts whitelist
       - Pass all 8 gates in lib/voice/validator.ts
       - Use the NewsArticle schema in content/news/types.ts
    4. Write passing articles to content/news/YYYY-MM-DD-{slug}.ts and
       register them in content/news/index.ts.
    5. Run `npm run build` to verify everything compiles.
    6. Commit with message: "news: {YYYY-MM-DD} daily pipeline — {N} articles"
       and push to main. Vercel will auto-deploy.
    7. After deploy, ping IndexNow (Block 2.4 endpoint), schedule social
       posts via Postiz (Block 2.5), queue Listmonk digest (Block 2.6).
    8. Log the run summary to pipeline-runs/YYYY-MM-DD/run-summary.md.
```

---

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `PIPELINE_CAP` | `10` | Max articles per daily run |
| `PIPELINE_DRY_RUN` | `0` | If `1`, skip the commit + push step |
| `PIPELINE_MIN_SCORE` | `50` | Drop clusters scoring below this |

---

## Anatomy of a clusters.json entry

```jsonc
{
  "id": "modon--hudayriyat",
  "topic": "Modon launches phase 2 of Hudayriyat Golf Estates...",
  "entries": [
    {
      "id": "abc123",
      "title": "Modon launches phase 2 of Hudayriyat Golf Estates",
      "url": "https://www.khaleejtimes.com/real-estate/...",
      "publishedAt": "2026-05-26T03:30:00Z",
      "summary": "Modon Properties has...",
      "source": {
        "name": "Khaleej Times — Real Estate",
        "tier": "national-press",
        "domain": "khaleejtimes.com"
      }
    },
    // ... more sources covering the same topic
  ],
  "score": 78,
  "scoreBreakdown": {
    "uhnwRelevance": 60,
    "sourceTier": 100,
    "freshness": 85,
    "rajAngle": 72
  },
  "entities": {
    "developers": ["Modon"],
    "places": ["Hudayriyat"],
    "figures": ["AED 4.25M", "AED 35.5M"],
    "hasTier1Source": true
  },
  "suggestedCategory": "launch",
  "suggestedMarkets": ["Abu Dhabi"]
}
```

---

## Failure modes + recovery

| Mode | Recovery |
|---|---|
| Source fetch timeout | Logged, other 19 sources continue. Source flagged for retry next run. |
| Source returns HTML wrong | Logged + dropped. Next-day cron retries. Persistent failures → manual review. |
| Cluster scores all < min_score | Skip drafting for the day — no articles published. Logged. |
| Drafter fails 8-gate validation 2× in a row | Cluster dropped to manual review queue at `pipeline-runs/YYYY-MM-DD/manual-review/`. |
| Build fails after commit | Auto-revert last commit, alert via Slack/email (Block 2.7). |
| Vercel deploy fails | Vercel reverts to previous good deploy. Pipeline logs the error. |
| Postiz schedule fails | Articles still publish, social distribution delayed. Manual re-trigger. |
| Listmonk send fails | Articles still publish, daily digest retries next morning. |

---

## When to manually override

- **Major regulatory news** (DLD rule change, Golden Visa expansion, RERA penalty against major developer) → manually draft + commit ahead of next cron tick. Don't wait.
- **Modon / Nakheel / Emaar major launch** → manually draft within 4 hours of the announcement. Cron will pick it up the next day but speed-to-publish matters for SEO + AI-citation pool eligibility.
- **Slow news day** → cron may produce 0-2 articles. That's fine. Don't lower the score threshold to force volume — the voice quality matters more than publishing daily-cap.

---

## Observability

After each run, three artifacts exist:
- `pipeline-runs/YYYY-MM-DD/clusters.json` — input to Phase 2
- `pipeline-runs/YYYY-MM-DD/fetch-log.txt` — Phase 1 summary
- `pipeline-runs/YYYY-MM-DD/run-summary.md` — Phase 2 outcome (written by Claude)

The `pipeline-runs/` directory is git-ignored — it's local observability only.
A weekly review should look at the last 7 `run-summary.md` files to spot
voice drift, source failures, or score-threshold misconfiguration.

---

## Search-engine pings (Block 2.4 — SHIPPED)

After every commit that adds new articles, the schedule-skill Claude
session calls `POST /api/post-publish` to fan out search-engine pings.

### The webhook

`POST https://news.investwithraj.com/api/post-publish?secret=<POST_PUBLISH_SECRET>`

```json
{
  "newUrls": [
    "https://news.investwithraj.com/news/2026-05-26-modon-hudayriyat-phase-2",
    "https://news.investwithraj.com/news/2026-05-26-rera-q1-bulletin"
  ],
  "deploymentId": "dpl_xyz"
}
```

Fans out (in parallel, ~3 sec total):
- **IndexNow** → Bing + Yandex + Yep (DuckDuckGo + Brave) + Seznam + Naver + IndexNow.org
- **Google sitemap ping** → https://www.google.com/ping?sitemap=https://news.investwithraj.com/sitemap.xml + same for news-sitemap
- **Bing sitemap ping** → https://www.bing.com/ping?sitemap=... (redundant with IndexNow but primes crawler for full sitemap)

Returns structured per-engine result. 200 if all OK, 207 if any partial failure.

### One-time setup

Two env vars on Vercel project (Settings → Environment Variables):

1. `INDEXNOW_KEY` = `0d6e3835646ccbe5dba5ed6ab2646308`
   - Already hard-coded as default in `lib/search/indexnow.ts` — env var is for rotation
2. `POST_PUBLISH_SECRET` = generate a random 32+ char string
   - Used to authenticate the post-publish endpoint
   - Schedule-skill session needs the same secret to call the endpoint

The IndexNow key file is auto-served at `/{INDEXNOW_KEY}.txt` by the route at
`app/0d6e3835646ccbe5dba5ed6ab2646308.txt/route.ts`. IndexNow servers
fetch this file to verify host ownership before accepting our URL submissions.

### Manual test (smoke)

```bash
# Submit a single URL via the public GET endpoint:
curl "https://news.investwithraj.com/api/indexnow?url=https://news.investwithraj.com/news/some-slug"

# Returns:
# { "ok": true, "statusCode": 200, "message": "Submitted successfully", "submittedUrls": 1 }
```

### Integration with the schedule-skill cron

The Phase 2 prompt in the cron registration already includes:

```
7. After deploy, POST to /api/post-publish with the list of new article URLs.
```

The Claude session calls the endpoint with the URLs it just committed.
Engines see the new articles within ~60 seconds of the push.

---

---

## Block 2.7 — Approval Queue (outreach drafts that need human review)

Distinct from `/api/distribute` (own megaphones, fully automated). The queue
covers third-party communities + media pitches where Raj's eyeball is required
before posting: **Reddit · Quora · HARO/Qwoted/Featured · Stack Exchange ·
BiggerPockets · PropertyHub · Discord investor servers · LinkedIn comments ·
Twitter replies · Telegram groups**.

### Architecture

- `lib/queue/types.ts` — QueueItem + 12 channels + per-channel SLA policy
- `lib/queue/storage.ts` — Auto-switches between **Vercel KV** (prod, if `KV_REST_API_URL` set) and **file-system** (`pipeline-runs/queue.json`, dev only — Vercel ephemeral)
- `lib/queue/draft-generators.ts` — Per-channel draft builders (Reddit 1-in-10 rule, Quora TL;DR + final-paragraph link, HARO quote-first ≤200w, SE no-promo-in-body, etc.)
- `lib/queue/expiry.ts` — Auto-expire stale items per channel SLA (Reddit 24h · Quora 72h · HARO 24h · Twitter reply 12h · others 48h)
- `app/internal/dashboard/page.tsx` — Server component, basic-auth gated via `middleware.ts`
- `app/internal/dashboard/DashboardClient.tsx` — Interactive cards with APPROVE / Copy / Mark posted / Edit / Postpone / Skip / Delete

### One-time setup

Two env vars on Vercel project (Settings → Environment Variables):

1. `INTERNAL_BASIC_AUTH` = `user:pass` (any user/password you want)
   - Middleware gates `/internal/*` with HTTP Basic — browser will prompt
2. `KV_REST_API_URL` + `KV_REST_API_TOKEN` (recommended for prod)
   - Set up via Vercel Storage → KV → Create
   - Without these, queue items live in `pipeline-runs/queue.json` which doesn't persist across cold starts

### Endpoints

```
GET   /internal/dashboard                              — Raj's review UI (basic-auth)
POST  /api/queue/add?secret=...                        — Enqueue drafts (called by schedule-skill)
POST  /api/queue/action/<id>?secret=...                — Approve / skip / edit / postpone / mark-posted / delete
GET   /api/queue/action/<id>                           — Fetch one item (no auth needed for read)
```

### Schedule-skill integration

After the daily commit-and-push completes, the orchestrator should also POST to
`/api/queue/add` with the top 3-5 article slugs of the day. Pipeline generates
drafts for Reddit + Quora + HARO + LinkedIn-comment by default. Raj reviews
within 24h via the dashboard.

```bash
curl -X POST "https://news.investwithraj.com/api/queue/add?secret=$POST_PUBLISH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slugs": ["2026-05-26-modon-phase-2"], "channels": ["reddit", "quora", "haro", "linkedin-comment"]}'
```

### Channel policy quick reference

| Channel | SLA | Self-promo rule |
|---|---|---|
| Reddit | 24h | 1-in-10 (≤10% of posts can be self-promo) |
| Quora | 72h | Link in final paragraph only, ≥300w answer |
| HARO | 24h | Quote-first, ≤200w, journalist deadline often hard |
| Qwoted | 48h | Same as HARO |
| Featured | 72h | Expert-quote DB, 200-300w |
| Stack Exchange | 96h | No promo URL in body, profile-bio link only |
| BiggerPockets | 48h | US-investor framing, educational only |
| PropertyHub | 48h | UK-expat tax angle |
| Discord investor | 48h | Check pinned #rules first |
| LinkedIn comment | 24h | Value-add only, no plug |
| Twitter reply | 12h | Reply within 1hr of original |
| Telegram group | 24h | Data-led, no soft sell |

---

## Block 2.8 — Consent banner + 8-pixel network + IMAP press inbox

### Consent (GDPR + UAE PDPL compliant)

Klaro-inspired two-stage banner. Compact "Accept all / Reject all / Manage"
strip at bottom, expandable per-purpose modal with per-vendor toggles.
Default = strict opt-in (everything off except cookieless Plausible).

- `lib/consent/types.ts` — 8 pixels defined with purpose grouping (analytics / advertising / conversion)
- `lib/consent/state.ts` — localStorage-backed consent state, fires `iwr-consent-changed` events
- `components/consent/ConsentBanner.tsx` — UI banner + ConsentReopenLink footer helper
- `components/consent/PixelLoader.tsx` — listens to consent events, dynamically injects/removes pixel snippets
- `components/consent/ConsentRoot.tsx` — server component, reads env vars, renders both
- `lib/pixels/snippets.ts` — official GA4, Plausible, Meta, LinkedIn, X, TikTok, Google Ads, MS Clarity snippets

Banner is wired into `app/layout.tsx` via `<ConsentRoot />`.

### Pixel env vars (all optional — pixel stays dormant if not set)

```bash
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=news.investwithraj.com
NEXT_PUBLIC_MS_CLARITY_ID=xxxxxxxxxx
NEXT_PUBLIC_META_PIXEL_ID=000000000000000
NEXT_PUBLIC_LINKEDIN_INSIGHT_ID=0000000
NEXT_PUBLIC_X_PIXEL_ID=xxxxxxxxxx
NEXT_PUBLIC_TIKTOK_PIXEL_ID=XXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXXX
```

### IMAP press inbox

Daily poller — pulls unread emails from `raj@news.investwithraj.com`,
classifies sender (developer-tier-1, advisor-tier-1, government, trade-pub,
agency, noise), extracts tags + links + attachments, drops structured drafts
into `content/press-inbound/<slug>.json` for review.

Pure-Node IMAP4 client over TLS — no heavyweight dependency. ~200 LOC.

- `lib/press-inbox/types.ts` — PressEmail + PressDraft + sender-domain tier lookup
- `lib/press-inbox/imap-client.ts` — IMAP4 over `node:tls`, LOGIN / SELECT / SEARCH UNSEEN / FETCH / STORE +FLAGS \Seen
- `lib/press-inbox/draft-builder.ts` — subject cleanup, dek extraction, relevance scoring (0-1 by tier + tags + body length + links + attachments)
- `lib/press-inbox/storage.ts` — file-system at `content/press-inbound/`
- `app/api/press-inbox/route.ts` — POST endpoint, GET listing

### IMAP env vars

```bash
IMAP_HOST=imap.gmail.com           # or your mail provider
IMAP_PORT=993
IMAP_USERNAME=raj@news.investwithraj.com
IMAP_PASSWORD=<app-password>       # NOT regular password
IMAP_MAILBOX=INBOX
```

### Endpoint

```bash
# Manual poll
curl -X POST "https://news.investwithraj.com/api/press-inbox?secret=$POST_PUBLISH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"markSeen": true, "minScore": 0.3}'

# Health check + draft listing
curl https://news.investwithraj.com/api/press-inbox
```

### Schedule-skill integration

Add to the daily cron prompt after the existing distribute step:

```
8. POST to /api/press-inbox to ingest any new PR firm emails.
   Drop drafts into content/press-inbound/ — review next day.
```

---

## Roadmap

- ✅ Block 2.4 — IndexNow + Google sitemap ping + post-publish webhook
- ✅ Block 2.5 — Postiz MCP wrapper, schedule 14-channel social posts per article
- ✅ Block 2.6 — Listmonk daily digest builder
- ✅ Block 2.7 — Approval Queue dashboard at `/internal/dashboard` (Reddit + Quora + HARO drafts)
- ✅ Block 2.8 — Klaro consent + 8-pixel network + IMAP press parser

**Block 2 complete. Site is Day-1 production-ready.**
