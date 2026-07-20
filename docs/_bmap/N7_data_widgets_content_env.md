## N7 · Market-Data Widgets, Stock/Cover, Press-Inbox, Queue, Content, Schema & ENV

Repo root: `C:\Users\RAJTO\news-investwithraj` (Next.js 16 App Router). This section maps stock/cover image sourcing, the market-data widgets (DLD pulse, FX, sentiment, daily-anchor store), the press-inbox ingestion chain, the outreach approval queue, consent + pixels, verticals + developers data, JSON-LD schema generators, the content model (news/areas/power-list/closing-bell/insights/daily-anchor), and a complete repo ENV inventory. Routes that *consume* these libs but are owned by the data/AI-API map are cross-referenced to `docs/_bmap/N3_api_data_ai.md`.

---

### Stock image sourcing — `lib/stock/providers.ts`

Multi-provider image aggregator with relevance ranking + emirate/geo gating. No default export; many named exports.

- **Env vars** (`providers.ts:21-23`): `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`. Imagen-4 path env vars (`GCP_*`, `VERTEX_IMAGEN_MODEL`) are referenced indirectly via the lazy import of `@/lib/ai/vertex` (`providers.ts:390`). Comments also name `GEMINI_API_KEY` / `IMAGEN_MODEL` but the live code path uses Vertex, not the Gemini Developer API.
- **External APIs called** (all `fetch`, ISR `revalidate:3600` except Openverse/triggerUnsplashDownload):
  | Fn | Endpoint | Auth | Keyless? |
  |----|----------|------|----------|
  | `searchUnsplash` (`:31`) | `api.unsplash.com/search/photos` | `Authorization: Client-ID <UNSPLASH_KEY>` | no |
  | `searchPexels` (`:83`) | `api.pexels.com/v1/search` | `Authorization: <PEXELS_KEY>` | no |
  | `searchWikimedia` (`:132`) | `commons.wikimedia.org/w/api.php` (2 calls: `list=search` then `prop=imageinfo`, `iiurlwidth:2400`) | none | **yes** |
  | `searchOpenverse` (`:229`) | `api.openverse.org/v1/images/` (`license_type:commercial`) | `User-Agent: InvestWithRajNewsBot/1.0` | **yes** |
  | `searchPixabay` (`:277`) | `pixabay.com/api/` | `key=` query param | no |
  | `triggerUnsplashDownload` (`:331`) | the photo's `download_location` URL | `Client-ID` | no (ToS-compliance fire-and-forget) |
  | `generateImagen` (`:385`) | `@/lib/ai/vertex` `generateImage()` (lazy import) | Workload Identity Federation | n/a |
- **Key exports/functions**:
  - `searchStock(opts)` (`:465`) — aggregator. (1) `tryProviders(query)` runs all keyed+keyless providers in parallel `Promise.all`; (2) if empty, loops `broaderQueries()` fallbacks; (3) last resort `generateImagen()` unless `opts.allowSynthetic === false`. Wikimedia + Openverse always run (keyless).
  - `broaderQueries(originalQuery)` (`:436`) — emirate-aware generic fallback queries (Abu Dhabi / RAK / Dubai branches + asset-type + final `"UAE luxury real estate aerial"`).
  - `findBestStockImage(opts)` (`:591`) — calls `searchStock`, applies `excludeUrls` dedupe set, ranks via `rankStock`, returns single best or `null`.
  - `rankStock(img, tokens, emirate)` (`:552`) — score = providerBonus (wikimedia 300 / openverse 250 / unsplash·pexels·pixabay 400 / **imagen −1000**) + aspectBonus(1.4–2.1 → 200) + resBonus(min(servedWidth,3000)/12) + relevance(title-token match ×180) − junk(800) − offGeo(1200) − lowResPenalty(<1400px → 350) − generic(`Dubai_aerial.jpg` → 600) − emirateMiss(900).
  - `servedWidth(img)` (`:539`) — parses real served px from URL size tokens (rawpixel `editor_NNNN`, Wikimedia `/NNNpx-`, `?w=`/`?width=`); falls back to native `width`.
  - `unsplashAttribution(img)` (`:348`) — markdown "Photo by … on Unsplash" with utm params.
  - `isAnyStockConfigured()` (`:606`) — always `true` (Wikimedia keyless baseline).
  - `buildImagenPrompt(query)` (`:366`) — wraps query in cinematic UAE-RE photography modifiers.
- **Module-level relevance filters** (regex, score in `rankStock`): `JUNK_TITLE` (`:504`), `NON_UAE` (`:509`, wrong-country tells), `OVER_GENERIC` (`:515`), `EMIRATE_TELLS` (`:521`, per-emirate signature regexes for `abu dhabi`/`dubai`/`ras al khaimah`).

### Query builder — `lib/stock/query-builder.ts`

Maps a `NewsArticle` (or area/dev slug) → a 3-5-word stock search string. Imports `NewsArticle` type only.

- **Lookup tables**: `DEVELOPER_QUERIES` (`:7`, 9 devs), `AREA_QUERIES` (`:19`, ~60 area slugs), `CATEGORY_QUERIES` (`:74`, 7 categories), and **`LANDMARK_QUERIES`** (`:88`, ~17 headline-subject keywords: `sheikh zayed road`, `shangri-la`, `burj khalifa`, `difc`, `corniche`, `wynn`, `al marjan`, etc.) — the landmark map is what stops unrelated stories sharing one generic skyline.
- `buildQueryForArticle(article)` (`:110`) — precedence: (1) developer name in title → `DEVELOPER_QUERIES`; (2) area slug/name in title → `AREA_QUERIES`; (3) `LANDMARK_QUERIES` keyword in title; (4) emirate from `article.market[0]` → Abu Dhabi / RAK generic; (5) `CATEGORY_QUERIES[article.category]`; (6) `"Dubai skyline aerial golden hour"`.
- `buildQueryForArea(slug)` (`:151`), `buildQueryForDeveloper(slug)` (`:156`) — table lookup else slug-derived fallback.

### Stock video providers — `lib/stock/video-providers.ts`

Real Dubai/AD/RAK drone B-roll for the Daily Anchor. No AI video. Env: `PEXELS_API_KEY` (`:13`).

- Types: `StockVideo`, `VideoSearchOptions`, `VideoStockSource = "pexels-video"|"coverr"`.
- `searchPexelsVideos(opts)` (`:58`) — `fetch api.pexels.com/videos/search` (`size:medium`, `revalidate:3600`), filters by min/max width & duration, picks best mp4 in 1280–1920px sweet spot, drops <1000px.
- `searchCoverr(opts)` (`:147`) — **stub, returns `[]`** (HTML-parse too brittle; kept for chain shape).
- `searchStockVideo(opts)` (`:160`) — parallel aggregator (Pexels if keyed + Coverr stub).
- `pickByDateSeed(videos, dateStr)` (`:172`) — deterministic date-hash index → same date yields same clip.

### Stock types — `lib/stock/types.ts`

- `StockSource = "unsplash"|"pexels"|"wikimedia"|"openverse"|"pixabay"|"imagen"`.
- `StockImage` (`:11`) — url/thumbnailUrl/attributionUrl/credit/license/width/height/source/alt + Unsplash-only `photographerUrl`/`downloadTriggerUrl`/`sourceId`.
- `StockSearchOptions` (`:37`) — query/orientation/minWidth/perPage/`allowSynthetic`(default true; news heroes pass false)/`excludeUrls`/`emirate`.

### Cover scripts (CLI, `tsx`)

| File | Purpose | Calls | Notes |
|------|---------|-------|-------|
| `scripts/backfill-covers.ts` | Re-source + write missing/404 hero covers for live articles into `public/news/<slug>/cover.<ext>`, patch `heroImage.credit`/`src` in `content/news/<slug>.ts` | `findBestStockImage`, `buildQueryForArticle`, `NEWS_ARTICLES`, `fetch` downloads | Flags `--write`/`--force`. `used` Set forces distinct image per article. `FALLBACK_QUERIES` (`:30`, 8 landmark queries) + `MARKET_FALLBACK` (`:43`, static `Dubai_aerial.jpg`). `coverExists` (`:49`) checks jpg/jpeg/png/webp/avif. `patchCredit` only replaces literal `"To be set at review"`. No `GITHUB_TOKEN` (working-tree writes). |
| `scripts/set-cover.ts` | Manually set ONE article's hero — search query OR `--url`/`--credit` direct | `findBestStockImage`, `fetch` | `<slug> "<query>"` or `<slug> --url <url> [--credit] [--exclude a,b]`. Reads emirate from the article's `"market"` field for geo-gate. `GENERIC_EXCLUDE` blocks `Dubai_aerial.jpg`. Rewrites `heroImage.src`+`credit` via regex (`:94`). |
| `scripts/test-stock.ts` | Smoke-test the wired news image path keyless + `allowSynthetic:false` | `findBestStockImage`, `buildQueryForArticle` | 5 hardcoded sample article shapes; prints source/dims/license. |

### Stock/cover consumer routes (detail in N3)

| Route | Methods | Auth | Feeds |
|-------|---------|------|-------|
| `app/api/stock-cover/route.ts` | GET (`?slug`/`?q`), POST (`?secret`) | POST gated by `POST_PUBLISH_SECRET` (`:20`) | `searchStock`/`findBestStockImage` + `buildQueryForArticle` + `getNewsBySlug`. GET returns results array; POST returns single best image object (URL hostable directly — no download). |
| `app/api/cover-image/route.ts` | POST (`?secret`), GET (self-doc) | `POST_PUBLISH_SECRET` (`:19`) | **AI path** — `@/lib/ai/higgsfield` `generateImage`/`buildArticleCoverPrompt`, NOT lib/stock. 503 when `HIGGSFIELD_API_KEY` unset. |

---

### DLD daily pulse — `lib/dld/pulse.ts`

REAL-data-only ticker source. No random/mock fallback. Env: `DLD_API_URL` (`:44`, default `https://api.dubaipulse.gov.ae`), `DLD_API_KEY` (`:45`, OAuth client_id), `DLD_API_SECRET` (`:46`, client_secret).

- `getDldPulse(_date?)` (`:186`) — public entry; tries live, else `getReferenceDldPulse()`.
- `getReferenceDldPulse()` (`:28`) — cited official DLD weekly print: `REF_VOLUME_AED = 15.2B` (`:25`), `REF_TXNS = 4850` (`:26`), week ending 2026-05-18, `source:"reference"`.
- `fetchLiveDldPulse()` (`:160`) — `getPulseToken()` (OAuth client-credentials POST to `/oauth/client_credential/accesstoken`, `:51`) then `fetch <BASE>/open/dld/dld_transactions-open-api?limit=2000&sort=instance_date desc` (Bearer token, `revalidate:21600`). Returns `null` on any failure → reference fallback.
- `aggregate(rows)` (`:84`) — sums most-recent-day txns, freshness guard (rejects >21d old / future), needs ≥3 rows, computes median PSF (per-sqm ÷10.7639), top area + top project by volume.
- **Consumer route**: `app/api/dld-pulse/route.ts` GET (`?date`), `export const revalidate = 21600` (6h), `Cache-Control s-maxage=21600, swr=86400`. ⚠️ that route's header comment (`route.ts:7`) says "Falls back to deterministic mock" but the actual fallback is the **cited reference print**, never mock — comment is stale.

### DLD types — `lib/dld/types.ts`

- `DldDailyPulse` (`:8`) — date/periodLabel/txnCount/volumeAed/avgPriceAed + optional medianPpsfAed/hottestArea/topDeveloper/dodVolumeChangePct + `source:"live"|"reference"`/sourceNote/fetchedAt.
- `formatAed(amount)` (`:36`) — compact B/M/K notation.

### FX rates — `lib/fx/rates.ts`

AED-base FX for the UHNW currency switcher. **No env var** — uses keyless `api.exchangerate.host`.

- `Currency` (`:7`) = AED/USD/EUR/GBP/INR/SGD/HKD/CHF/JPY. `CURRENCY_META` (`:10`, label/symbol/flag/locale/digits). `FALLBACK_RATES` (`:32`, hardcoded snapshot).
- `fetchFxRates()` (`:54`) — `fetch api.exchangerate.host/latest?base=AED&symbols=…` (`revalidate:3600`); merges live over fallback; `source:"live"|"fallback"`.
- `convertAedTo(amount, target, snapshot)` (`:87`), `formatCurrency(amount, currency, {compact?})` (`:95`, `Intl.NumberFormat`).
- **Consumers**: `app/api/fx/route.ts` GET, `revalidate = 3600` (1h), `s-maxage=3600, swr=21600`; client `components/ticker/FxProvider.tsx`.

### Sentiment — `lib/sentiment/mock.ts` + `lib/sentiment/types.ts`

Deterministic date-seeded mock (no live scrapers yet). Imports `AREAS` (`@/content/areas`) + `DEVELOPERS` (`@/lib/developers`).

- `mock.ts`: `getMockSentimentSnapshot(date?)` (`:53`) — builds `SentimentSignal[]` for top-18 areas + all developers, date-seeded `seed`/`rand` hashes for score/volume/channel/blurb; aggregates `byChannel`. `CHANNEL_BLURBS` (`:23`), `CHANNELS` (`:51`) = reddit/x/telegram/news/linkedin.
- `types.ts`: `SentimentChannel`, `SentimentSignal` (`:5`), `SentimentSnapshot` (`:26`, `source:"live"|"mock"`), `scoreToColor(score)` (`:38`, vivid heatmap fill), `scoreToInk(score)` (`:50`, AA-on-light text color).
- **Consumer page**: `app/pulse/page.tsx` — `export const dynamic = "force-dynamic"`; exports `metadata` (canonical `${SITE.url}/pulse`); renders mock heatmap by area + developer; `SignalCard` links to `/areas/[slug]` or `/developer/[slug]`. **No JSON-LD.** Hero label hardcodes "refreshes every 30m" though data is per-day-seeded mock.

### Daily Anchor store — `lib/anchor/store.ts`

Dual-adapter (Vercel KV / file-system) persistence for the homepage Daily Anchor. Env: `KV_REST_API_URL` (`:18`), `KV_REST_API_TOKEN` (`:19`). KV key `iwr:anchor:current` (`:20`); archive key `iwr:anchor:archive:<date>`. FS path `pipeline-runs/daily-anchor.json` (`:16`).

- `useKv()` (`:22`) — true when both KV vars set (mandatory in prod; Vercel FS read-only).
- KV adapter: `kvReadAnchor`/`kvWriteAnchor`/`kvArchiveAnchor` (`:28`/`:51`/`:68`) — Upstash REST GET `/get/<key>`, POST `/set/<key>` text/plain Bearer.
- FS adapter: `fsReadAnchor`/`fsWriteAnchor` (`:87`/`:97`) — JSON file; archives prior day to `daily-anchor-<date>.json` on date change.
- Public: `readCurrentAnchor()` (`:118`), `writeCurrentAnchor(anchor)` (`:122`, archives prior day before overwrite), `getAnchorStorageBackend()` (`:135`).
- Type `DailyAnchor` from `content/daily-anchor/types.ts` (`:19`): date/headline/sourceSlug/script/audioUrl/videoUrl/videoCredit/videoSource/videoLicense/videoAttributionUrl/`provider`(pexels-video|coverr|veo3|higgsfield|gemini)/`state`(`AnchorState`= pending-script|pending-voice|pending-video|ready|failed)/captionsVtt.
- **Consumer route**: `app/api/anchor/route.ts` — GET returns current anchor (`s-maxage=300, swr=900`, 404 if none); POST (`?secret=POST_PUBLISH_SECRET`, `:56`) runs the pipeline. `runtime="nodejs"`, `maxDuration=300`, `dynamic="force-dynamic"`. Stages (mode full): (1) Claude script via `callClaude` w/ `SCRIPT_SYSTEM` 130-180-word voice-locked prompt (`:58`); (2) ElevenLabs `synthesise` → base64 `data:audio/mpeg` (`:181`); (3) **real stock video** via `searchStockVideo` + `pickByDateSeed` (`buildAnchorVideoQuery` `:35` picks emirate-appropriate drone query). Final `state="ready"` iff audio present. Graceful 503 when Claude/ElevenLabs unconfigured.

---

### Press inbox — `lib/press-inbox/*`

Daily IMAP poller that converts PR-firm emails → review drafts. Approved drafts hand-rewritten into `content/news/<slug>.ts`.

#### `imap-client.ts`
Raw IMAP4-over-TLS (built-in `node:tls`, no library). Env (`:27-31`): `IMAP_HOST`, `IMAP_PORT` (default 993), `IMAP_USERNAME`, `IMAP_PASSWORD` (app password), `IMAP_MAILBOX` (default INBOX).
- `isImapConfigured()` (`:33`) — host+username+password set.
- `fetchUnreadPressEmails()` (`:192`) — connect → `LOGIN` → `SELECT` → `SEARCH UNSEEN` → `FETCH <uid> BODY[]` (capped 50/day) → parse → returns `PressEmail[]`. Does NOT mark seen (pipeline marks after persist). `classifySender`/`extractTags` applied per email.
- `markSeen(uids)` (`:247`) — `STORE <uids> +FLAGS (\Seen)`. Called after drafts persisted.
- Internal: `createSession`/`flushPending`/`sendCmd` (20s timeouts), `parseFetchResponse` (`:106`, MIME multipart boundary parse: text/plain, text/html, attachment metadata), `parseAddressLine`, `extractLinks` (`:180`, plain + `href=` URLs, cap 50).

#### `draft-builder.ts`
- `buildDraft(email)` (`:96`) — cleans subject (`cleanSubject` strips RE:/FW:/PR-/etc.), extracts dek (`extractDek`, first ≤280 chars of sentences), maps links → `{url,source:hostname}` citations, scores via `scoreRelevance`. Returns `PressDraft` (status `"pending"`).
- `scoreRelevance(email)` (`:32`) — 0-1: tier weight (`government 0.35` … `noise 0`), tag bonus (≤6 ×0.05), body-length sanity (+0.1 / −0.1), link count (+0.05), attachments (+0.05). Returns `{score, rationale}`.
- `buildSlug(email)` (`:84`) — `<YYYY-MM-DD>-press-<slugified-subject>`.

#### `storage.ts`
File-system-backed at `content/press-inbound/<slug>.json` (`:11`, git-committed). `saveDraft`/`saveDrafts`/`listDrafts`/`getDraft`/`setDraftStatus`(pending|accepted|rejected)/`deleteDraft`. No KV — drafts live in the repo for review.

#### `types.ts`
- `PressSenderTier` (`:12`) — developer-tier-1 / advisor-tier-1 / advisor-tier-2 / government / trade-pub / industry-event / agency / noise.
- `PressEmail` (`:22`), `PressDraft` (`:51`).
- `SENDER_DOMAIN_TIERS` (`:73`) — ~30 domain→tier map (modon.ae, emaar.com, knightfrank.com, dld.gov.ae, khaleejtimes.com, edelman.com, …).
- `classifySender(email)` (`:114`) — exact domain match then suffix match, default `"noise"`.
- `extractTags(subject, body)` (`:143`) over `TAG_PATTERNS` (`:126`, ~40 regexes: developers/projects/asset-types/indices/macro). Deduped lowercased list.
- **Consumer route**: `app/api/press-inbox/route.ts` — POST (`?secret=POST_PUBLISH_SECRET`, `:24`) `fetchUnreadPressEmails`→`buildDraft`→filter by `minScore`→`saveDrafts`→`markSeen` (only kept UIDs; default markSeen true). 503 if IMAP unconfigured. GET = health/listing.

---

### Outreach Approval Queue — `lib/queue/*`

Human-review drafts for third-party communities (Reddit/Quora/HARO/SE/forums/Discord/etc.) — distinct from fully-automated `lib/distribute`.

#### `types.ts`
- `QueueChannel` (`:12`, 12: reddit/quora/haro/qwoted/featured/stackexchange/biggerpockets/propertyhub/discord-investor/linkedin-comment/twitter-reply/telegram-group), `QueueStatus` (`:26`, pending/approved/posted/skipped/expired/edited), `QueueAction` (`:34`, approve/skip/edit/postpone/mark-posted/delete).
- `QueueItem` (`:43`), `ChannelPolicy` (`:77`).
- `CHANNEL_POLICIES` (`:90`) — per-channel `expiryHours` (reddit 24, quora 72, haro 24, qwoted 48, featured 72, stackexchange 96, biggerpockets 48, propertyhub 48, discord 48, linkedin-comment 24, twitter-reply 12, telegram 24), `autoPostable:false` for ALL, policyNote, reviewMode.
- `calculateExpiresAt(channel, fromDate)` (`:179`) — `fromDate + expiryHours`.

#### `storage.ts`
Dual adapter KV / FS. Env `KV_REST_API_URL` (`:19`) + `KV_REST_API_TOKEN` (`:20`); KV key `iwr:queue:items` (`:21`); FS `pipeline-runs/queue.json` (`:17`). `crypto.randomUUID()` for ids.
- KV: `kvGet`/`kvSet` (Upstash REST, defensive array/string parse). `useKv` (`:23`).
- Public: `getAllItems`/`getItemsByStatus`/`getPendingItems`(pending+edited, soonest-expiry first)/`getItem`/`addItem`/`addItems`/`updateItem`/`deleteItem`/`expireStaleItems`/`getQueueStats`(`:213`, totals + byChannel)/`getStorageBackend`.

#### `expiry.ts`
- `runExpirySweep(now)` (`:15`) → `expireStaleItems`. `purgeOldTerminalItems(retentionDays=30, now)` (`:23`) — deletes posted/skipped/expired older than cutoff. `runDailyMaintenance(now)` (`:42`) — combined sweep+purge. `getUrgentItems(withinHours=4)` (`:57`).

#### `draft-generators.ts`
Per-channel copy generators. Imports `NewsArticle`, `QueueChannel`/`QueueItem`, `SITE` (`@/lib/constants`).
- `REDDIT_SUBS` (`:28`, 5 subs). Per-channel builders: `buildRedditDraft`/`buildQuoraDraft`/`buildHaroDraft`/`buildQwotedDraft`/`buildFeaturedDraft`/`buildStackExchangeDraft`/`buildBiggerPocketsDraft`/`buildPropertyHubDraft`/`buildDiscordInvestorDraft`/`buildLinkedinCommentDraft`/`buildTwitterReplyDraft`/`buildTelegramGroupDraft` — each returns a `DraftSeed` with channel-specific tone + TOS-aware link rules.
- `generateDraftsForArticle(article)` (`:322`) — all channels (5 reddit + 11 others). `selectTopDrafts(drafts, channels=[reddit,quora,haro,linkedin-comment])` (`:351`). `toQueuePartials(drafts)` (`:362`) — strips id/createdAt/expiresAt/status for storage.
- **Consumer routes**: `app/api/queue/add/route.ts` POST (`?secret`, `:25`) — Mode A `{items}` → `addItems`; Mode B `{slugs, channels?}` → `generateDraftsForArticle`+`selectTopDrafts`+`addItems`. `app/api/queue/action/[id]/route.ts` POST (`?secret`, `:19`) — approve/skip/edit/postpone/mark-posted/delete via `getItem`/`updateItem`/`deleteItem`; GET returns item.

---

### Consent + Pixels — `lib/consent/*` + `lib/pixels/snippets.ts`

GDPR/PDPL consent for an 8-pixel network. Per-purpose grouping.

#### `lib/consent/types.ts`
- `ConsentPurpose` (`:12`) = essential/analytics/advertising/conversion. `PixelDefinition` (`:14`).
- `PIXELS` (`:38`) — 8 pixels, each carries its `envVar`: `ga4`→`NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `plausible`→`NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (cookieless, default opt-in), `clarity`→`NEXT_PUBLIC_MS_CLARITY_ID`, `meta`→`NEXT_PUBLIC_META_PIXEL_ID`, `linkedin`→`NEXT_PUBLIC_LINKEDIN_INSIGHT_ID`, `x`→`NEXT_PUBLIC_X_PIXEL_ID`, `tiktok`→`NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `googleads`→`NEXT_PUBLIC_GOOGLE_ADS_ID`. Each lists cookie regexes for purge.
- `getPixel(name)` (`:144`), `getPixelsByPurpose()` (`:149`). `ConsentState` (`:161`), `CONSENT_VERSION = 1` (`:171`), `CONSENT_STORAGE_KEY = "iwr-news-consent"` (`:172`).

#### `lib/consent/state.ts` (client-only, localStorage)
- `readConsent()` (`:9`, stale-version purge), `saveConsent(consents)` (`:27`, dispatches `iwr-consent-changed` CustomEvent), `clearConsent()` (`:42`), `hasConsented()` (`:50`), `isAllowed(serviceName)` (`:55`), `purgeCookies(patterns)` (`:62`, multi-domain expiry).

#### `lib/pixels/snippets.ts`
Inline `<script>` body generators (consumed by `components/consent/PixelLoader.tsx`): `ga4Snippet`/`ga4ExternalSrc`, `plausibleSrc`/`plausibleAttrs`, `metaPixelSnippet`, `linkedinSnippet`, `xPixelSnippet`, `tiktokSnippet`, `googleAdsSnippet`/`googleAdsExternalSrc`, `clarityPixelSnippet`. No env access in this file (IDs passed in by caller; gated in `components/consent/ConsentRoot.tsx` which reads the `NEXT_PUBLIC_*` vars at `:9-16`).

---

### Verticals — `lib/verticals.ts`

Editorial taxonomy driving homepage bento + `/v/[slug]`. Imports `NewsCategory`.
- `VerticalSlug` (`:9`) = dld-pulse / off-plan-watch / uhnw-trades / sovereign-plays / beyond-the-deal. `Vertical` (`:16`).
- `VERTICALS` (`:36`) — 5 entries (name/tagline/description/categories[]/gradient/accent/glyph/cadence). Each maps to ≥1 `NewsCategory`.
- `getVerticalBySlug(slug)` (`:104`).

### Developers — `lib/developers.ts`

Registry powering `/developer/[slug]`. Imported by `lib/sentiment/mock.ts`.
- `DeveloperKind` (`:5`, sovereign-master/listed-developer/private-major/private-active/boutique/anchor-tenant). `DeveloperProfile` (`:13`).
- `DEVELOPERS` (`:42`) — 9 profiles (emaar/aldar/nakheel/modon/damac/sobha/dubai-holding/ifa-hotels/marjan) with slug/name/tagline/founded/hq/kind/ticker?/excerpt/activeAreas[]/flagshipProjects[]/accent/glyph/rajTake.
- `getDeveloperBySlug` (`:174`), `getAllDeveloperSlugs` (`:178`), `getDevelopersForArea(areaSlug)` (`:183`).

---

### JSON-LD schema generators — `lib/schema/*`

All read `SITE`/`CONTACT` from `@/lib/constants`. Barrel = `lib/schema/index.ts`.

| File | Exports | Emits |
|------|---------|-------|
| `article.ts` | `newsArticleSchema(article)` (`:13`), `insightArticleSchema(article)` (`:46`), `speakableSchema(selectors?)` (`:82`), `faqPageSchema(faq)` (`:91`) | `NewsArticle` / `Article` (adds wordCount via `countWords`, `timeRequired=PT{readTimeMin}M`, canonical→`linkedinUrl` if set) / `SpeakableSpecification` (default `.article-tldr` + first `p`) / `FAQPage` (null if empty). Both article schemas embed `rajPersonRef` author, `newsOrgRef` publisher, `citation[]` as CreativeWork. |
| `area.ts` | `placeSchema(area)` (`:9`), `realEstateAgentSchema(area)` (`:37`) | `Place` (GeoCoordinates + PostalAddress + containedInPlace chain to UAE) / `RealEstateAgent` (Raj, DLD-license `EducationalOccupationalCredential`, `areaServed` → `#place`, `knowsAbout`). |
| `person.ts` | `rajPersonSchema` (`:8`), `rajPersonRef` (`:87`) | canonical `Person` `@id ${rootUrl}#raj` — jobTitle "Real Estate Advisor", alumniOf (MGU MBA / Manipal B.Plan / **Wharton certificate**), knowsAbout[], DLD-broker credential, sameAs (LinkedIn/IG/YT/WhatsApp), worksFor `#organization`. |
| `organization.ts` | `newsOrgSchema` (`:8`), `newsOrgRef` (`:58`), `parentOrgRef` (`:61`) | `NewsMediaOrganization` `@id ${url}#newsmediaorg` — Google-News E-E-A-T policy URLs all → `/about/editorial-standards`, founder `#raj`, parentOrganization root `#organization`, foundingDate 2026-05-26. |
| `breadcrumb.ts` | `breadcrumbSchema(crumbs)` (`:13`), `BREADCRUMB_PRESETS` (`:33`, news/insight/area), `Crumb` type | `BreadcrumbList` (auto-prepends Home). |
| `index.ts` | re-exports all + `asGraph(...schemas)` (`:21`) | merges non-null schemas into a single `@graph` (strips duplicate `@context`). |

---

### Content model

#### `content/news/index.ts` + `types.ts`
- `NEWS_ARTICLES` (`index.ts:42`) — 15 statically-imported articles (each `content/news/<date>-<slug>.ts`). Helpers: `getLatestNews(limit=10)` (`:68`, filters `status!=="research"`, sort desc), `getNewsBySlug` (`:77`), `getAllNewsSlugs` (`:83`, includes research stubs for `generateStaticParams`), `getNewsForGoogleNewsSitemap` (`:90`, live + last 48h). `isLive` (`:62`) gate.
- `types.ts`: `NewsCategory` (`:7`, 7 values), `Citation` (imports `SourceTier` from `@/lib/sources/registry`), `HeroImage`, `Cta`, `DistributionConfig` (Postiz/repost/telegram/discord toggles), `FaqItem`, `ViewFrom`/`BrokerTake`/`SemaformSections` (Semaform structured layout), `NewsArticleStatus` (live|research), `NewsArticle` (`:115`, full schema: title≤90/subtitle/publishedAt/modifiedAt/displayDate/author "raj-tomar"/tier "news"/category/market[]/`tldr:[string,string,string]`/body/faq/citations/heroImage/cta/distribution/metaDescription?/speakableSelector?/semaform?). `sortNewsArticles`/`groupByCategory`.

#### `content/areas/index.ts` + `catalog.ts` + `types.ts`
- `AREAS` (`index.ts:104`) = `PRIORITY_AREAS` (3: hudayriyat-island, palm-jebel-ali, wynn-al-marjan — carry `iwrNoteSlug`/stats) + `ADDITIONAL_AREAS` (`catalog.ts:55`, 27 more: 16 Dubai / 7 Abu Dhabi / 3 RAK + Al Hamra). `getAreaBySlug`/`getAllAreaSlugs`.
- `catalog.ts` `area()` builder (`:10`) — defaults publishedAt 2026-05-26, empty `body`, placeholder heroImage `/areas/<slug>-placeholder.jpg`.
- `types.ts`: `AreaKind` (island/community/free-zone/master-plan/development), `AreaStat`, `AreaPage` (slug/name/emirate/kind/oneLiner/excerpt/coords/body/stats[]/developers[]/medianAedPerSqft?/netYieldBand?/faq/citations/heroImage/iwrRootAreaSlug?/iwrNoteSlug?/relatedNews/relatedInsight). `sortAreas` (IWR-note priority), `filterByEmirate`.

#### `content/power-list/index.ts` + `types.ts`
- `POWER_LISTS: PowerListYear[]` (`index.ts:6`) — **empty** (manually curated; placeholder year-block renders "in production"). `getPowerListByYear`/`getAllPowerListYears`.
- `types.ts`: `PowerListCategory` (7), `PowerListEntry` (rank/name/role/company/category/why/lastYearRank?/linkedin?), `PowerListYear`.

#### `content/closing-bell/index.ts` + `types.ts`
- `CLOSING_BELLS: ClosingBellArticle[]` (`index.ts:7`) — **empty** (daily 16:30 GST cron writes here). `getLatestBells`/`getBellBySlug`/`getAllBellSlugs`.
- `types.ts`: `ClosingBellArticle` (slug/title≤70/publishedAt/displayDate/`highlights:[string,string,string]`/rajClose/relatedNewsSlug?). `sortBells`.

#### `content/insights/index.ts` + `types.ts`
- `INSIGHT_ARTICLES: InsightArticle[]` (`index.ts:13`) — **empty** (Sunday-09:00 GST weekly routine, PR-reviewed). `getLatestInsights(5)`/`getInsightBySlug`/`getAllInsightSlugs`.
- `types.ts`: `InsightCategory` (thesis/deep-dive/thematic/linkedin-mirror/market-quarterly), `InsightArticle` (`:21`, like NewsArticle + excerpt/keyTakeaways[]/readTimeMin/linkedinUrl?/iwrNotesReferenced?, tier "insight", ≥2 citations). `sortInsightArticles`/`getLinkedinMirrors`.

#### `content/daily-anchor/types.ts`
`AnchorState` + `DailyAnchor` — mapped above under the anchor store.

---

### COMPLETE ENV VAR INVENTORY (repo-wide `process.env.*`, names only)

Grouped from a repo-wide grep (excluding `node_modules`). NO values printed. `.env.local` on disk additionally contains live secret values for `INTERNAL_BASIC_AUTH`, `KV_REST_API_*`, `KV_URL`, `POST_PUBLISH_SECRET`, `REDIS_URL`, `VERCEL_OIDC_TOKEN` — values intentionally omitted here.

**AI / LLM**
| Var | Where | Purpose |
|-----|-------|---------|
| `ANTHROPIC_API_KEY` | `lib/ai/claude.ts:4`, `scripts/draft-once.ts:32` | Claude API key (scripts, anchor, draft engine) |
| `ANTHROPIC_MODEL` | `lib/ai/claude.ts:5` | Claude model override |
| `DRAFT_MODEL` | `scripts/draft-once.ts:63`, `app/api/cron/draft/route.ts:71` | Model for the draft pipeline |
| `GEMINI_API_KEY` | `lib/ai/gemini.ts:8` | Gemini API key (video/legacy image) |
| `GEMINI_BASE_URL` | `lib/ai/gemini.ts:9` | Gemini base URL override |
| `GEMINI_VIDEO_MODEL` | `lib/ai/gemini.ts:10` | Gemini Veo video model |
| `HIGGSFIELD_API_KEY` | `lib/ai/higgsfield.ts:8` | Higgsfield (AI cover/anchor video) key |
| `HIGGSFIELD_BASE_URL` | `lib/ai/higgsfield.ts:9` | Higgsfield base URL |

**Vertex AI / GCP (Imagen 4 generation, Workload Identity Federation)**
| Var | Where | Purpose |
|-----|-------|---------|
| `GCP_PROJECT_ID` | `lib/ai/vertex.ts:27`, `app/api/vertex-test/route.ts:33` | GCP project id |
| `GCP_PROJECT_NUMBER` | `lib/ai/vertex.ts:28`, `vertex-test:34` | GCP project number |
| `GCP_SERVICE_ACCOUNT_EMAIL` | `lib/ai/vertex.ts:29`, `vertex-test:35` | SA email for WIF impersonation |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | `lib/ai/vertex.ts:30`, `vertex-test:36` | WIF pool id |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | `lib/ai/vertex.ts:31`, `vertex-test:38` | WIF provider id |
| `VERTEX_LOCATION` | `lib/ai/vertex.ts:32` | Vertex region |
| `VERTEX_IMAGEN_MODEL` | `lib/ai/vertex.ts:34`, `vertex-test:67` | Imagen model override (default imagen-4.0-fast-generate-001) |
| `VERTEX_VEO_MODEL` | `lib/ai/vertex.ts:35` | Veo video model override |
| `VERCEL_OIDC_TOKEN` | `.env.local` (consumed by `@vercel/oidc`/google-auth) | OIDC token feeding WIF |

**Voice (ElevenLabs)**
| Var | Where | Purpose |
|-----|-------|---------|
| `ELEVENLABS_API_KEY` | `lib/voice/elevenlabs.ts:14`, `scripts/fetch-assets.ts:91` | ElevenLabs key |
| `ELEVENLABS_RAJ_VOICE_ID` | `lib/voice/elevenlabs.ts:16` | Raj PVC voice id |
| `ELEVENLABS_MODEL` | `lib/voice/elevenlabs.ts:17` | TTS model |
| `ELEVENLABS_STABILITY` / `_SIMILARITY` / `_STYLE` / `_SPEED` | `lib/voice/elevenlabs.ts:20-24` | Voice tuning params |

**Stock / image / video sourcing**
| Var | Where | Purpose |
|-----|-------|---------|
| `UNSPLASH_ACCESS_KEY` | `lib/stock/providers.ts:21` | Unsplash search + download-trigger auth |
| `PEXELS_API_KEY` | `lib/stock/providers.ts:22`, `video-providers.ts:13`, `scripts/fetch-frame-videos.ts:21` | Pexels photos + videos |
| `PIXABAY_API_KEY` | `lib/stock/providers.ts:23` | Pixabay search |
| (FX `exchangerate.host`, Wikimedia, Openverse, DLD reference, Coverr — keyless, no env) | — | — |

**Market data (DLD)**
| Var | Where | Purpose |
|-----|-------|---------|
| `DLD_API_URL` | `lib/dld/pulse.ts:44` | Dubai Pulse base (default api.dubaipulse.gov.ae) |
| `DLD_API_KEY` | `lib/dld/pulse.ts:45` | OAuth client_id |
| `DLD_API_SECRET` | `lib/dld/pulse.ts:46` | OAuth client_secret |

**Storage / KV / Redis (Upstash)**
| Var | Where | Purpose |
|-----|-------|---------|
| `KV_REST_API_URL` | `lib/queue/storage.ts:19`, `lib/anchor/store.ts:18`, `lib/news-review/storage.ts:17` | Upstash REST URL |
| `KV_REST_API_TOKEN` | same files `:20`/`:19`/`:18` | Upstash REST write token |
| `KV_REST_API_READ_ONLY_TOKEN` | `.env.local` | Upstash read-only token |
| `KV_URL` / `REDIS_URL` | `.env.local` | Redis connection strings |

**Press IMAP**
| Var | Where | Purpose |
|-----|-------|---------|
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USERNAME` / `IMAP_PASSWORD` / `IMAP_MAILBOX` | `lib/press-inbox/imap-client.ts:27-31` | Inbound press mailbox (TLS, app password, default port 993 / INBOX) |

**Distribution (megaphones) — owned by N6 but listed for completeness**
| Var | Where | Purpose |
|-----|-------|---------|
| `POSTIZ_BASE_URL` / `POSTIZ_API_TOKEN` | `lib/distribute/postiz.ts:16-17`, `index.ts:102` | Postiz social scheduler |
| `POSTIZ_LINKEDIN_PERSONAL_ID` / `_LINKEDIN_COMPANY_ID` / `_X_ID` / `_FACEBOOK_ID` / `_INSTAGRAM_FEED_ID` / `_INSTAGRAM_STORIES_ID` / `_THREADS_ID` / `_TIKTOK_ID` / `_PINTEREST_ID` / `_BLUESKY_ID` / `_MASTODON_ID` / `_YOUTUBE_SHORTS_ID` | `lib/distribute/postiz.ts:27-38` | Per-channel Postiz integration ids |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHANNEL_ID` | `lib/distribute/telegram.ts:11-12`, `index.ts:103` | Telegram broadcast |
| `DISCORD_WEBHOOK_URL` | `lib/distribute/discord.ts:11`, `index.ts:104` | Discord webhook |
| `NEXT_PUBLIC_DISCORD_AVATAR_URL` | `lib/distribute/discord.ts:38` | Discord post avatar |
| `LISTMONK_BASE_URL` / `_API_USERNAME` / `_API_TOKEN` / `_DIGEST_LIST_ID` / `_FROM_EMAIL` / `_FROM_NAME` / `_TEMPLATE_ID` | `lib/distribute/listmonk.ts:16-22` | Listmonk newsletter (digest) |

**GitHub (review auto-committer)**
| Var | Where | Purpose |
|-----|-------|---------|
| `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` | `lib/news-review/github.ts:11-14` | Commit approved drafts via GitHub API |

**Auth / pipeline / secrets**
| Var | Where | Purpose |
|-----|-------|---------|
| `POST_PUBLISH_SECRET` | ~15 API routes + `lib/news-review/auth.ts:16` + scripts | Shared `?secret=` guard for all write/cron endpoints |
| `INTERNAL_BASIC_AUTH` | `proxy.ts:8`, `lib/news-review/auth.ts:15` | Basic-auth gate for `/internal/*` |
| `CRON_SECRET` | `app/api/cron/draft/route.ts:31` | Vercel cron auth header |
| `AUTO_APPROVE` | `docs/_bmap/N5` (kill-switch for `draft-once.ts` auto-approver) | Auto-approver on/off |
| `PIPELINE_CAP` | `scripts/news-pipeline.ts:29`, `draft-once.ts:23`, `cron/draft:27` | Max drafts per run |
| `PIPELINE_MIN_SCORE` | `scripts/draft-once.ts:22`, `cron/draft:26` | Min relevance to publish |
| `PIPELINE_MAX_ATTEMPTS` | `scripts/draft-once.ts:24`, `cron/draft:28` | Draft retry cap |

**Search / SEO**
| Var | Where | Purpose |
|-----|-------|---------|
| `INDEXNOW_KEY` | `lib/search/indexnow.ts:29` | IndexNow ping key |

**Wallet (PWA pass)**
| Var | Where | Purpose |
|-----|-------|---------|
| `APPLE_PASS_TYPE_ID` / `APPLE_TEAM_ID` / `APPLE_PASS_CERT_PEM` / `APPLE_WWDR_PEM` | `app/api/wallet/install/route.ts:24-27` | Apple Wallet pass signing |
| `GOOGLE_WALLET_ISSUER_ID` / `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | `app/api/wallet/install/route.ts:29-30` | Google Wallet pass |

**Public site / analytics pixels (`NEXT_PUBLIC_*`)**
| Var | Where | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_SITE_URL` | `lib/constants.ts:6` + others | Canonical news subdomain base |
| `NEXT_PUBLIC_MAIN_URL` | `components/v17/chrome/V17EdgeNav.tsx:23` | IWR root URL for nav |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / `_PLAUSIBLE_DOMAIN` / `_MS_CLARITY_ID` / `_META_PIXEL_ID` / `_LINKEDIN_INSIGHT_ID` / `_X_PIXEL_ID` / `_TIKTOK_PIXEL_ID` / `_GOOGLE_ADS_ID` | `lib/consent/types.ts:47-136` (defs), `components/consent/ConsentRoot.tsx:9-16` (read) | 8-pixel tracking ids — pixel dormant if unset |

**Scripts-only / tooling**
| Var | Where | Purpose |
|-----|-------|---------|
| `SITE_URL` | `scripts/draft-once.ts:20` | Base URL for the standalone draft script |
| `FFMPEG_PATH` | `scripts/fetch-frame-videos.ts:25` | FFmpeg binary path |

---

#### Notes / ⚠️ unresolved
- ⚠️ `app/api/dld-pulse/route.ts:7` comment claims a "deterministic mock" fallback; the real `getDldPulse` fallback is the **cited official reference print** (`getReferenceDldPulse`), never mock. Stale comment.
- ⚠️ `lib/sentiment/*` is wholly mock (date-seeded); `/pulse` hero label hardcodes "Live · mock · refreshes every 30m" — no live scraper or 30m refresh exists yet. `SentimentSnapshot.source` is `"mock"`.
- ⚠️ `lib/stock/video-providers.ts` `searchCoverr` is a stub (`return []`) — Pexels Videos is the only live video source.
- ⚠️ `content/power-list`, `content/closing-bell`, `content/insights` registries are all empty arrays Day-1 (populated by cron/manual later).
- ⚠️ `lib/stock/providers.ts` header comment references `GEMINI_API_KEY` / `IMAGEN_MODEL` for the Imagen path, but the actual synthetic fallback goes through `@/lib/ai/vertex` (Vertex AI Imagen 4, WIF) — the Gemini path is documented-but-not-wired here.
- Cross-ref: the data/AI consumer endpoints (`/api/anchor`, `/api/dld-pulse`, `/api/fx`, `/api/stock-cover`, `/api/cover-image`, `/api/press-inbox`, `/api/queue/*`, `/api/digest`) are also covered in `docs/_bmap/N3_api_data_ai.md`; the auto-approver/draft engine that calls `findBestStockImage`+`buildQueryForArticle` lives in `docs/_bmap/N5_review_autoapprover.md` (`lib/news-review/draft-engine.ts`).
