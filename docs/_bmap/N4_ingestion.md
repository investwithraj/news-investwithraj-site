## NEWS · Ingestion Pipeline + Clustering

Phase-1 (pure-Node) firehose for `news.investwithraj.com`: fetch ~25 feeds in parallel → dedupe → cluster + score → write `clusters.json` artifact. Phase-2 drafting (draft-engine / cron) consumes the artifact and is out-of-scope here except where it calls into `extract.ts`.

**Data flow:** `FETCH_SOURCES` (registry) → `fetchAllSources()` (fetchers/index) → per-type fetcher (`rss` / `reddit` / `webfetch`) → `RawEntry[]` → `flattenEntries()` → `dedupeEntries()` (dedupe) → `clusterAndScore()` (cluster) → `Cluster[]` → `scripts/news-pipeline.ts` writes `pipeline-runs/YYYY-MM-DD/clusters.json` + `fetch-log.txt`.

**Env vars (whole subsystem):** only `process.env.PIPELINE_CAP` (read in `scripts/news-pipeline.ts:29`). No secrets, no DB, no SDKs — all I/O is raw `fetch()` to public feed URLs. `extract.ts` is imported by `lib/news-review/draft-engine.ts:14` (Phase-2), not by Phase-1.

---

### lib/sources/registry.ts
**Purpose:** Verified-source whitelist + discovery-feed generators + tier weights. Hard citation gate: every drafted article must cite ≥1 `citable` whitelisted source (`registry.ts:1-7`).

**Types exported:**
- `SourceTier` = `"government" | "national-press" | "regional-press" | "institutional-research" | "industry-portal"` (`:9`).
- `SourceFetchType` = `"rss" | "webfetch" | "scrape" | "reddit"` (`:11`). NB `"scrape"` is declared but no fetcher implements it — `fetchers/index.ts` routes only rss/reddit/else→webfetch.
- `VerifiedSource` interface (`:13-31`): `name`, `url`, `tier`, `market[]` (`"Dubai"|"Abu Dhabi"|"Ras Al Khaimah"|"UAE"|"GCC"|"Global"`), `fetchType`, `rssUrl?`, `notes?`, `citable?` (default true; `false` = discovery-only, never a citation target).

**`SOURCE_WHITELIST: VerifiedSource[]` (`:37-238`)** — the citation whitelist (NOT all fetched; see `FETCH_SOURCES`). Comment says "20-source" but contains far more (the fetched core 20 + ~28 citation-anchor entries). Fetched ones (`rss`/`webfetch` with working `rssUrl`) vs anchor-only (`webfetch`, listed solely so cited URLs pass validator gate 5):

| Tier | Source | url domain | fetchType | rssUrl | line |
|---|---|---|---|---|---|
| government | Dubai Land Department | dubailand.gov.ae | webfetch | — | :39 |
| government | RERA | rera.gov.ae | webfetch | — | :47 |
| government | Dubai Statistics Center | dsc.gov.ae | webfetch | — | :55 |
| government | Federal Competitiveness & Statistics Authority | fcsc.gov.ae | webfetch | — | :63 |
| government | Central Bank of the UAE | centralbank.ae | webfetch | — | :71 |
| government | Abu Dhabi Global Market | adgm.com | webfetch | — | :79 |
| government | Dubai International Financial Centre | difc.com | webfetch | — | :87 |
| national-press | Khaleej Times — Real Estate | khaleejtimes.com | rss | /rss/real-estate | :97 |
| national-press | Gulf News — Property | gulfnews.com | rss | /rss/property | :105 |
| national-press | The National — Business | thenationalnews.com | rss | /business/rss.xml | :113 |
| national-press | Arabian Business | arabianbusiness.com | rss | /feed | :121 |
| regional-press | Zawya — Real Estate (LSEG) | zawya.com | rss | /en/rss/business/real-estate | :131 |
| regional-press | Mubasher | english.mubasher.info | rss | /rss | :139 |
| institutional-research | Knight Frank Dubai | knightfrank.com | webfetch | — | :149 |
| institutional-research | JLL MENA | jll-mena.com | webfetch | — | :157 |
| institutional-research | CBRE MENA | cbre.ae | webfetch | — | :165 |
| institutional-research | Savills Dubai | savills.ae | webfetch | — | :173 |
| institutional-research | Asteco | asteco.com | webfetch | — | :181 |
| industry-portal | Property Finder Trends | propertyfinder.ae | rss | /blog/feed | :191 |
| industry-portal | Bayut Insights (mybayut) | bayut.com | rss | /mybayut/feed | :199 |

**Citation anchors (NOT fetched — `webfetch`, no rssUrl; surfaced via aggregators/web-search, listed so cited URLs pass gate 5) (`:208-237`):** AGBI (agbi.com), Gulf Business, Construction Week, MEED, Emirates 24|7, Gulf Today, WAM (government), ValuStrat, Cavendish Maxwell, Property Monitor, Reidin, dxbinteract, Dubai Pulse (government), Emaar, Nakheel, Aldar, Modon, Sobha Realty, Damac, Meraas, Binghatti, Azizi, Danube, Ellington, Reuters, Bloomberg (all national-press/Global), Financial Times, CNBC.

**Discovery feeds (the actual fetch workhorses) (`:240-314`):**
- `googleNews(query)` (`:251-256`): builds `https://news.google.com/rss/search?q=<query> when:7d&hl=en-AE&gl=AE&ceid=AE:en` — AE locale, 7-day window. Rationale in `:240-249`: direct-publisher RSS rots (14/20 were 404/403 May 2026); Google News RSS never 404s + tags each item with real publisher via `<source url>`.
- `bingNews(query)` (`:258-260`): `https://www.bing.com/news/search?q=<query>&format=rss&qft=interval%3d%227%22` (7-day).
- `discovery(name, query, market, engine)` (`:262-277`): wraps a query into a `VerifiedSource` with `tier:"national-press"`, `citable:false`, `fetchType:"rss"`, name prefixed `Google News · ` / `Bing News · `.
- `GOOGLE_QUERIES` (`:281-302`): **20 queries** — Dubai real estate, property market, off-plan, luxury/branded, developers, new launches, Abu Dhabi RE, Hudayriyat/Saadiyat/Yas, RAK/Wynn, Golden Visa, DLD transactions, RERA/regulation, mortgage/lending, rental/yield, secondary/resale, waterfront/islands, plots/land, REIT/institutional, PropTech/tokenisation, developer earnings.
- `BING_QUERIES` (`:304-309`): **4 queries** — Dubai RE, Abu Dhabi RE, UAE Golden Visa, Dubai luxury.
- `DISCOVERY_FEEDS` (`:311-314`): `[...20 Google, ...4 Bing]` = **24 feeds**.

**`AGBI` (`:316-325`):** the one direct-publisher RSS that still works — `citable:true`, `rssUrl:"https://www.agbi.com/feed/"`.

**`REDDIT_FEEDS` (`:327-333`):** `[r/dubai]` only, `fetchType:"reddit"`, `citable:false`, JSON search URL stashed in `rssUrl`. **DISABLED** — NOT in `FETCH_SOURCES` (comment: Reddit 403s unauthenticated datacenter IPs; kept wired for future OAuth).

**`FETCH_SOURCES: VerifiedSource[]` (`:337-340`):** `[...DISCOVERY_FEEDS, AGBI]` = **25 feeds actually fetched each run** (24 aggregator + 1 AGBI). (Console/comments say "20" — stale; real count is 25.)

**`TIER_WEIGHT: Record<SourceTier, number>` (`:344-350`):** government 1.0, national-press 0.85, institutional-research 0.80, regional-press 0.65, industry-portal 0.50. Consumed by `cluster.ts` (`scoreSourceTier`, sort) + `dedupe.ts` (separate hardcoded rank).

**Helpers:**
- `findSourceByUrl(url)` (`:353-363`): strips `www.` + path, matches host exact-or-suffix against `SOURCE_WHITELIST`. Returns `VerifiedSource | undefined`. try/catch → undefined on bad URL.
- `getWhitelistDomains()` (`:368-372`): citable-only domains (`citable !== false`) for bulk validator checks; excludes discovery aggregators.

**Imports/calls:** none external — pure data + URL string builders.

---

### lib/sources/fetchers/types.ts
**Purpose:** Shared DTOs for the fetch layer. **Imports:** `SourceTier`, `VerifiedSource` from `@/lib/sources/registry` (type-only).
- `RawEntry` (`:6-31`): `id`, `title`, `url`, `publishedAt` (ISO), `summary`, `source:{name,tier,domain}`, optional `fullText?`, `categories?`, `heroImage?`. The atomic unit pre-clustering.
- `FetchResult` (`:34-41`): `{ source: VerifiedSource, entries: RawEntry[], error: string|null, durationMs }` — per-source result; `error!=null` ⇒ graceful degradation (other sources continue).
- `FetchRun` (`:44-53`): `{ startedAt, finishedAt, results: FetchResult[], totalEntries, okCount, errorCount }`.

---

### lib/sources/fetchers/index.ts
**Purpose:** Parallel fetch orchestrator. **Imports:** types from `./types` (also re-exports `RawEntry`/`FetchResult`/`FetchRun` `:5`); `FETCH_SOURCES` from `@/lib/sources/registry`; `fetchRssFeed`, `fetchWebPage`, `fetchReddit`.

- **`fetchAllSources(): Promise<FetchRun>` (`:13-37`):** maps `FETCH_SOURCES` → dispatch by `fetchType` (`rss`→`fetchRssFeed`, `reddit`→`fetchReddit`, else→`fetchWebPage`, `:17-21`); `await Promise.all` (all in parallel, `:23`); aggregates `totalEntries`/`okCount` (error===null)/`errorCount`. Timestamps via `Date.toISOString()`. **No per-source error rejects the batch** (each fetcher catches internally and returns a `FetchResult`).
- **`flattenEntries(run)` (`:40-42`):** `run.results.flatMap(r => r.entries)`.
- **`summarizeFetchRun(run): string` (`:45-61`):** human log — `📰 Fetched N from ok/total`, per-errored-source lines, `📊 By tier:` breakdown. Used for `fetch-log.txt`.

**External calls:** none directly — delegates to fetchers (which call `fetch()`).

---

### lib/sources/fetchers/rss.ts
**Purpose:** Zero-dependency regex RSS 2.0 + Atom parser. **Imports:** `RawEntry`, `FetchResult` (`./types`); `VerifiedSource` (registry, type-only).
**Consts:** `FETCH_TIMEOUT_MS = 15_000` (`:8`); `USER_AGENT = "Mozilla/5.0 (compatible; InvestWithRajNewsBot/1.0; +https://news.investwithraj.com)"` (`:9-10`).

**Calls (network):** `fetch(feedUrl, { headers:{User-Agent, Accept: rss/atom/xml}, signal, cache:"no-store" })` (`:90-99`) — `AbortController` 15s timeout; `redirect` default. No env, no auth.

**Functions:**
- `decodeXml(s)` (`:13-27`): CDATA unwrap + named/numeric/hex entity decode + trim.
- `extract(pattern, source)` / `extractAll(pattern, source)` (`:29-42`): single / global regex capture (auto-adds `g` flag).
- `stripHtml(s)` (`:45-50`); `hashUrl(url)` (`:53-60`): djb2-style 32-bit hash → base36 (fallback ID); `toIso(s)` (`:63-68`): parse date → ISO, fallback `now`.
- **`fetchRssFeed(source, limit=30): Promise<FetchResult>` (`:71-140`):** guards missing `rssUrl` (`:77-84`); fetch + 15s abort; non-2xx → `error:"HTTP <status> from <url>"` (`:103-110`); detects Atom via `/<feed[\s>]/i` (`:114`) and Google-News via `domain==="news.google.com"` (`:115`); routes to `parseAtomEntries` or `parseRssItems`; catch → `error: e.message`.
- **`parseRssItems(...)` (`:143-203`):** splits on `<item`, slices to `limit`; extracts `title`/`link`/`guid`/`pubDate`/`description||content:encoded`/`category[]`; skips entries missing title or link (`:168`). **Google-News per-entry attribution (`:176-190`):** reads `<source url="…">Publisher</source>`, overrides `entryDomain`+`entryName` to the real publisher, strips trailing `" - Publisher"` from title. Builds `RawEntry` with `id=guid||hashUrl(link)`, `summary=stripHtml(desc).slice(0,600)`.
- **`parseAtomEntries(...)` (`:206-245`):** splits on `<entry`; `title`; `link` from `href` attr; `id`; `published||updated`; `summary||content`; skips missing title/link; `id||hashUrl`, summary capped 600. (No Google-News publisher lift in Atom path.)

---

### lib/sources/fetchers/reddit.ts
**Purpose:** Reddit free-JSON fetcher (discovery-only). **Currently dormant** — `REDDIT_FEEDS` not in `FETCH_SOURCES`, so never invoked, but fully wired. **Imports:** `RawEntry`,`FetchResult` (`./types`); `VerifiedSource` (registry).
**Consts:** `FETCH_TIMEOUT_MS = 15_000` (`:10`); `USER_AGENT = "web:news.investwithraj.com:v1.0 (by /u/investwithraj news discovery)"` (`:11-12`).
**`fetchReddit(source, limit=15): Promise<FetchResult>` (`:27-89`):** reads JSON URL from `source.rssUrl` (`:32`); guards missing (`:33-35`); `fetch(jsonUrl,{headers:{User-Agent,Accept:application/json}, signal, cache:no-store})` (`:41-45`), 15s abort; non-2xx → `HTTP <status> from reddit`; parses `json.data.children[]`; per child skips `!title || stickied || over_18` (`:63`); builds permalink (`https://www.reddit.com${permalink}` or `url`); `RawEntry` with `id=permalink`, `publishedAt` from `created_utc*1000`, `summary` from `selftext` or `Discussion in r/<sub>` (cap 600), `source.domain="reddit.com"`. catch → `error`.
**External:** Reddit `.json` API, no auth (the reason it 403s from datacenter IPs).

---

### lib/sources/fetchers/webfetch.ts
**Purpose:** Non-RSS index-page scraper — pulls candidate article links from govt/research HTML pages (DLD, RERA, Knight Frank, etc.). Full content is later extracted in-session by Phase-2 Claude. **Imports:** `RawEntry`,`FetchResult` (`./types`); `VerifiedSource` (registry).
**Consts:** `FETCH_TIMEOUT_MS = 20_000` (`:12`); same `InvestWithRajNewsBot` UA (`:13-14`).
**`fetchWebPage(source, limit=15): Promise<FetchResult>` (`:21-70`):** `fetch(source.url,{headers:{User-Agent,Accept:text/html…}, signal, cache:no-store})` (`:31-38`), 20s abort; non-2xx → `HTTP <status> from <url>`; on ok → `extractCandidateLinks(html, …)`; catch → `error`.
**`extractCandidateLinks(...)` (`:76-125`):** regex `<a href>` scan; keeps hrefs matching `/(news|press|releases|research|insights|reports|publications|articles)/` (`:84`) with visible text 20–200 chars (`:99-100`, filters nav + section blocks); resolves relative→absolute via `new URL(href,baseUrl)`; dedupes by absolute URL (`seen` Set); stops at `limit` (scan cap `limit*3`, `:91`). `RawEntry`: `id=hashUrl(abs)`, `publishedAt=now` (no reliable date from raw HTML — used as "found today" freshness signal), `summary="(WebFetch source — full content extracted in-session from <name>)"`.
**`hashUrl(url)` (`:127-134`):** same djb2/base36 as rss.ts (duplicated).
**NB:** This is what every government + institutional-research whitelist source resolves to (all `webfetch`), but **none are in `FETCH_SOURCES`** → `fetchWebPage` is never invoked by the live pipeline; reachable only if a webfetch source is added to `FETCH_SOURCES`.

---

### lib/sources/extract.ts
**Purpose:** Lightweight readability extractor — fetches an article URL and pulls main body `<p>` text so Phase-2 can verify draft figures against real source text. **Not in Phase-1 path** — imported by `lib/news-review/draft-engine.ts:14` and called at `draft-engine.ts:262` (`citations.map(... fetchArticleText(c.url))`). **No imports.**
**Consts:** `UA` = Chrome-124 desktop UA string (`:9-10`).
**Functions:**
- `decodeEntities(s)` (`:12-23`): nbsp/amp/lt/gt/quot/apos/rsquo/lsquo/mdash/ndash + numeric refs.
- **`extractMainText(html, maxChars=9000): string` (`:26-48`):** strips `<script>/<style>/<noscript>`; collects `<p>` contents > 40 chars, joined by double-space; **fallback** if result < 200 chars → strip all tags + slice; returns `.slice(0, maxChars)`.
- **`fetchArticleText(url, timeoutMs=9000): Promise<string>` (`:51-69`):** `fetch(url,{headers:{User-Agent:UA, Accept:html}, redirect:"follow", signal, cache:no-store})`, 9s abort; returns `""` on `!res.ok`, non-html content-type, or any throw (silent) → then `extractMainText(await res.text())`.

---

### lib/pipeline/types.ts
**Purpose:** Cross-stage pipeline DTOs (fetch→dedupe→cluster→draft). **Imports:** `RawEntry` from `@/lib/sources/fetchers` (type-only).
- **`Cluster` (`:8-37`):** `id` (slug), `topic` (label = first entry's title), `entries: RawEntry[]` (tier-sorted), `score` (0-100), `scoreBreakdown:{uhnwRelevance,sourceTier,freshness,rajAngle}`, `entities: ClusterEntities`, `suggestedCategory` (`market-pulse|launch|regulatory|macro|developer-corporate|infrastructure|policy`), `suggestedMarkets` (`Dubai|Abu Dhabi|Ras Al Khaimah|UAE|GCC`).
- **`ClusterEntities` (`:39-48`):** `developers[]`, `places[]`, `figures[]`, `hasTier1Source`.
- **`PipelineRun` (`:50-65`):** `startedAt`,`finishedAt`,`fetchedCount`,`dedupedCount`,`clusterCount`,`selectedCount`,`selected: Cluster[]`,`drafterContext: DrafterContext`.
- **`DrafterContext` (`:67-78`):** `voiceProfilePath`,`validatorPath`,`sourceRegistryPath`,`wordCountTarget:{min,max}`,`outputPathTemplate` — paths the Phase-2 drafter reads.

---

### lib/pipeline/dedupe.ts
**Purpose:** Drop literal duplicates (same URL / near-identical headline), keeping the highest-tier copy. Same-event-different-source is NOT merged here (clustering does that). **Imports:** `RawEntry` from `@/lib/sources/fetchers`.
**Functions:**
- `canonicalUrl(url)` (`:9-26`): drops hash, `utm_*`/`ref`/`source` params, `www.`, trailing slash; lowercases. try/catch → lowercased raw on bad URL.
- `normalizeTitle(t)` (`:29-35`): lowercase, non-word→space, collapse whitespace.
- **`similarity(a,b): number` (`:38-45`):** Jaccard over word-sets (words len>2); `intersection/union`; 0 if either empty. **Also imported by `cluster.ts`** for headline clustering.
- **`dedupeEntries(entries, similarityThreshold=0.85): RawEntry[]` (`:53-96`):** local `tierRank` (government 5 → industry-portal 1, hardcoded — independent of `TIER_WEIGHT`); stable sort by tier desc then `publishedAt` desc (`:66-70`); iterate keeping first occurrence per canonical URL (`seenUrls` Set) AND dropping any title with `similarity ≥ 0.85` to an already-kept (higher-tier) entry (`:82-89`). O(n²) over kept set.

---

### lib/pipeline/cluster.ts
**Purpose:** Group deduped entries by entity/topic, score each cluster (UHNW × tier × freshness × Raj-angle + RE bonus), apply relevance gate, return top-N. **Imports:** `RawEntry` (`@/lib/sources/fetchers`); `Cluster`,`ClusterEntities` (`./types`); `TIER_WEIGHT` (registry); `similarity` (`./dedupe`).

**Entity dictionaries (`:15-169`):**
- `KNOWN_DEVELOPERS` (`:15-49`, ~33): Modon, Nakheel, Emaar, Aldar, Damac, Sobha, Meraas, Q Properties, Wynn Resorts, Dubai Holding, Imkan, Reportage, Eagle Hills, Azizi, Ellington, Select Group, Sweid, MAG, Binghatti, Danube, Object 1, Samana, Imtiaz, LEOS, Omniyat, Arada, Bloom Holding, Tiger Group, Expo City, Dubai South, Wasl, Deyaar, Union Properties.
- `KNOWN_PLACES` (`:54-110`, ~55 specific): Hudayriyat, Palm Jebel Ali, Palm Jumeirah, Saadiyat, Yas Island, Al Marjan, Downtown Dubai, Dubai Marina (dup `:62`/`:103`), Business Bay, JVC/JVT, DIFC, SZR, Dubai Hills, Emirates Hills, MBR City, Bluewaters, Damac Hills/Lagoons, Reem Island, Masdar City, Tilal Al Ghaf, Dubai Creek Harbour, Emaar Beachfront, Dubai Islands, District One, Sobha Hartland, Expo City, etc.
- `GENERIC_PLACES` Set (`:114-122`): dubai/abu dhabi/ras al khaimah/rak/uae/sharjah/ajman — used for market detection/scoring but **never** a clustering signature (avoids the "place--dubai" mega-bucket bug).
- `UHNW_KEYWORDS` (`:124-148`): luxury, branded residence(s), penthouse, mansion, villa, family office, UHNW, off-plan, waterfront, trophy asset, AED 10M/20M/50M/100M, $10M/$50M, etc.
- `RAJ_ANGLE_KEYWORDS` (`:150-169`): yield, absorption, transaction volume, DLD, RERA, payment plan, ROI, IRR, mandate, Golden Visa, cross-border, off-plan, secondary market, resale, launch, handover, discount, escrow.
- `RE_TOPIC_TERMS` (`:301-310`): ~45 real-estate headline terms for the relevance gate.

**Entity extraction — `extractEntities(entries)` (`:173-194`):** substring-matches dictionaries against `title+summary` (lowercased); money regex `/(AED|USD|$|€)\s*\d+(?:[.,]\d+)?\s*(?:M|B|K|million|billion|thousand)\b/g` (`:185`) → unique `figures`; `hasTier1Source = some tier==="government"`.

**Clustering signature — `signatureFor(entry)` (`:199-232`):** priority: (1) specific place + developer → `dev--place`; (2) specific place alone → `place--<slug>`; (3) developer alone → `dev--<slug>`; (4) keyword buckets `regulatory` (rera/dld), `macro` (central bank/interest rate), `policy` (golden visa/residency); else `null`. Generic places skipped (`:206`).

**Categorizers/detectors:**
- `categorizeCluster(entries)` (`:235-245`): regex over titles → launch / regulatory / policy / infrastructure / developer-corporate / macro / default `market-pulse`.
- `detectMarkets(entries)` (`:248-256`): regex over title+summary → Dubai / Abu Dhabi / Ras Al Khaimah (rak|al marjan|wynn); default `["UAE"]`.

**Scoring (each 0-100):**
- `scoreUhnwRelevance` (`:260-267`): `min(100, hits*10)`.
- `scoreSourceTier` (`:269-274`): `round(max(TIER_WEIGHT[tier])*100)`.
- `scoreFreshness` (`:276-288`): newest entry age — <2h=100, <6h=85, <24h=70, <48h=50, <72h=30, else 10.
- `scoreRajAngle` (`:290-297`): `min(100, hits*8)`.
- `topicIsRealEstate(topic)` (`:311-314`): any `RE_TOPIC_TERMS` substring.

**Main — `clusterAndScore(entries, topN=10): Cluster[]` (`:325-417`):**
1. Group by `signatureFor`; `null`-sig entries → `ungrouped` (`:330-340`).
2. **(1b)** ungrouped re-clustered by headline `similarity ≥ HEADLINE_SIM(0.45)` (`:347-360`) into `topic--<i>-<id>` groups (prevents dropping entity-less real stories; off-topic singletons die at the score filter).
3. Build `Cluster` per group: `scoreBreakdown` + composite `min(100, round(uhnw*0.30 + tier*0.25 + fresh*0.20 + rajAngle*0.25) + reBonus)` where `reBonus=15` if first entry's title is RE (`:375-384`); entries sorted by `TIER_WEIGHT` then `publishedAt` desc (`:389-393`).
4. **Relevance gate (`:406-412`):** keep only clusters with `places>0 || developers>0 || topicIsRealEstate(topic) || rajAngle≥24`.
5. Sort by `score` desc, `slice(0, topN)` (`:415-416`).

---

### scripts/news-pipeline.ts
**Purpose:** Phase-1 entrypoint (`news:fetch` / `npx tsx scripts/news-pipeline.ts`). Pure Node; writes the `clusters.json` artifact that Phase-2 (schedule-skill / cron) consumes. **Imports (note `.js` ext for tsx/ESM):** `fetchAllSources`,`flattenEntries`,`summarizeFetchRun` (`../lib/sources/fetchers/index.js`); `dedupeEntries`; `clusterAndScore`; `PipelineRun`,`DrafterContext` types.

**Env:** `process.env.PIPELINE_CAP` → `ARTICLE_CAP` (default 10, `:29`).
**`DRAFTER_CONTEXT` const (`:31-37`):** voiceProfile `lib/voice/raj-profile.md`, validator `lib/voice/validator.ts`, registry `lib/sources/registry.ts`, wordCount `{min:600,max:1200}`, output `content/news/YYYY-MM-DD-{slug}.ts`.

**`run()` (`:39-105`):**
1. `today = startedAt.slice(0,10)`.
2. **fetch:** `fetchRun = await fetchAllSources()` → `summarizeFetchRun` to console (log claims "20 sources" — stale; FETCH_SOURCES is 25).
3. **dedupe:** `flattenEntries(fetchRun)` → `dedupeEntries(allEntries)`.
4. **cluster:** `clusterAndScore(deduped, ARTICLE_CAP)`; logs top-3 with score breakdown + source names.
5. **write artifacts:** `mkdir -p pipeline-runs/<today>/`; write `clusters.json` (a `PipelineRun`: counts + `selected` clusters + `DRAFTER_CONTEXT`) and `fetch-log.txt` (the fetch summary).
6. Prints next-step (Phase-2 reads `clusters.json`).
`run().catch` → `console.error` + `process.exit(1)` (`:107-110`).
**Side effects:** filesystem writes only (`pipeline-runs/YYYY-MM-DD/clusters.json` + `fetch-log.txt`). No DB / no network beyond the fetchers.

---

### Cross-cutting notes & ⚠️ unresolved
- **"20 sources" is stale everywhere** (registry comment `:34`, index `:1`, cron log `:48`). Real `FETCH_SOURCES.length = 25` (24 aggregator + AGBI).
- **`fetchType:"scrape"`** declared in `SourceFetchType` (`:11`) but no scraper exists; `index.ts` routes any non-rss/non-reddit to `webfetch`.
- **`fetchWebPage` + `fetchReddit` are dead in the live run** — no `webfetch`/`reddit` source is in `FETCH_SOURCES` (all whitelist webfetch entries are citation-anchors; `REDDIT_FEEDS` disabled). Both stay fully wired for future use.
- **Two independent tier-rank tables:** `registry.TIER_WEIGHT` (floats, used in cluster scoring/sort) vs `dedupe.tierRank` (ints 1-5, used in dedupe sort). Same ordering, different scales — kept in sync manually.
- **`hashUrl`** is duplicated verbatim in `rss.ts:53` and `webfetch.ts:127`.
- ⚠️ unresolved: `lib/voice/raj-profile.md`, `lib/voice/validator.ts`, `lib/news-review/draft-engine.ts`, `content/news/*` — referenced by this subsystem (DrafterContext + extract.ts consumer) but belong to Phase-2 (out of scope here).
