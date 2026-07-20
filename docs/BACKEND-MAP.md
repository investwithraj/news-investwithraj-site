# news-investwithraj (news.investwithraj.com) — Complete Backend Map
> Generated today by the iwr-backend-map workflow · grounded in source · env var NAMES only (no secret values).

## Table of Contents
- [NEWS · Routing, Pages, Proxy & Cron](#news--routing-pages-proxy--cron)
- [NEWS · API Routes — Draft / Publish / Queue / Press](#news--api-routes--draft--publish--queue--press)
- [NEWS · API Routes — Content / Data / AI](#news--api-routes--content--data--ai)
- [NEWS · Ingestion Pipeline + Clustering](#news--ingestion-pipeline--clustering)
- [NEWS · Draft Engine + Auto-Approver (Gates) + GitHub Publish + Review UI](#news--draft-engine--auto-approver-gates--github-publish--review-ui)
- [NEWS · Distribution + Voice + AI Providers](#news--distribution--voice--ai-providers)
- [N7 · Market-Data Widgets, Stock/Cover, Press-Inbox, Queue, Content, Schema & ENV](#n7--market-data-widgets-stockcover-press-inbox-queue-content-schema--env)

## NEWS · Routing, Pages, Proxy & Cron

App-Router subsystem for `news.investwithraj.com`. Content is sourced from in-repo TypeScript registries (`content/*`, `lib/developers`, `lib/verticals`, `lib/sentiment`); the daily news pipeline is committed into `content/news` out-of-band (GitHub Actions, not this subsystem). Almost every public page is `force-static` (SSG) and pulls from those registries at build time. The cross-system relationship: this subdomain is the **child** of the IWR root brand (`investwithraj.com`) — JSON-LD `publisher`/`parentOrganization`/`founder` all reference `${SITE.rootUrl}#organization|#raj`, area/article footers deep-link UTM-tagged back to the root, and `SITE.rootUrl` is hardcoded in `lib/constants.ts:8`.

### Cross-cutting render-mode legend
- **SSG-static** = `export const dynamic = "force-static"` (`lib/constants` URL baked at build).
- **SSG-params** = static + `generateStaticParams()` (one HTML file per param).
- **ISR** = static + `export const revalidate = <seconds>`.
- **Dynamic** = `export const dynamic = "force-dynamic"` (rendered per-request).
- `dynamicParams = false` ⇒ params outside `generateStaticParams()` ⇒ 404.

---

### `app/layout.tsx` — Root layout (Server Component)
- **Purpose**: HTML shell, font wiring, global metadata + viewport, two site-wide JSON-LD blocks, persistent chrome.
- **Imports/deps**: `next/font/google` (`Space_Grotesk`, `Inter`, `JetBrains_Mono`, `Fraunces` — `layout.tsx:2`), `geist/font/{sans,mono}` (`:3-4`), `@vercel/analytics/next` (`:5`), `@vercel/speed-insights/next` (`:6`), `@/lib/constants` `{SITE, CONTACT}` (`:7`), plus client chrome components: `ConsentRoot`, `CustomCursor`, `FxProvider`, `DldTicker`, `PageLoadCurtain`, `AmbientAudio`, `KonamiEasterEgg`, `UISounds` (`:8-15`).
- **Exports**: `viewport` (`:46` — `themeColor #F8FAFC`, `colorScheme light`, `maximumScale 5`), `metadata` (`:54`), default `RootLayout` (`:164`).
- **`metadata`** (`:54-130`): `metadataBase = new URL(SITE.url)`; title template `%s · Invest With Raj` (`:58`); robots index+follow with `max-image-preview:large` (`:81-93`); `alternates.canonical = SITE.url` + RSS `application/rss+xml` → `${SITE.url}/rss.xml` (`:94-99`); OpenGraph `type website` (`:100`); Twitter `summary_large_image`, site `@investwithraj`, creator `@rajtomar_dxb` (`:108-114`); icon `/icon.svg` (`:116`); **Vision Pro hints** `apple-spatial-capable:yes` + `apple-spatial-alternate → ${SITE.url}/spatial` (`:126-128`).
- **JSON-LD (inline `<script type=application/ld+json>`, `:188-195`)**: `websiteSchema` (`@type WebSite`, `@id ${SITE.url}#website`, `publisher @id ${SITE.rootUrl}#organization`, `SearchAction` target `${SITE.url}/?q={search_term_string}` — `:134-148`) and `newsOrgSchema` (`@type NewsMediaOrganization`, `parentOrganization`/`founder` → root, ethics/diversity policies → `/about/editorial-standards`, masthead `/about` — `:150-162`).
- **Pre-paint script** (`:176-180`): clears stale `data-theme` + `iwr-theme`/`nexus-theme` localStorage → forces light theme.
- **Body chrome** (`:198-238`): `PageLoadCurtain`, `FxProvider` wrapping `DldTicker` + `children`, `CustomCursor`, `AmbientAudio`, `UISounds`, `KonamiEasterEgg`, `.film-grain` overlay, `Analytics`, `SpeedInsights`, `ConsentRoot` (GDPR/PDPL), hidden `sr-only` `CONTACT.email` link.
- **Env**: none direct (via `SITE` → `NEXT_PUBLIC_SITE_URL`).

### `app/template.tsx` — Per-navigation template (Client Component, `"use client"`)
- **Purpose**: inter-route transition curtain (charcoal wipe) keyed on `usePathname()` (`template.tsx:17-31`); honors `prefers-reduced-motion` (`:22`). Wraps every page beneath the layout. No data/env.

### `app/not-found.tsx` — 404 page (Client Component)
- Cartier-grade 404, Fraunces "404", magnetic CTA `<Link href="/">` (`not-found.tsx:85`). RAF title-pulse gated on reduced-motion (`:17`). No data/env.

### `app/icon.svg` — Favicon (static asset, referenced by `metadata.icons` in layout).

---

### Page routes

| Route | File | Dynamic seg | Render mode | `revalidate` | `dynamicParams` |
|---|---|---|---|---|---|
| `/` | `app/page.tsx` | — | (default static; no flag) | — | — |
| `/news` | `app/news/page.tsx` | — | ISR | **3600** | — |
| `/news/[slug]` | `app/news/[slug]/page.tsx` | `slug` | SSG-params | — | **false** |
| `/areas` | `app/areas/page.tsx` | — | SSG-static | — | — |
| `/areas/[slug]` | `app/areas/[slug]/page.tsx` | `slug` | SSG-params + ISR | **86400** | **false** |
| `/developers` | `app/developers/page.tsx` | — | SSG-static | — | — |
| `/developer/[slug]` | `app/developer/[slug]/page.tsx` | `slug` | SSG-params | — | **false** |
| `/power-list/[year]` | `app/power-list/[year]/page.tsx` | `year` | SSG-params | — | **false** |
| `/pulse` | `app/pulse/page.tsx` | — | Dynamic | — | — |
| `/terminal` | `app/terminal/page.tsx` | — | SSG-static | — | — |
| `/spatial` | `app/spatial/page.tsx` | — | SSG-static | — | — |
| `/map` | `app/map/page.tsx` | — | SSG-static | — | — |
| `/wallet` | `app/wallet/page.tsx` | — | SSG-static | — | — |
| `/closing-bell` | `app/closing-bell/page.tsx` | — | SSG-static | — | — |
| `/ask` | `app/ask/page.tsx` | — | SSG-static (client island) | — | — |
| `/v/[slug]` | `app/v/[slug]/page.tsx` | `slug` | SSG-params | — | **false** |
| `/internal/dashboard` | `app/internal/dashboard/page.tsx` | — | Dynamic (auth-gated) | — | — |
| `/internal/review` | `app/internal/review/page.tsx` | — | Dynamic (auth-gated) | — | — |

#### `/` — Home / immersive Terminal (`app/page.tsx`)
- **Render**: no `dynamic`/`revalidate` export ⇒ Next default static render.
- **Purpose**: dark "v17" immersive Terminal (promoted from former `/v17` in the v1.1 cutover; `page.tsx:1-7`). Suppresses the root cream chrome (`DldTicker`/curtain/ambient) on the home only via `<V17BodyFlag/>` setting `body[data-v17-route]` + scoped `<style>` (`:27-29, 56-62`).
- **metadata** (`:17-22`): title `The Terminal — Dubai Real Estate in Real Time | Invest With Raj`, robots index+follow. No JSON-LD beyond layout.
- **Composition**: client acts `TerminalAct`, `CapitalFlowAct`, `DailyAnchorAct`, `VerticalsAct`, `CrossLinkAct` (`:11-15, 47-51`) + `V17EdgeNav` corner chrome (`:9, 37`).
- **Feeds**: none directly (acts self-source). **Env**: none.

#### `/news` — Article index (`app/news/page.tsx`)
- **Render**: `dynamic="force-static"` + `revalidate=3600` (ISR hourly) (`news/page.tsx:9-10`).
- **Feeds**: `NEWS_ARTICLES` + `sortNewsArticles` from `@/content/news` (`:5, 23`). Lists every article most-recent-first; cards link `/news/${slug}`.
- **metadata** (`:12-20`): canonical `${SITE.url}/news` + RSS alternate. No per-page JSON-LD.

#### `/news/[slug]` — Article page (`app/news/[slug]/page.tsx`)
- **Render**: `dynamicParams=false` + `dynamic="force-static"` (`:20-21`); `generateStaticParams()` → `getAllNewsSlugs()` (`:23-25`).
- **Feeds**: `getNewsBySlug`, `getAllNewsSlugs` (`@/content/news`); renders `SemaformLayout` (`@/components/article/SemaformLayout`, `:100`); `notFound()` on miss (`:73`).
- **`generateMetadata`** (`:27-64`): title/desc from article; canonical `${SITE.url}/news/${slug}`; OG `type article` with `publishedTime`/`modifiedTime`, `authors:[${SITE.rootUrl}#raj]`, tags `[category, ...market]`; **OG image always routed through `${SITE.url}/api/og?slug=${slug}`** (`:41, 55`) with fallback to `article.heroImage.src`; Twitter `summary_large_image`.
- **JSON-LD** (`asGraph`, `:79-88`): `newsArticleSchema(article)` (Speakable inline) + optional `faqPageSchema(article.faq)` + `breadcrumbSchema(BREADCRUMB_PRESETS.news{slug,title})`. Helpers from `@/lib/schema` (dir: `article.ts:13/91`, `breadcrumb.ts:13/33`, `index.ts:21`). `speakableSchema` imported but `void`-ed (`:92`).

#### `/areas` — Areas index (`app/areas/page.tsx`)
- **Render**: `dynamic="force-static"` (`:9`).
- **Feeds**: `AREAS`, `sortAreas`, `filterByEmirate` (`@/content/areas`); grouped Dubai / Abu Dhabi / Ras Al Khaimah (`:19-21`); cards → `/areas/${slug}`.
- **metadata** (`:11-16`): canonical `${SITE.url}/areas`. No JSON-LD.

#### `/areas/[slug]` — Area landing (`app/areas/[slug]/page.tsx`)
- **Render**: `dynamicParams=false` + `dynamic="force-static"` (`:25-26`); `revalidate=86400` (ISR daily, `:339`); `generateStaticParams()` → `getAllAreaSlugs()` (`:28-30`).
- **Feeds**: `getAreaBySlug`/`getAllAreaSlugs` (`@/content/areas`), `NEWS_ARTICLES` (related-news filter by emirate, `:63-65`), `getDevelopersForArea` (`@/lib/developers`, `:62`), `<Price>` FX-converted via `@/components/ticker/FxProvider` (`:177`). `notFound()` on miss (`:60`).
- **`generateMetadata`** (`:32-51`): canonical `${SITE.url}/areas/${slug}`; OG with `a.heroImage.src` if present.
- **JSON-LD** (`asGraph`, `:67-71`): `placeSchema(a)` + `realEstateAgentSchema(a)` (`@/lib/schema/area.ts:9/37`) + `breadcrumbSchema(BREADCRUMB_PRESETS.area)`.
- **Cross-system link** (`:307-332`): if `a.iwrNoteSlug`, renders deep link to `${SITE.rootUrl}/?utm_source=news&utm_medium=area-page&utm_campaign=note-cross-link&utm_content=${iwrNoteSlug}`.

#### `/developers` — Developers index (`app/developers/page.tsx`)
- **Render**: `dynamic="force-static"` (`:9`). **Feeds**: `DEVELOPERS` (`@/lib/developers`); cards → `/developer/${slug}`. **metadata**: canonical `${SITE.url}/developers` (`:11-16`). No JSON-LD.

#### `/developer/[slug]` — Developer landing (`app/developer/[slug]/page.tsx`)
- **Render**: `dynamicParams=false` + `dynamic="force-static"` (`:20-21`); `generateStaticParams()` → `getAllDeveloperSlugs()` (`:23-25`). No `revalidate`.
- **Feeds**: `getDeveloperBySlug`/`getAllDeveloperSlugs`/`DEVELOPERS` (`@/lib/developers`), `AREAS` (active-areas filter, `:56`), `NEWS_ARTICLES` (related-news by name match, `:57-59`). `notFound()` on miss (`:54`).
- **`generateMetadata`** (`:27-45`): canonical `${SITE.url}/developer/${slug}`.
- **JSON-LD** (inline, `:62-83`): hand-built `@type Organization` (`@id …/developer/${slug}#org`, `foundingLocation` Place→UAE, optional `tickerSymbol`). NOT via `asGraph`.

#### `/power-list/[year]` — Annual Power List (`app/power-list/[year]/page.tsx`)
- **Render**: `dynamic="force-static"` (`:11`) + `dynamicParams=false` (`:22`); `generateStaticParams()` → `getAllPowerListYears()` **plus** the current year (`new Date().getFullYear()`) injected so the in-production stub renders (`:15-20`).
- **Feeds**: `getPowerListByYear`/`getAllPowerListYears` + type `PowerListCategory` (`@/content/power-list`). Renders stub when no list/empty entries (`:119-134`); else ranked `<ol>` with rank-delta arrows (`:136-184`). `CATEGORY_COLOR` map (`:37-45`).
- **Guard**: `notFound()` if `year` not `/^\d{4}$/` (`:56`).
- **`generateMetadata`** (`:24-35`): canonical `${SITE.url}/power-list/${year}`. No JSON-LD.

#### `/pulse` — Sentiment heatmap (`app/pulse/page.tsx`)
- **Render**: `dynamic="force-dynamic"` (`:12`) — only non-internal page rendered per-request.
- **Feeds**: `getMockSentimentSnapshot` (`@/lib/sentiment/mock`), `scoreToColor`/`scoreToInk` (`@/lib/sentiment/types`). Splits signals into area/developer, plus `byChannel` aggregate strip (`:22-32`). Cards link `/areas/${subject}` or `/developer/${subject}` (`:158-159`).
- **metadata** (`:14-19`): canonical `${SITE.url}/pulse`. (Mock data; copy says "refreshes every 30m".)

#### `/terminal` — Bloomberg-style terminal (`app/terminal/page.tsx`)
- **Render**: `dynamic="force-static"` (`:12`). **Feeds**: `NEWS_ARTICLES` (first 12 headlines), `AREAS` (first 20), `CLOSING_BELLS` (first 4) → props to client `TerminalShell` (`@/components/terminal/TerminalShell`, `:22-41`). **metadata**: canonical `${SITE.url}/terminal` (`:14-19`).

#### `/spatial` — Vision Pro landing (`app/spatial/page.tsx`)
- **Render**: `dynamic="force-static"` (`:18`). **Feeds**: `VERTICALS` (`@/lib/verticals`) → floating glass cards linking `/v/${slug}` (`:100-103`).
- **metadata** (`:20-33`): canonical `${SITE.url}/spatial` + `other` visionOS hints (`apple-spatial-content`, `…-default-content-mode:spatial`, `…-floating-windows`, min width/height). This is the `apple-spatial-alternate` target declared in the root layout.

#### `/map` — DLD velocity heatmap (`app/map/page.tsx`)
- **Render**: `dynamic="force-static"` (`:15`). **Feeds**: `AREAS` (with `coords.lat/lng`) merged with `getMockSentimentSnapshot` (`@/lib/sentiment/mock`) → SVG node map; `projectToSvg` lat/lng→x/y over `UAE_BOUNDS` (`:25-43, 54-64`). Nodes `<a href=/areas/${slug}>`.
- **Upgrade path**: SVG fallback Day-1; client upgrades to Mapbox 3D when `NEXT_PUBLIC_MAPBOX_TOKEN` is set (referenced in copy only, `:108, 256`).
- **metadata**: canonical `${SITE.url}/map` (`:17-22`). No JSON-LD.
- ⚠️ unresolved: no Mapbox client component is imported in this file — the "upgrades to … Mapbox" path (`:5-6`) is not wired in the page itself.

#### `/wallet` — Wallet pass install (`app/wallet/page.tsx`)
- **Render**: `dynamic="force-static"` (`:10`). **Feeds**: none (static marketing). CTAs link `/api/wallet/install?platform=apple|google` (`:141, 149`). **metadata**: canonical `${SITE.url}/wallet` (`:12-17`).

#### `/closing-bell` — EOD flash archive (`app/closing-bell/page.tsx`)
- **Render**: `dynamic="force-static"` (`:9`). **Feeds**: `CLOSING_BELLS` + `sortBells` (`@/content/closing-bell`); cards link **`/closing-bell/${b.slug}`** (`:77`).
- **metadata**: canonical `${SITE.url}/closing-bell` (`:11-16`). No JSON-LD.
- ⚠️ unresolved: detail route `app/closing-bell/[slug]/page.tsx` **does not exist** — index cards link to a route with no handler (would 404).

#### `/ask` — AI brief UI (`app/ask/page.tsx`)
- **Render**: `dynamic="force-static"` (`:11`); interactivity via client island `AskRajClient` (`./AskRajClient`, `:9, 70`) — which calls the AI brief API (see `app/api/brief/route.ts`, sibling subsystem).
- **metadata**: canonical `${SITE.url}/ask` (`:13-18`). No JSON-LD.

#### `/v/[slug]` — Vertical stream (`app/v/[slug]/page.tsx`)
- **Render**: `dynamicParams=false` + `dynamic="force-static"` (`:15-16`); `generateStaticParams()` → `VERTICALS.map(v=>{slug})` (`:18-20`). No `revalidate`.
- **Feeds**: `getVerticalBySlug`/`VERTICALS` (`@/lib/verticals`); filters `NEWS_ARTICLES` where `v.categories.includes(a.category)`, sorted by `publishedAt` desc (`:52-54`). Cards → `/news/${slug}`. `notFound()` on miss (`:49`).
- **`generateMetadata`** (`:22-40`): canonical `${SITE.url}/v/${slug}`. No JSON-LD.

#### `/internal/dashboard` — Outreach approval queue (`app/internal/dashboard/page.tsx`)
- **Render**: `dynamic="force-dynamic"` (`:16`). **Auth**: `proxy.ts` Basic-Auth gate on `/internal/*` (file comment says "middleware" — actual gate is `proxy.ts`).
- **Side effects/feeds**: `await runExpirySweep()` on every render (idempotent, `@/lib/queue/expiry`, `:20`); parallel `getPendingItems`/`getUrgentItems(4)`/`getQueueStats`/`getAllItems` (`@/lib/queue/storage`, `:22-27`); `recentActivity` = posted/skipped/expired in last 24h (`:30-39`); `getStorageBackend()` (`:41`); `CHANNEL_POLICIES` (`@/lib/queue/types`). Renders client `DashboardClient` (`:43-52`). No metadata export.

#### `/internal/review` — "The Desk" editorial review cockpit (`app/internal/review/page.tsx`)
- **Render**: `dynamic="force-dynamic"` (`:12`). **Auth**: `proxy.ts` Basic-Auth gate. `metadata.robots index:false,follow:false` (`:13-16`).
- **Feeds**: `getAllDrafts`/`getStorageBackend` (`@/lib/news-review/storage`, `:8`), `NEWS_ARTICLES` for live published-cadence stats (today / this-week counts, `:24-31`); computes `avgConfidence` from the 8-gate validator failures across drafts (`:34-48`). Renders client `ReviewDesk` (`:54-61`).
- **Env**: `POST_PUBLISH_SECRET` (`:59`) — passed to client as `actionSecret` so the cockpit's `/api/news/draft/*` fetches (which arrive unauthenticated, since Basic-Auth is scoped to `/internal/*`) can append `?secret=` (`:50-53`).

---

### Proxy / middleware

### `proxy.ts` — Basic-Auth gate (Next "proxy", formerly middleware)
- **Purpose**: HTTP Basic-Auth gate for **`/internal/*`** only (`config.matcher = "/internal/:path*"`, `proxy.ts:54-56`).
- **Logic** (`:10-52`): passes through any path not starting `/internal` (`:13-15`); if `INTERNAL_BASIC_AUTH` env unset → **503** "Internal dashboard disabled" (`:18-23`); missing/non-`Basic ` header → **401** with `WWW-Authenticate: Basic realm="news.investwithraj.com internal"` (`:25-33`); decodes via `atob`, malformed → **400** (`:35-40`); mismatch vs `INTERNAL_BASIC_AUTH` ("user:pass") → **401** (`:42-49`); else `NextResponse.next()`.
- **Env**: `INTERNAL_BASIC_AUTH` (`:8`).
- **Note**: this proxy does **NOT** mount/rewrite the `news.investwithraj.com` subdomain (that mount is a Vercel/DNS project binding, not code here). It is purely the `/internal` auth gate. No host-based rewrites exist in this file.

---

### Build/runtime config

### `next.config.ts`
- **Perf** (`:5-8`): `reactStrictMode`, `poweredByHeader:false` (strips `X-Powered-By`), `compress`, `productionBrowserSourceMaps:false`.
- **Images** (`:11-20`): AVIF→WebP formats; explicit `deviceSizes`/`imageSizes`; `minimumCacheTTL` 30 days; `dangerouslyAllowSVG:false`; `qualities` list.
- **`headers()`** (`:23-64`): security headers on `/(.*)` — `X-Content-Type-Options:nosniff`, `X-Frame-Options:SAMEORIGIN`, `Referrer-Policy:strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/`interest-cohort`/`browsing-topics` all off), `Strict-Transport-Security` (2yr, includeSubDomains, preload); long-immutable cache on static asset extensions; `/rss.xml` 1hr cache.
- **`redirects()`** (`:69-75`): **301** legacy version URLs → root — `/v17 → /`, `/v16 → /`, `/v16/:path* → /`. (Confirms the v1.1 cutover: Terminal serves at `/` directly, no redirect hop.)
- **`experimental`** (`:78-85`): `optimizeCss:false` (Tailwind v4 bug), `scrollRestoration:true`, `optimizePackageImports:["gsap","three","lenis"]`.

### `vercel.json` — Cron schedule
- **Single cron** (`vercel.json:3-5`): `{ "path": "/api/cron/draft", "schedule": "3 3 * * *" }`.
- **Schedule decode**: standard 5-field cron `min hr dom mon dow` = `3 3 * * *` ⇒ **minute 3, hour 3, every day** = **03:03 daily (UTC)** — Vercel crons run in UTC; 03:03 UTC = **07:03 GST (UTC+4)**, matching the "07:00 GST morning brief" copy across pages.
- **Target** (`app/api/cron/draft/route.ts`): daily draft generator. ⚠️ Per the file's own comment (`route.ts:1-7`) this Vercel cron is a **FALLBACK** — Claude `web_search` drafting exceeds the Hobby 60s cap (`maxDuration=60`, `:24`), so the real daily driver is `scripts/draft-once.ts` run by GitHub Actions (`.github/workflows/news-cron.yml`). Methods `GET`+`POST` both call `run()` (`:95-100`); auth = `Bearer ${CRON_SECRET}` or `Bearer ${POST_PUBLISH_SECRET}` or `?secret=${POST_PUBLISH_SECRET}` (`:30-38`); guards on `isClaudeConfigured()` else 503 (`:46`). Pipeline: `fetchAllSources`→`flattenEntries`→`dedupeEntries`→`clusterAndScore`→filter≥`PIPELINE_MIN_SCORE`→stage ≤`PIPELINE_CAP` drafts via `draftFromCluster` into KV (`addDraft`). Env: `CRON_SECRET`, `POST_PUBLISH_SECRET`, `ANTHROPIC_API_KEY` (via `isClaudeConfigured`), `PIPELINE_MIN_SCORE`, `PIPELINE_CAP`, `PIPELINE_MAX_ATTEMPTS`, `DRAFT_MODEL`. (Full pipeline detail belongs to the API/pipeline subsystem map.)

---

### Special / non-page routes (route handlers + metadata files)

### `app/rss.xml/route.ts` — RSS 2.0 feed
- **Method**: `GET` (`:17`). **Render**: `force-static` + `revalidate=3600` (ISR hourly, `:14-15`).
- **Purpose**: latest 30 entries (news + insights merged, sorted desc) for Feedly/Substack/Apple News/aggregators (`:1-8`).
- **Feeds**: `getLatestNews(20)` (`@/content/news`), `getLatestInsights(10)` (`@/content/insights`); insight `url` prefers `linkedinUrl` else `${SITE.url}/insights/${slug}` (`:44`); images absolutized vs `SITE.url` (`:37-39`). Channel `<image>` points to `${SITE.url}/api/og` (`:91`).
- **Output**: `application/rss+xml; charset=utf-8`, `Cache-Control public, max-age=3600, s-maxage=3600` (`:99-105`). `escapeXml` helper (`:108`). Uses `SITE`, `CONTACT.email`.

### `app/news-sitemap.xml/route.ts` — Google News sitemap
- **Method**: `GET` (`:15`). **Render**: `force-static` + `revalidate=3600` (`:9-10`).
- **Purpose**: Google-News-spec sitemap, **last-48hr articles only** (`:1-3`), submitted separately to Google News Publisher Center.
- **Feeds**: `getNewsForGoogleNewsSitemap()` (`@/content/news`); emits `<news:news>` with `publication_date`, `title`, `keywords` (`[category, ...market]`). Publication constants `Invest With Raj — Daily Market Read` / lang `en` (`:12-13`).
- **Output**: `application/xml; charset=utf-8`, 1hr cache (`:49-55`). `escapeXml` helper (`:58`).

### `app/llms.txt/route.ts` — AI-crawler discovery hint
- **Method**: `GET` (`:11`). **Render**: `force-static` + `revalidate=86400` (24hr) (`:8-9`).
- **Purpose**: llmstxt.org spec file for ChatGPT/Perplexity/Claude/Gemini/etc. — site map, editorial/AI-disclosure, 20-source whitelist, author credentials, content tiers, AI-training license terms (`:1-73`).
- **Feeds**: `SITE`, `CONTACT` (`linkedin`, `linkedinNewsletter`, `email`, `whatsappE164`). References `/sitemap.xml`, `/news-sitemap.xml`, `/rss.xml`, `/about`, `${SITE.rootUrl}`.
- **Output**: `text/plain; charset=utf-8`, 1hr cache (`:74-79`).

### `app/0d6e3835646ccbe5dba5ed6ab2646308.txt/route.ts` — IndexNow key file
- **Method**: `GET` (`:16`). **Render**: `force-static` + `revalidate=false` (never re-validate — constant, `:13-14`).
- **Purpose**: IndexNow ownership-verification key file; filename **must equal** the key value (32 hex chars). IndexNow servers fetch it to verify host ownership before accepting URL submissions (`:1-9`).
- **Feeds**: returns `INDEXNOW_KEY` from `@/lib/search/indexnow` — defined as `process.env.INDEXNOW_KEY || "0d6e3835646ccbe5dba5ed6ab2646308"` (`lib/search/indexnow.ts:29`); same module builds the submit body `keyLocation: ${SITE.url}/${INDEXNOW_KEY}.txt` (`indexnow.ts:80-81`). Rotation requires changing this filename AND the constant together.
- **Output**: `text/plain; charset=utf-8`, `max-age=86400, immutable` (`:18-22`). **Env**: `INDEXNOW_KEY`. (Submission endpoint lives at `app/api/indexnow/route.ts` — sibling subsystem.)

### `app/og/route.tsx` → actual path `app/api/og/route.tsx` — Dynamic OG image
- ⚠️ Path note: the brief listed `app/og/route.tsx`; the real file is **`app/api/og/route.tsx`** (consumed as `${SITE.url}/api/og` by `/news/[slug]` metadata and the RSS channel image).
- **Method**: `GET` (`:29`). **Runtime**: `nodejs` (not edge — stock-provider chain transitively imports `google-auth-library`, `:20-26`); `dynamic="force-dynamic"` (`:27`). CDN-cached aggressively.
- **Purpose**: renders a branded 1200×630 `ImageResponse` (`next/og`) — bg photo + navy gradient + Fraunces title + gold bar + `news.investwithraj.com` mark + category eyebrow + "By Raj Tomar" + photo credit.
- **Request shape** (query): `?slug=` (looks up article → title/category, and if no `bg`, fetches stock) OR explicit `?title=&bg=&credit=` (`:30-36`).
- **Feeds/calls**: `getNewsBySlug` (`@/content/news`); `findBestStockImage` + `triggerUnsplashDownload` (`@/lib/stock/providers`); `buildQueryForArticle` (`@/lib/stock/query-builder`) (`:18-19, 45-67`). Fires Unsplash download trigger fire-and-forget per ToS (`:70-75`).
- **Output**: `image/png` 1200×630 (`:255-260`). **Env**: none direct here (stock provider chain may use Unsplash/Pexels/Vertex keys — owned by the stock subsystem).

### `app/sitemap.ts` — Generic sitemap.xml (`MetadataRoute.Sitemap`)
- **Purpose**: enumerates every public URL from content registries; distinct from `/news-sitemap.xml` (`:9-16`). Auto-ISR hourly per Next.
- **Static URLs** (`:22-41`): `/`, `/news`, `/insights`, `/areas`, `/developers`, `/about`, `/about/editorial-standards`, `/legal/privacy`.
- **Dynamic** (`:44-91`): per `NEWS_ARTICLES` `/news/${slug}`, `INSIGHT_ARTICLES` `/insights/${slug}`, `AREAS` `/areas/${slug}`, `DEVELOPERS` `/developer/${slug}`, `VERTICALS` `/v/${slug}`. Feeds: `@/content/{news,insights,areas}`, `@/lib/{developers,verticals}`, `SITE`.

### `app/robots.ts` — robots.txt (`MetadataRoute.Robots`)
- `*`: allow `/`, disallow `/internal/` + `/api/` (`:6-12`). Explicit **allow** allowlist for ~26 AI/search/social bots (GPTBot, ClaudeBot, PerplexityBot, Googlebot, Bingbot, Applebot, FacebookBot, LinkedInBot, etc., `:14-44`). **Disallow** for AhrefsBot/MJ12bot/SemrushBot (`:46-49`). `sitemap:[/sitemap.xml, /news-sitemap.xml]`, `host:SITE.url` (`:51-52`).

---

### Unresolved / cross-system notes
- ⚠️ **Routes referenced but with no `app/**/page.tsx` handler** (would 404 on direct hit): `/insights` and `/insights/[slug]` (referenced in `sitemap.ts:25,54-61`, `rss.xml:44`, `llms.txt`), `/about` + `/about/editorial-standards` (layout JSON-LD + sitemap), `/legal/privacy` (sitemap), and **`/closing-bell/[slug]`** (linked from `closing-bell/page.tsx:77`). No `app/insights`, `app/about`, `app/legal`, or `app/closing-bell/[slug]` directories exist.
- ⚠️ `proxy.ts` header comment calls itself "middleware.ts" and `internal/dashboard/page.tsx:3` cites `middleware.ts`; the actual gate file is `proxy.ts`.
- **Other API route handlers present but outside this subsystem's scope** (documented elsewhere): `app/api/{anchor,brief,cover-image,daily-intro,digest,distribute,dld-pulse,fx,indexnow,post-publish,press-inbox,sentiment,stock-cover,translate,veo-test,vertex-test,voice}/route.ts`, `app/api/news/draft/...`, `app/api/queue/...`, `app/api/wallet/install/route.ts`.
- **Cross-system relationship to the main site**: news subdomain is the brand child of `investwithraj.com` — JSON-LD `publisher`/`parentOrganization`/`founder` → `${SITE.rootUrl}#organization`/`#raj` (`layout.tsx:142,156-157`); area pages + `rootCtaUrl()` (`constants.ts:31-42`) deep-link UTM-tagged to the root; `llms.txt` lists the root as "Personal brand site"; `dns-prefetch` to `investwithraj.com` (`layout.tsx:185`).

## NEWS · API Routes — Draft / Publish / Queue / Press

Pipeline overview (auto-news engine): **fetch sources → dedupe → cluster+score → draft (Claude web_search) → stage draft in KV → human review in The Desk cockpit → publish (one GitHub commit, Vercel auto-deploys) → post-publish search-engine fan-out**. Parallel rails: an **outreach queue** (per-channel drafts), a **press-inbox** poller (IMAP → JSON drafts), and a manual **IndexNow** trigger. The real daily driver is `scripts/draft-once.ts` (GitHub Actions, no time cap) which POSTs finished drafts to `/api/news/draft`; the `app/api/cron/draft` route is a same-process fallback. All routes are `runtime = "nodejs"` (where set) and `dynamic = "force-dynamic"` (never statically rendered/cached).

### Auth model (shared)

Two distinct guard families across this subsystem:

| Guard | Used by | Mechanism | Source |
| --- | --- | --- | --- |
| `authorize()` (dual-cred) | `/api/news/draft`, `/api/news/draft/[id]`, `/api/news/draft/[id]/publish` | Basic-Auth header `== INTERNAL_BASIC_AUTH` (cockpit, timing-safe) **OR** `?secret=` / `x-post-publish-secret` header `== POST_PUBLISH_SECRET` (server-to-server, timing-safe). 503 if neither env set; 401 otherwise. | `lib/news-review/auth.ts:52` |
| `?secret=` only | `/api/post-publish`, `/api/queue/add`, `/api/queue/action/[id]`, `/api/press-inbox`, `/api/indexnow` (POST) | `request.nextUrl.searchParams.get("secret") === POST_PUBLISH_SECRET`. 503 if `POST_PUBLISH_SECRET` unset; 401 if mismatch. NOT timing-safe (plain `!==`). | per-route module const |
| Bespoke (cron) | `/api/cron/draft` | `Authorization: Bearer ${CRON_SECRET}` **OR** `Bearer ${POST_PUBLISH_SECRET}` **OR** `?secret=${POST_PUBLISH_SECRET}`. | `app/api/cron/draft/route.ts:30` |
| none / open | `/api/queue/action/[id]` **GET**, `/api/queue/add` **GET**, `/api/post-publish` **GET**, `/api/press-inbox` **GET**, `/api/indexnow` **GET** | Read-only / docs / single-URL smoke test. | per-route |

`auth.ts` uses `timingSafeEq` (constant-time XOR compare, `lib/news-review/auth.ts:24`) and Base64-decodes the `Basic ` header via `atob`.

---

### `app/api/cron/draft/route.ts` — daily draft cron (FALLBACK trigger)

- **Purpose:** same-process run of the drafting engine; FALLBACK to the GitHub-Actions `draft-once.ts` driver because the web-research path (Claude `web_search`) routinely exceeds Vercel Hobby's 60s cap.
- **Config:** `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60` (`:22-24`).
- **Methods:** `GET` (`:95`) and `POST` (`:98`) — both call shared `run(req)` (`:44`).
- **Auth:** `authorized()` (`:30`) — Bearer `CRON_SECRET` or Bearer/`?secret=` `POST_PUBLISH_SECRET`. 401 if fails (`:45`). 503 if `!isClaudeConfigured()` (`:46`).
- **Tunables (env, parsed at module load):** `PIPELINE_MIN_SCORE` (default 45, `:26`), `PIPELINE_CAP` → `MAX_DRAFTS_PER_RUN` (default 1, `:27`), `PIPELINE_MAX_ATTEMPTS` (default 1, `:28`), `DRAFT_MODEL` (default `claude-haiku-4-5-20251001`, `:71`).
- **Flow / what it triggers** (`run()`, `:44-93`):
  1. `fetchAllSources()` → `flattenEntries()` (`lib/sources/fetchers`).
  2. `dedupeEntries()` (`lib/pipeline/dedupe`).
  3. `clusterAndScore(deduped, 12)` filtered `score >= MIN_SCORE` (`lib/pipeline/cluster`).
  4. `getAllDrafts()` (KV) → builds `draftedIds` set + `coveredTitles` (existing draft titles + today's non-`research` `NEWS_ARTICLES`); filters out already-drafted clusters and any whose topic has `similarity(...) >= 0.55` to a covered title (`:53-61`).
  5. `getWhitelistDomains()` (`lib/sources/registry`).
  6. Loop candidates up to `MAX_DRAFTS_PER_RUN`/`MAX_ATTEMPTS`: `draftFromCluster(cluster, whitelist, { model, maxSearches: 2, maxTokens: 3000 })`; on `r.ok` → `addDraft({ article, provenance })` (stages to KV, NEVER publishes) (`:67-80`).
- **Response (200):** `{ ok, fetched, deduped, clustersOverThreshold, candidatesUndrafted, attempted, staged, results:[{topic,ok,reason?}], ranAt }` (`:82-92`).
- **External services (transitively):** Anthropic Claude (`lib/ai/claude` — research/`web_search`), source RSS/HTTP fetchers, Upstash/Vercel KV (via `addDraft`/`getAllDrafts`), stock image providers (Wikimedia/Openverse via draft-engine).
- **Env referenced:** `CRON_SECRET`, `POST_PUBLISH_SECRET`, `PIPELINE_MIN_SCORE`, `PIPELINE_CAP`, `PIPELINE_MAX_ATTEMPTS`, `DRAFT_MODEL` (+ transitive `ANTHROPIC_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`).
- **Data fed:** `@/content/news` (`NEWS_ARTICLES`) for de-dup.

### `lib/news-review/draft-engine.ts` — shared drafting engine (feeds cron + CI)

- **`draftFromCluster(cluster, whitelist, opts)`** (`:132`) — research→parse→build→validate; returns `{ ok, reason?, article?, provenance? }`. Does NOT stage (caller decides: `addDraft()` server-side, or POST to `/api/news/draft` from CI).
- **`DRAFT_SYSTEM_PROMPT`** (`:27`) — newsroom voice rules (UK English, sourced numbers, banned phrases, 650–1100 words, JSON-only output w/ `skip` escape hatch).
- **`buildProvenance(cluster)`** (`:80`), **`buildCitations()`** (`:96`, whitelist-gated, ≤5), `slugify()` (`:76`).
- **Calls:** `callClaudeResearch()` (`lib/ai/claude`, temp 0.4, default `maxSearches:4`/`maxTokens:4200`); `validateDraft()` (`lib/voice/validator` — 8-gate, block-severity gates fail the draft, `:245`); `fetchArticleText()` (`lib/sources/extract`) for cited-figure verification; `findBestStockImage()` + `buildQueryForArticle()` (`lib/stock/*`); `rootCtaUrl()` (`lib/constants`).
- **Side effects:** none persistent (pure compute); strips `<cite>` tags from body, captures `citedText`, builds `DraftArticle` with hero image (Wikimedia/Openverse remote URL or `Dubai_aerial.jpg` fallback — self-hosted later at publish), enriches `provenance.sources` (≤24) with cited + `searchedUrls`.

---

### `app/api/news/draft/route.ts` — drafts collection (create + list)

- **Config:** `runtime = "nodejs"`, `dynamic = "force-dynamic"` (`:12-13`).
- **Auth:** `authorize()` (dual-cred) on both methods.

| Method | Purpose | Request | Response | Side effects |
| --- | --- | --- | --- | --- |
| `GET` (`:15`) | List all staged drafts | — | `{ ok, drafts: NewsDraft[], backend }` | none (KV read) |
| `POST` (`:24`) | Stage a drafted article into KV for review (NEVER publishes) | JSON `Partial<NewsDraftInput>`: `article{slug,title,body,citations[],...}` (required fields validated `:38-49`), `provenance?` (defaults to a `clusterId:"manual"` stub `:51`), `reviewNote?` | `{ ok, draft: NewsDraft }`; `400` on invalid JSON or missing fields | `addDraft()` → writes KV (`iwr:news:drafts`), runs 8-gate validator on write |

- **Calls:** `addDraft`, `getAllDrafts`, `getStorageBackend` (`lib/news-review/storage`); `authorize` (`lib/news-review/auth`).
- **Caller:** `scripts/draft-once.ts` (CI, `?secret=`) and the cockpit (Basic-Auth).
- **Env (transitive):** `INTERNAL_BASIC_AUTH`, `POST_PUBLISH_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

### `app/api/news/draft/[id]/route.ts` — single draft (edit + reject)

- **Dynamic segment:** `[id]` (`params: Promise<{id}>`, awaited). **Config:** `nodejs` + `force-dynamic`.
- **Auth:** `authorize()` (dual-cred) on both methods.

| Method | Purpose | Request | Response | Side effects |
| --- | --- | --- | --- | --- |
| `PATCH` (`:19`) | Edit draft; re-runs 8-gate validator when `article` changes | JSON `{ article?, reviewNote?, verifiedSources?[], provenance? }` (only provided keys patched, `:36-40`) | `{ ok, draft }`; `404` if not found; `400` invalid JSON | `updateDraft()` → KV write; validator recomputed if `article` present |
| `DELETE` (`:47`) | Reject/drop draft from KV (repo untouched) | — | `{ ok }`; `404` if not found | `deleteDraft()` → KV write |

- **Calls:** `updateDraft`, `deleteDraft` (`lib/news-review/storage`); `authorize`.

### `app/api/news/draft/[id]/publish/route.ts` — approve + publish (the ONE git write)

- **Dynamic segment:** `[id]`. **Config:** `nodejs` + `force-dynamic`. **Method:** `POST` only (`:26`).
- **Auth:** `authorize()` (dual-cred). Then **`githubConfigured()`** gate → 503 if `GITHUB_TOKEN` unset (`:30`).
- **Hard server-side gate:** loads draft (`getDraft`, 404 if missing `:39`); if `!draft.validator.ok` → **422** with block-severity `failures` (`:42-50`). Validator enforced server-side even though the cockpit soft-locks Approve until figures verified.
- **Flow:**
  1. `publishArticleCommit(slug, draft.article)` (`:56`, `lib/news-review/github`) — single atomic GitHub commit. On throw → **502** `GitHub commit failed: ...` (`:57-62`).
  2. `fireAndForget(req, url)` (`:67,75`) — best-effort POST to `${origin}/api/post-publish?secret=${POST_PUBLISH_SECRET}` with `{ newUrls:[url] }`; no-op if `POST_PUBLISH_SECRET` unset; failure swallowed (article already live).
  3. `deleteDraft(id)` (`:70`) — clears draft from KV now it lives in git.
- **Response (200):** `{ ok, slug, url, commitSha }`. URL = `${NEWS_SITE}/news/${slug}` where `NEWS_SITE = NEXT_PUBLIC_SITE_URL || "https://news.investwithraj.com"` (`:20`).
- **External services:** GitHub Git Data API, Wikimedia (hero image download), self `/api/post-publish` fan-out, KV.
- **Env:** `NEXT_PUBLIC_SITE_URL`, `POST_PUBLISH_SECRET` (+ via lib: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `INTERNAL_BASIC_AUTH`).

#### `lib/news-review/github.ts` — atomic publish commit (what `publishArticleCommit` does)

- **Env:** `GITHUB_TOKEN` (required; fine-grained PAT contents:write), `GITHUB_OWNER` (default `investwithraj`), `GITHUB_REPO` (default `news-investwithraj-site`), `GITHUB_BRANCH` (default `main`) (`:11-14`).
- **`githubConfigured()`** = `Boolean(TOKEN)` (`:17`). All calls via `gh<T>()` helper (`:21`) → `https://api.github.com`, headers `Authorization: Bearer`, `X-GitHub-Api-Version: 2022-11-28`, `cache:"no-store"`; throws on non-2xx.
- **Commit assembly** (`publishArticleCommit`, `:42`): (1) read branch ref + head commit tree; (2) GET `content/news/index.ts`, `patchIndex(currentIndex, slug)` (`./serialize`); (2b) **hero self-host** — if `heroImage.src` is remote `http(s)`, download it (Wikimedia 1600px thumbnail rewrite + original-URL retry, UA `InvestWithRajNewsBot/1.0`, content-type/size guards), create a blob at `public/news/<slug>/cover.<ext>`, rewrite `heroImage.src` to local path; non-fatal on failure (keeps remote URL — fixes the 404/generic-cover bug class); (3) blobs for `content/news/<slug>.ts` (`serializeArticle(finalArticle)`) + patched `index.ts`; (4) `git/trees` on `base_tree` incl. heroTree; (5) `git/commits` (message `news: publish <slug> (reviewed + approved)`, parent = head) then PATCH `git/refs/heads/<branch>` `force:false`. Returns commit SHA. **Vercel auto-deploys on the push.**

---

### `app/api/post-publish/route.ts` — search-engine fan-out webhook

- **Config:** `dynamic = "force-dynamic"` (no `runtime` override). 
- **Auth:** `?secret=` == `POST_PUBLISH_SECRET` (module const `:27`). 503 if unset (`:31`); 401 if mismatch (`:41`).
- **Called by:** the daily schedule-skill Claude session after commit/push; the `/publish` route's `fireAndForget`; optionally a Vercel Deploy Hook.

| Method | Purpose | Request | Response |
| --- | --- | --- | --- |
| `POST` (`:29`) | Fan out IndexNow + sitemap pings | JSON `{ newUrls?: string[], deploymentId?: string }` (empty body allowed; non-string entries filtered) | `{ ok, deploymentId, submittedUrlCount, indexNow, sitemapPings, elapsedMs, timestamp }`; **200** if all ok, **207** Multi-Status if partial |
| `GET` (`:91`) | Health check + self-documentation | — | static descriptor JSON (name/method/auth/body/fansOutTo/response) |

- **Side effects:** `Promise.all([ submitToIndexNow(newUrls) (or no-op if none), pingAllSitemaps() ])` (`:59-69`). `allOk = indexNowResult.ok && every sitemap ok` (`:73`).
- **Calls:** `submitToIndexNow` (`lib/search/indexnow`), `pingAllSitemaps` (`lib/search/google-ping`).
- **Env:** `POST_PUBLISH_SECRET` (+ via lib `INDEXNOW_KEY`).

#### `lib/search/indexnow.ts` — IndexNow client

- **`submitToIndexNow(urls)`** (`:45`) → POST `https://api.indexnow.org/IndexNow` (`:26`), body `{ host, key, keyLocation: ${SITE.url}/${INDEXNOW_KEY}.txt, urlList }`. Fans to Bing/Yandex/Yep/Seznam/Naver/IndexNow.org. Guards: empty list (ok no-op), >10,000 URLs (400), off-host URL rejection vs `SITE.url` host (`:60-76`). `ok = res.ok || 202`. Returns `{ ok, statusCode, message, submittedUrls }`.
- **Env:** `INDEXNOW_KEY` (default hard-coded site key `0d6e3835...`, `:29`). Imports `SITE` from `@/lib/constants`.

#### `lib/search/google-ping.ts` — sitemap pings (now NO-OP shims)

- Google `/ping` (deprecated mid-2023) and Bing `/ping` (retired 2024) are **dead** — `pingGoogleSitemap` (`:41`), `pingBingSitemap` (`:58`), and `pingAllSitemaps` (`:76`) all return synthesized `ok:true` "skipped/delegated" results (engine `indexnow-relay`) for `sitemap.xml` + `news-sitemap.xml`. Real submission is delegated to IndexNow + robots.txt crawl discovery. Imports `SITE`.

---

### `app/api/queue/add/route.ts` — outreach queue enqueue

- **Config:** `dynamic = "force-dynamic"`. **Auth (POST):** `?secret=` == `POST_PUBLISH_SECRET` (503 unset / 401 mismatch, `:48-56`). **GET open.**
- **Caller:** daily pipeline after articles committed (generates per-channel drafts, POSTs here).

| Method | Purpose | Request | Response |
| --- | --- | --- | --- |
| `GET` (`:27`) | Docs + live stats | — | descriptor + `{ storage, currentStats }` (`getQueueStats`, `getStorageBackend`) |
| `POST` (`:47`) | Add queue items | **Mode A** `{ items: QueueItem[] }` (validated shape: `channel/target/draftText/rationale` required, `sourceArticleSlug?/responseToUrl?`, `:71-88`) **OR** **Mode B** `{ slugs: string[], channels?: QueueChannel[] }` (default channels `[reddit, quora, haro, linkedin-comment]`) | Mode A: `{ ok, mode:"items", added, ids, timestamp }`; Mode B: `{ ok, mode:"slugs", articlesProcessed, missingSlugs, channelsRequested, drafted, ids, timestamp }`; `400` if neither shape |

- **Side effects:** Mode A → `addItems(partials)`. Mode B → look up slugs in `NEWS_ARTICLES`, `selectTopDrafts(generateDraftsForArticle(article), channels)`, `toQueuePartials()` → `addItems()`. Both write KV (`iwr:queue:items`).
- **Calls:** `addItems`, `getQueueStats`, `getStorageBackend` (`lib/queue/storage`); `generateDraftsForArticle`, `selectTopDrafts`, `toQueuePartials` (`lib/queue/draft-generators`); `NEWS_ARTICLES` (`@/content/news`).
- **Env:** `POST_PUBLISH_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

### `app/api/queue/action/[id]/route.ts` — queue item actions

- **Dynamic segment:** `[id]`. **Config:** `dynamic = "force-dynamic"`. **Auth (POST):** `?secret=` == `POST_PUBLISH_SECRET` (503/401, `:34-43`). **GET open** (returns the item, 404 if missing, `:136`).
- **POST** (`:30`): JSON `{ action, draftText?, editNote?, postedUrl? }`. `action ∈ VALID_ACTIONS = [approve, skip, edit, postpone, mark-posted, delete]` (`:21`, else 400). Loads item (404 if missing, `:71`). Per-action patch (`:78-120`):
  - `approve`→`status:approved`; `skip`→`skipped`; `edit`→requires non-empty `draftText` (400 else), sets `status:edited`+`draftText`+optional `editNote`; `postpone`→resets `expiresAt = calculateExpiresAt(channel, now)` + `status:pending`; `mark-posted`→`status:posted`+`postedAt`+optional `postedUrl`; `delete`→`deleteItem()` (500 on fail) returns early.
  - Non-delete → `updateItem(id, patch)` (500 on fail) → `{ ok, action, id, item, timestamp }`.
- **Calls:** `getItem`, `updateItem`, `deleteItem` (`lib/queue/storage`); `calculateExpiresAt` (`lib/queue/types`).
- **Side effects:** KV write (`iwr:queue:items`).
- **Env:** `POST_PUBLISH_SECRET`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`.

#### `lib/queue/storage.ts` — queue store (KV ⇄ file-system)

- KV key `iwr:queue:items`; Upstash REST (`GET /get/<key>`, `POST /set/<key>` text/plain) when `KV_REST_API_URL` + `KV_REST_API_TOKEN` set, else `pipeline-runs/queue.json` fs fallback (ephemeral on Vercel) (`:17-25`). API: `getAllItems/getItemsByStatus/getPendingItems/getItem/addItem/addItems/updateItem/deleteItem/expireStaleItems/getQueueStats/getStorageBackend`. IDs `crypto.randomUUID()`, `expiresAt` via `calculateExpiresAt(channel)`.

---

### `app/api/press-inbox/route.ts` — press release IMAP poller

- **Config:** `dynamic = "force-dynamic"`. **Auth (POST):** `?secret=` == `POST_PUBLISH_SECRET` (503 unset `:43` / 401 mismatch `:50`), then **`isImapConfigured()`** gate → 503 if IMAP env missing (`:54`). **GET open.**
- **Called by:** schedule-skill daily cron (after morning pipeline) + manual curl.

| Method | Purpose | Request | Response |
| --- | --- | --- | --- |
| `GET` (`:26`) | Health/listing | — | descriptor + `{ imapConfigured, currentDraftsInInbox, draftFiles[≤20] }` |
| `POST` (`:42`) | Poll unread press emails → PressDraft JSON files | JSON `{ markSeen?: boolean=true, minScore?: number=0 }` (empty body ok) | `{ ok, fetched, drafted, droppedByScore, markedSeen, minScore, drafts:[{slug,headline,tier,score,tags}], filePaths, elapsedMs, timestamp }` |

- **Flow** (`:75-88`): `fetchUnreadPressEmails()` → `buildDraft(e)` per email → keep `relevanceScore >= minScore` → `saveDrafts(kept)` (writes `content/press-inbound/<slug>.json` to **disk/git**, NOT KV) → if `shouldMarkSeen` (default true) `markSeen(keptUids)` (kept only; unrelated releases re-process next run).
- **Calls:** `fetchUnreadPressEmails`, `markSeen`, `isImapConfigured` (`lib/press-inbox/imap-client`); `buildDraft` (`lib/press-inbox/draft-builder`); `saveDrafts`, `listDrafts` (`lib/press-inbox/storage`).
- **External services:** IMAP server (e.g. `raj@news.investwithraj.com` mailbox).
- **Env (via `imap-client.ts`):** `IMAP_HOST`, `IMAP_PORT` (default 993), `IMAP_USERNAME`, `IMAP_PASSWORD`, `IMAP_MAILBOX` (default `INBOX`) (`lib/press-inbox/imap-client.ts:27-31`); `isImapConfigured()` requires HOST+USERNAME+PASSWORD. Route env: `POST_PUBLISH_SECRET`.
- **Storage note:** `lib/press-inbox/storage.ts` is file-system only (`content/press-inbound/`, committed to git); approved drafts hand-rewritten into `content/news/<slug>.ts`.

---

### `app/api/indexnow/route.ts` — manual IndexNow trigger

- **Config:** `dynamic = "force-dynamic"`.
- **GET** (`:21`): **open** read-only smoke test. `?url=<single>` → `submitToIndexNow([url])`; 400 if missing `url`; status `200` if `result.ok` else `500`.
- **POST** (`:33`): batch. Auth **only if** `POST_PUBLISH_SECRET` set (else open) — `?secret=` mismatch → 401 (`:35-40`). Body must be `{ urls: string[] }` (400 on invalid JSON / wrong shape, `:42-58`); non-string entries filtered; `submitToIndexNow(urls)` (≤10,000 per spec). Returns the `IndexNowResult`, status `200`/`500`.
- **Calls:** `submitToIndexNow` (`lib/search/indexnow`).
- **Env:** `POST_PUBLISH_SECRET`, `INDEXNOW_KEY` (via lib).

---

### Storage backends (cross-cutting)

| Store | KV key | Backend | Persists to git? |
| --- | --- | --- | --- |
| News drafts (`lib/news-review/storage.ts`) | `iwr:news:drafts` | Upstash/Vercel KV (REST) or `pipeline-runs/news-drafts.json` fs fallback | No — git write only at publish via `github.ts` |
| Outreach queue (`lib/queue/storage.ts`) | `iwr:queue:items` | same KV/fs pattern | No |
| Press inbox (`lib/press-inbox/storage.ts`) | — | file-system only (`content/press-inbound/*.json`) | Yes (committed) |

- KV selected when `KV_REST_API_URL` && `KV_REST_API_TOKEN` set (`getStorageBackend()` reports `"vercel-kv"` vs `"file-system"`). Both KV adapters tolerate `result` as array or JSON-string. News-draft `addDraft`/`updateDraft` recompute the 8-gate validator (`lib/voice/validator → validateDraft`) on every write.

### Complete env var inventory (NAMES only)

`CRON_SECRET`, `POST_PUBLISH_SECRET`, `INTERNAL_BASIC_AUTH`, `PIPELINE_MIN_SCORE`, `PIPELINE_CAP`, `PIPELINE_MAX_ATTEMPTS`, `DRAFT_MODEL`, `NEXT_PUBLIC_SITE_URL`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `INDEXNOW_KEY`, `IMAP_HOST`, `IMAP_PORT`, `IMAP_USERNAME`, `IMAP_PASSWORD`, `IMAP_MAILBOX`, and (transitive via `lib/ai/claude`) `ANTHROPIC_API_KEY`.

- ⚠️ unresolved: `lib/ai/claude` (`isClaudeConfigured`/`callClaudeResearch`), `lib/sources/*` (fetchers/registry/extract), `lib/pipeline/*` (dedupe/cluster/types), `lib/voice/validator` (the "8-gate" definitions), `lib/stock/*`, `lib/constants` (`SITE`, `rootCtaUrl`), `lib/queue/draft-generators`, `lib/press-inbox/draft-builder`, `lib/news-review/serialize` (`serializeArticle`/`patchIndex`) — referenced by these routes but outside this subsystem's file list; not opened in full here.

## NEWS · API Routes — Content / Data / AI

Subsystem of `news.investwithraj.com` (Next.js 16 App Router). 15 route files under `app/api/**`, grounded in `lib/**` clients + `content/**` registries. All routes are Route Handlers (`route.ts`) exporting `GET`/`POST`. Secret-gated mutation endpoints share one guard: `process.env.POST_PUBLISH_SECRET` compared against `?secret=` query param. AI public endpoints share an in-memory IP rate limiter (`lib/ai/rate-limit.ts`). The two `*-test` routes are **DIAGNOSTICS** (smoke tests; `vertex-test`/`veo-test` explicitly marked "remove after WIF validated").

### Cross-cutting guards & helpers
| Helper | File | Purpose | Env / notes |
|---|---|---|---|
| Secret guard | inline per-route | `const SECRET = process.env.POST_PUBLISH_SECRET`; 503 if unset, 401 if `?secret` mismatch | `POST_PUBLISH_SECRET` |
| Rate limit | `lib/ai/rate-limit.ts:20` `checkRateLimit(ip,{max,windowMs})` | In-memory `Map` per Vercel instance; not shared across instances (`lib/ai/rate-limit.ts:1-4` notes "replace with Vercel KV/Upstash") | none |
| Client IP | `lib/ai/rate-limit.ts:43` `getClientIp(headers)` | reads `x-forwarded-for` → `x-real-ip` → `"unknown"` | none |
| Claude client | `lib/ai/claude.ts` | `callClaude` (`:38`), `callClaudeResearch` (`:103`, server-side `web_search_20250305` tool, handles `pause_turn`), `isClaudeConfigured` (`:7`) → POST `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-5-20250929`) |
| ElevenLabs client | `lib/voice/elevenlabs.ts` | `synthesise` (`:56`) → POST `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`; `synthesiseToDataUrl` (`:108`); `isElevenConfigured` (`:27`). Locked Raj "Reel-1 Emotional" settings | `ELEVENLABS_API_KEY`, `ELEVENLABS_RAJ_VOICE_ID` (default `3PmZaGGPRbZDCjAl7KBE`), `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`), `ELEVENLABS_STABILITY` (0.40), `ELEVENLABS_SIMILARITY` (0.88), `ELEVENLABS_STYLE` (0.20), `ELEVENLABS_SPEED` (1.0) |
| Gemini client | `lib/ai/gemini.ts` | `generateVideo` (`:35` → `:predictLongRunning`), `getVideoOperation` (`:69`), `buildDailyIntroPrompt` (`:100`), `isGeminiConfigured` (`:12`) → `generativelanguage.googleapis.com/v1beta` | `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_VIDEO_MODEL` (default `veo-3.0-generate-preview`) |
| Vertex AI client (WIF) | `lib/ai/vertex.ts` | `generateImage` (Imagen 4, `:131`), `startVideoGeneration`/`pollVideoGeneration` (Veo 3, `:231`/`:288`), `isVertexConfigured` (`:37`). Auth via `ExternalAccountClient` (`google-auth-library`) + Vercel OIDC (`@vercel/oidc`) → STS exchange → SA impersonation. NO static key. | `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`; optional `VERTEX_LOCATION` (us-central1), `VERTEX_IMAGEN_MODEL` (imagen-4.0-fast-generate-001), `VERTEX_VEO_MODEL` (veo-3.0-generate-001) |
| Higgsfield client | `lib/ai/higgsfield.ts` | `generateImage` (Soul model, `:36`), `buildArticleCoverPrompt` (`:75`), `isHiggsfieldConfigured` (`:11`) → POST `{base}/v1/images/generate` | `HIGGSFIELD_API_KEY`, `HIGGSFIELD_BASE_URL` (default `https://api.higgsfield.ai`) |
| Anchor store | `lib/anchor/store.ts` | `readCurrentAnchor`/`writeCurrentAnchor` (`:118`/`:122`); dual adapter: Vercel KV (Upstash REST) when `KV_*` set, else filesystem `pipeline-runs/daily-anchor.json`. Archives prior day on date change | `KV_REST_API_URL`, `KV_REST_API_TOKEN`; KV keys `iwr:anchor:current`, `iwr:anchor:archive:{date}` |

---

### `app/api/anchor/route.ts` — Daily Anchor pipeline (AI orchestrator)
- **Render mode:** `dynamic = "force-dynamic"`, `runtime = "nodejs"`, `maxDuration = 300` (`:28-32`).
- **Methods:** `GET` (state), `POST` (run/refresh pipeline).
- **Auth:** `POST` secret-gated (`POST_PUBLISH_SECRET`, `:56`/`:92-98`). `GET` open.
- **Imports / data feeds:** `callClaude`+`isClaudeConfigured` (`lib/ai/claude`); `synthesise`+`isElevenConfigured` (`lib/voice/elevenlabs`); `searchStockVideo`+`pickByDateSeed` (`lib/stock/video-providers`); `getLatestNews` (`content/news`); `readCurrentAnchor`/`writeCurrentAnchor` (`lib/anchor/store`); type `DailyAnchor` (`content/daily-anchor/types`).

| Method | Request | Response | Side effects |
|---|---|---|---|
| GET | — | `{ok,anchor}` (`:249`) or 404 `{ok:false,message}` if none (`:240`). `Cache-Control: s-maxage=300, swr=900` | none (read) |
| POST | `?secret`; body `{headline?, sourceSlug?, mode?: "script"\|"voice"\|"video"\|"full"}` (default `full`, `:112`) | `{ok,anchor}` / 503 / 502 / 400 / 401 | writes anchor state (KV or FS) at each stage |

- **State machine** (mode `full`): (1) pick headline — body override or `getLatestNews(1)[0].title` else default (`:114-119`); (2) **STAGE 1 script** — `generateScript` via `callClaude` with `SCRIPT_SYSTEM` (90s VO, 130-180 words, Raj voice rules; `:58-90`), `maxTokens:600 temp:0.5`; 503 if Claude unconfigured; (3) **STAGE 2 voice** — `synthesise` `mp3_44100_128`, embedded as **base64 data URL** in `anchor.audioUrl` (`:175-184`); 503 if ElevenLabs unconfigured; (4) **STAGE 3 video** — `searchStockVideo` (Pexels Videos) using `buildAnchorVideoQuery(headline)` (`:35-54`, emirate-keyworded B-roll), `pickByDateSeed(videos,today)` → sets `videoUrl`/`provider:"pexels-video"`/`videoCredit`/`videoSource`/`videoLicense` (`:195-228`); (5) final `state = audioUrl ? "ready" : "failed"` (`:231`).
- **External services:** Anthropic (script), ElevenLabs (TTS), Pexels Videos (B-roll). NO AI video here (uses real stock footage by design, `:187-194`).
- **DailyAnchor states** (`content/daily-anchor/types.ts:13-17`): `pending-script` → `pending-voice` → `pending-video` → `ready` / `failed`.

### `app/api/brief/route.ts` — F16 personalized AI brief
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc), `POST` (generate brief). **No secret** — public, rate-limited.
- **Auth/guard:** rate limit **5/hour/IP** (`checkRateLimit`, `:60`); 503 if `!isClaudeConfigured`.
- **Imports / feeds:** `callClaude`/`isClaudeConfigured`; `checkRateLimit`/`getClientIp`; `NEWS_ARTICLES` (`content/news`); `AREAS` (`content/areas`); `DEVELOPERS` (`lib/developers`).

| Method | Request | Response |
|---|---|---|
| GET | — | self-doc `{name,method,body,rateLimit,configured}` (`:131`) |
| POST | body `{topic:string}` (4-500 chars, `:80`) | `{ok,topic,brief,remaining,resetAt,tokens:{input,output},timestamp}` + headers `X-RateLimit-Remaining`/`-Reset`; 503/429/400/502 |

- **Logic:** `buildContextSnapshot` (`:33`) = 12 recent news + 18 areas + all developers, injected into prompt; `SYSTEM_PROMPT` "Beyond the Deal" editorial voice (400-600 words, `:19-31`); `callClaude` `maxTokens:1800 temp:0.5`.
- **External services:** Anthropic only. **Side effects:** none (no persistence). Env: `ANTHROPIC_API_KEY` (+`ANTHROPIC_MODEL`).

### `app/api/cover-image/route.ts` — F14 AI cover image (Higgsfield)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc), `POST` (generate).
- **Auth:** `POST` secret-gated (`POST_PUBLISH_SECRET`, `:19-28`); cron-fired after article commit when hero missing.
- **Imports / feeds:** `generateImage`+`buildArticleCoverPrompt`+`isHiggsfieldConfigured` (`lib/ai/higgsfield`); `getNewsBySlug` (`content/news`).

| Method | Request | Response |
|---|---|---|
| GET | — | self-doc (`:84`) |
| POST | `?secret`; body `{slug?, prompt?}` — prompt auto-built from article if absent (`:51-61`) | `{ok,slug,prompt,url,credits,timestamp}`; 503 (no key) / 401 / 400 / 404 (slug) / 502 |

- **External services:** Higgsfield Soul (`16:9`). **Side effects:** none persisted by route (returns Higgsfield CDN URL; cron embeds it). Env: `HIGGSFIELD_API_KEY` (+`HIGGSFIELD_BASE_URL`).
- ⚠️ Per MEMORY: cover pipeline noted broken (covers 404 / generic-remote) — route itself is intact; the consuming commit step needs the fix. `stock-cover` is the real-photo replacement (see below).

### `app/api/daily-intro/route.ts` — F13 cinematic intro (Gemini Veo 3)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc + current state), `POST` (start gen OR poll operation).
- **Auth:** `POST` secret-gated; 503 if `!isGeminiConfigured`.
- **Imports / feeds:** `generateVideo`/`getVideoOperation`/`buildDailyIntroPrompt`/`isGeminiConfigured` (`lib/ai/gemini`); `getLatestNews` (`content/news`); `node:fs`/`node:path`.

| Method | Request | Response | Side effects |
|---|---|---|---|
| GET | — | self-doc + `currentState` (read of state file) | reads `pipeline-runs/daily-intro.json` |
| POST mode A | body `{operationId}` | poll result; writes `{videoUrl,operationId,completedAt}` when ready | **writes** state file (`:63`) |
| POST mode B | body `{headline?, scene?}` | `{...start, prompt, headline}`; writes `{operationId,prompt,headline,startedAt}` (`:88`) | **writes** state file |

- **State persistence:** local file `pipeline-runs/daily-intro.json` via `fs` (`:24-38`) — NOT KV (ephemeral on Vercel; cron polls + writes URL for homepage to read).
- **External services:** Gemini Veo 3 (async long-running op). Env: `GEMINI_API_KEY` (+`GEMINI_BASE_URL`, `GEMINI_VIDEO_MODEL`).

### `app/api/digest/route.ts` — daily email digest (Listmonk)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc + config status), `POST` (build + send). Cron at 07:30 GST.
- **Auth:** `POST` secret-gated (`POST_PUBLISH_SECRET`).
- **Imports / feeds:** `NEWS_ARTICLES` (`content/news`); `buildDigestDraft` (`lib/distribute/digest-builder`); `isListmonkConfigured`/`sendListmonkDigest` (`lib/distribute/listmonk`).

| Method | Request | Response |
|---|---|---|
| GET | — | `{name,method,auth,body,listmonkConfigured,schedule}` (`:30`) |
| POST | `?secret`; body `{since?:ISO, preview?:bool}` (default lookback 24h, `:27`/`:66`) | preview → `{ok,preview,since,articleCount,subject,htmlBody,textBody}`; send → `{ok,since,articleCount,articleSlugs,subject,listmonk,timestamp}`; 503/401/400 |

- **Logic:** filter `NEWS_ARTICLES` by `publishedAt >= since` (`:78`); empty window → no-op 200 (`:82`); `buildDigestDraft(articles)` builds subject + table-based inline-CSS HTML + plaintext (`lib/distribute/digest-builder.ts`, uses `SITE`/`CONTACT` from `lib/constants`); `preview:true` returns HTML without sending.
- **External services:** Listmonk REST (`createListmonkCampaign` POST `/api/campaigns` → `setCampaignStatus` PUT `…/status` `running`), self-hosted + AWS SES. **Side effects:** creates + sends a real email campaign. Env: `LISTMONK_BASE_URL`, `LISTMONK_API_USERNAME`, `LISTMONK_API_TOKEN`, `LISTMONK_DIGEST_LIST_ID`, `LISTMONK_FROM_EMAIL`, `LISTMONK_FROM_NAME` (default "Raj Tomar"), `LISTMONK_TEMPLATE_ID` (optional).

### `app/api/distribute/route.ts` — social distribution orchestrator
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc + channel status), `POST` (distribute batch).
- **Auth:** `POST` secret-gated (`POST_PUBLISH_SECRET`).
- **Imports / feeds:** `distributeBatch`/`Channel`/`DEFAULT_PHASE_1_CHANNELS`/`getActiveChannels` (`lib/distribute`); `NEWS_ARTICLES` (`content/news`).

| Method | Request | Response |
|---|---|---|
| GET | — | self-doc + `channelStatus:{active,inactive,activeCount,inactiveCount}` via `getActiveChannels()` (`:21`) |
| POST | `?secret`; body `{slugs:string[], channels?:Channel[]}` | `{ok,processedArticles,missingSlugs,channelsRequested,totals:{scheduled,failed,skipped},runs,timestamp}`; HTTP **207** if any failure (`:102`); 503/401/400 |

- **Logic:** resolve slugs → articles, collect `missing` (`:76-80`); `distributeBatch` runs `distributeArticle` per article sequentially (`lib/distribute/index.ts:82`) — Postiz channels SCHEDULED (staggered via `scheduleTimeFor`), Telegram + Discord posted IMMEDIATELY.
- **External services (downstream via `lib/distribute/*`):**
  - **Postiz** (`postiz.ts`): `POSTIZ_BASE_URL`, `POSTIZ_API_TOKEN`, + per-channel IDs `POSTIZ_LINKEDIN_PERSONAL_ID`, `POSTIZ_LINKEDIN_COMPANY_ID`, `POSTIZ_X_ID`, `POSTIZ_FACEBOOK_ID`, `POSTIZ_INSTAGRAM_FEED_ID`, `POSTIZ_INSTAGRAM_STORIES_ID`, `POSTIZ_THREADS_ID`, `POSTIZ_TIKTOK_ID`, `POSTIZ_PINTEREST_ID`, `POSTIZ_BLUESKY_ID`, `POSTIZ_MASTODON_ID`, `POSTIZ_YOUTUBE_SHORTS_ID`.
  - **Telegram** (`telegram.ts`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`.
  - **Discord** (`discord.ts`): `DISCORD_WEBHOOK_URL`, `NEXT_PUBLIC_DISCORD_AVATAR_URL`.
  - Content adapter (`content-adapter.ts`): `NEXT_PUBLIC_SITE_URL`.
- **Side effects:** schedules/sends real social posts. Graceful skip per-channel when its env unset.

### `app/api/dld-pulse/route.ts` — DLD daily pulse (real data)
- **Render mode:** **ISR** `revalidate = 21600` (6h) (`:12`).
- **Methods:** `GET` only.
- **Auth:** open.
- **Imports / feeds:** `getDldPulse` (`lib/dld/pulse`).

| Method | Request | Response |
|---|---|---|
| GET | `?date=YYYY-MM-DD` (optional; **note:** `date` is accepted but `getDldPulse(_date)` ignores it — always returns latest live/reference) | `DldDailyPulse`; `Cache-Control: s-maxage=21600, swr=86400` |

- **Logic (`lib/dld/pulse.ts`):** `fetchLiveDldPulse` → Dubai Pulse OAuth client-credentials (`getPulseToken`, `:48`) → GET `…/open/dld/dld_transactions-open-api?limit=2000&sort=instance_date desc` → `aggregate()` rows into most-recent-day pulse (freshness guard ≤21d, ≥3 txns); on any failure falls back to **cited reference print** `getReferenceDldPulse()` (hard-coded official DLD weekly: AED 15.2B / 4,850 txns, week ending 2026-05-18). **No fabricated/random fallback** by design.
- **External services:** Dubai Pulse DLD open-data API. Env: `DLD_API_URL` (default `https://api.dubaipulse.gov.ae`), `DLD_API_KEY` (client_id), `DLD_API_SECRET` (client_secret). **Side effects:** none.

### `app/api/fx/route.ts` — FX rates
- **Render mode:** **ISR** `revalidate = 3600` (1h) (`:7`).
- **Methods:** `GET` only. Auth: open.
- **Imports / feeds:** `fetchFxRates` (`lib/fx/rates`).
- **Response:** `FxSnapshot {fetchedAt, source:"live"|"fallback", rates}`; `Cache-Control: s-maxage=3600, swr=21600`.
- **Logic (`lib/fx/rates.ts`):** GET `https://api.exchangerate.host/latest?base=AED&symbols=…` (keyless, ECB-derived); on failure returns hard-coded `FALLBACK_RATES` (`source:"fallback"`). Currencies: AED/USD/EUR/GBP/INR/SGD/HKD/CHF/JPY.
- **External services:** exchangerate.host (keyless — **no env var**). **Side effects:** none.

### `app/api/sentiment/route.ts` — sentiment heatmap (MOCK)
- **Render mode:** **ISR** `revalidate = 1800` (30m) (`:7`). Auth: open.
- **Methods:** `GET` only (synchronous, non-async).
- **Imports / feeds:** `getMockSentimentSnapshot` (`lib/sentiment/mock`).
- **Response:** `SentimentSnapshot {generatedAt, source:"mock", signals, byChannel}`; `Cache-Control: s-maxage=1800, swr=7200`.
- **Logic:** **fully mock** — date-seeded deterministic generation over `AREAS` (first 18) + `DEVELOPERS`, across channels reddit/x/telegram/news/linkedin (`lib/sentiment/mock.ts`). Placeholder until real Reddit/X/Telegram scrapers + Claude classification wired (`:2`).
- **External services:** none. **No env vars.** **Side effects:** none.

### `app/api/stock-cover/route.ts` — real stock cover image fetcher
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (search), `POST` (find best, secret-gated). Replaces `/api/cover-image`'s Higgsfield call with real license-clean photos.
- **Auth:** `GET` open; `POST` secret-gated (`POST_PUBLISH_SECRET`).
- **Imports / feeds:** `searchStock`/`findBestStockImage` (`lib/stock/providers`); `buildQueryForArticle` (`lib/stock/query-builder`); `getNewsBySlug` (`content/news`).

| Method | Request | Response |
|---|---|---|
| GET | `?slug=` (auto-query) OR `?q=` | `{ok,query,count,results,timestamp}`; 404 (slug) / 400 (neither) |
| POST | `?secret`; body `{slug?, q?}` | `{ok,slug,query,image,timestamp}` (best single match); 503/401/400/404 |

- **Logic:** `buildQueryForArticle` maps developer/area/landmark/category → tuned search string (`lib/stock/query-builder.ts`). `searchStock` (`lib/stock/providers.ts:465`) tries providers in parallel, broadens query on empty, last-resort synthetic; `findBestStockImage` relevance-ranks (provider trust, aspect, served-width, geo/junk/emirate penalties, `rankStock` `:552`).
- **External services (`lib/stock/providers.ts`):** Unsplash (`UNSPLASH_ACCESS_KEY`), Pexels (`PEXELS_API_KEY`), Wikimedia Commons (keyless), Openverse (keyless), Pixabay (`PIXABAY_API_KEY`), + Imagen 4 synthetic last-resort via lazy-imported `lib/ai/vertex` (Vertex WIF env vars; skipped when `allowSynthetic===false`). `triggerUnsplashDownload` fires Unsplash usage event. **Side effects:** none persisted by route (returns URL; cron embeds). Note `IMAGEN_MODEL` mentioned in header comment but generation now routes through Vertex.

### `app/api/translate/route.ts` — F18 translation (Claude)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc), `POST` (translate). Public, rate-limited.
- **Auth/guard:** rate limit **20/hour/IP** (`:36`); 503 if `!isClaudeConfigured`.
- **Imports / feeds:** `callClaude`/`isClaudeConfigured`; `checkRateLimit`/`getClientIp`.

| Method | Request | Response |
|---|---|---|
| GET | — | self-doc (`:90`) |
| POST | body `{text:string (1-8000), targetLang}` | `{ok,targetLang,languageName,translation,remaining,timestamp}`; 503/429/400/502 |

- **Supported langs (`:12`):** ar, hi, zh, ru, fr, de, es, ja, ko (mapped to full names `:15-25`). `callClaude` `maxTokens:4000 temp:0.2`; preserves proper nouns/numerics/markdown/brand voice.
- **External services:** Anthropic only. **Side effects:** none. Env: `ANTHROPIC_API_KEY` (+`ANTHROPIC_MODEL`).

### `app/api/voice/route.ts` — Raj voice TTS (ElevenLabs)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` (self-doc), `POST` (synthesize). Public, rate-limited. Powers Voice Mode + Audio-article + Anchor VO.
- **Auth/guard:** rate limit **20/hour/IP** (`:29`); 503 if `!isElevenConfigured`.
- **Imports / feeds:** `synthesise`/`isElevenConfigured` (`lib/voice/elevenlabs`); `checkRateLimit`/`getClientIp`.

| Method | Request | Response |
|---|---|---|
| GET | — | self-doc incl. voice id + locked settings (`:68`) |
| POST | body `{text:string (1-5000), format?:"mp3"\|"pcm"}` | **raw audio bytes** `Content-Type: audio/mpeg` (or wav for pcm), `Cache-Control: private,no-store`, `X-RateLimit-Remaining` (`:58`); 503/429/400/502 |

- **External services:** ElevenLabs TTS (`mp3_44100_128` or `pcm_24000`). **Side effects:** none persisted. Env: `ELEVENLABS_API_KEY` (+ voice/model/settings overrides above).

### `app/api/veo-test/route.ts` — ⚠ DIAGNOSTIC (Vertex Veo 3 smoke test)
- **Render mode:** `dynamic = "force-dynamic"`, `runtime = "nodejs"`.
- **Methods:** `GET` only. **Auth:** secret-gated (`POST_PUBLISH_SECRET`).
- **Imports / feeds:** `isVertexConfigured`/`startVideoGeneration`/`pollVideoGeneration` (`lib/ai/vertex`).
- **Behavior:** no `?op` → starts a hard-coded Dubai-skyline Veo gen, returns `{mode:"start",result,elapsedMs,pollInstructions}`; with `?op=<operationName>` → polls, returns `{mode:"poll",operation,result,elapsedMs}`. Returns `{ok:false,configured:false}` if WIF unset.
- **External services:** Vertex AI Veo 3 (WIF). Env: the 5 `GCP_*` WIF vars (+`VERTEX_*`). Diagnostic — no persistence.

### `app/api/vertex-test/route.ts` — ⚠ DIAGNOSTIC (Vertex Imagen 4 / WIF smoke test)
- **Render mode:** `dynamic = "force-dynamic"`, `runtime = "nodejs"`. Header note: "Remove this route after the WIF flow is validated in production."
- **Methods:** `GET` only. **Auth:** secret-gated (`POST_PUBLISH_SECRET`).
- **Imports / feeds:** `isVertexConfigured`/`generateImage` (`lib/ai/vertex`).
- **Behavior:** verifies full chain Vercel OIDC → STS → impersonation → Imagen 4. If unconfigured, returns per-var boolean presence map for the 5 `GCP_*` vars (`:32-40`, values NOT printed — booleans only). On success returns `{ok,configured,generationOk,model,imageMimeType,imageBytesBase64Length,width,height,sampleDataUrlPrefix,elapsedMs}`.
- **External services:** Vertex AI Imagen 4 (WIF). Env: 5 `GCP_*` WIF vars + `VERTEX_IMAGEN_MODEL`. Diagnostic — no persistence.

### `app/api/wallet/install/route.ts` — Apple/Google Wallet pass (preview-only)
- **Render mode:** `dynamic = "force-dynamic"`.
- **Methods:** `GET` only. **Auth:** open.
- **Imports / feeds:** `getLatestNews` (`content/news`).

| `?platform=` | Behavior |
|---|---|
| `apple` | 503 if Apple certs unset; else **501** (signer not implemented yet) + `passPreview` |
| `google` | 503 if Google config unset; else **501** (JWT signer not implemented yet) + `passPreview` |
| `auto`/default | status `{name,apple:{configured,installUrl},google:{configured,installUrl},preview}` |

- **Logic:** builds `passPreview` from latest article (org name, headline, barcode deep-link, brand colors `:36-45`). Pass generation is **not implemented** — degrades to coming-soon.
- **External services:** none yet (PassKit/Google Wallet pending). **Env (presence-checked only):** `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_CERT_PASS`, `APPLE_WWDR_PEM`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`. **Side effects:** none.

---

### Render-mode / cache summary
| Route | Mode | revalidate / cache |
|---|---|---|
| anchor | force-dynamic, nodejs, maxDuration 300 | GET swr `s-maxage=300, swr=900` |
| brief | force-dynamic | none (no-store implied) |
| cover-image | force-dynamic | none |
| daily-intro | force-dynamic | none |
| digest | force-dynamic | none |
| distribute | force-dynamic | none |
| dld-pulse | **ISR 21600 (6h)** | `s-maxage=21600, swr=86400` |
| fx | **ISR 3600 (1h)** | `s-maxage=3600, swr=21600` |
| sentiment | **ISR 1800 (30m)** | `s-maxage=1800, swr=7200` |
| stock-cover | force-dynamic | none |
| translate | force-dynamic | none |
| voice | force-dynamic | `private, no-store` |
| veo-test (diag) | force-dynamic, nodejs | none |
| vertex-test (diag) | force-dynamic, nodejs | none |
| wallet/install | force-dynamic | none |

### Auth matrix
- **Secret-gated** (`POST_PUBLISH_SECRET` on the mutating verb): anchor POST, cover-image POST, daily-intro POST, digest POST, distribute POST, stock-cover POST, veo-test GET, vertex-test GET.
- **Rate-limited public** (no secret): brief POST (5/h/IP), translate POST (20/h/IP), voice POST (20/h/IP).
- **Fully open** (read-only): anchor GET, dld-pulse GET, fx GET, sentiment GET, stock-cover GET, wallet/install GET, all `GET` self-docs.

### External-service → endpoint index
| Service | Endpoints |
|---|---|
| Anthropic Claude | anchor (script), brief, translate |
| ElevenLabs | anchor (voice), voice |
| Gemini Veo 3 | daily-intro |
| Vertex AI (Imagen 4 / Veo 3, WIF) | vertex-test, veo-test, stock-cover (synthetic last-resort via lazy import) |
| Higgsfield Soul | cover-image |
| Pexels (Videos) | anchor (B-roll) |
| Unsplash / Pexels / Wikimedia / Openverse / Pixabay | stock-cover |
| exchangerate.host | fx |
| Dubai Pulse DLD | dld-pulse |
| Listmonk (+AWS SES) | digest |
| Postiz / Telegram / Discord | distribute |
| Apple PassKit / Google Wallet (pending) | wallet/install |
| Vercel KV (Upstash REST) / filesystem | anchor (store), daily-intro (FS file) |

### Notes / ⚠ unresolved
- `dld-pulse` `?date` param is read (`route.ts:15`) but discarded by `getDldPulse(_date)` (`lib/dld/pulse.ts:186`) — documented as today/latest-only.
- `stock-cover` header comment references env `IMAGEN_MODEL`/Imagen-3-via-Gemini, but the live path is Vertex Imagen 4 (`generateImagen` lazy-imports `lib/ai/vertex`); the Gemini-developer-API image path is deprecated.
- `wallet/install` and `sentiment` are intentional placeholders (501 / mock).
- Rate limiter is per-instance in-memory only — not durable across Vercel cold starts / multiple instances.
- `lib/developers.ts` (`DEVELOPERS`), `content/areas.ts` (`AREAS`), `content/news` (`NEWS_ARTICLES`/`getLatestNews`/`getNewsBySlug`), `lib/constants` (`SITE`/`CONTACT`), and the `*/types.ts` for distribute/sentiment/dld/stock are referenced data feeds — present and resolved.

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

## NEWS · Draft Engine + Auto-Approver (Gates) + GitHub Publish + Review UI

End-to-end flow: a scored **Cluster** → `draftFromCluster` (web-research + AI build + validate) → POST `/api/news/draft` → staged in **KV** as a `NewsDraft` (validator recomputed on write) → reviewed in **The Desk** (`/internal/review`) → POST `/api/news/draft/[id]/publish` → `publishArticleCommit` (one atomic GitHub commit of `content/news/<slug>.ts` + patched `index.ts` + self-hosted hero) → Vercel auto-deploy → draft cleared from KV. `scripts/draft-once.ts` is the autonomous CI driver that runs the pipeline + drafting and POSTs to the staging route.

> Naming note: the brief's "deterministic AUTO-APPROVER (~8 citation gates)" maps to **two cooperating layers** in this code: (a) the **8-gate validator** in `lib/voice/validator.ts` (`validateDraft`), recomputed on every draft write and **hard-enforced server-side at publish**, and (b) the **figure-traceability gate** in `draft-engine.ts` + `ReviewDesk.tsx` (every figure's digit-core must trace to a whitelisted cited source or `citedText`). There is **no fully-autonomous publish-without-human path in these files** — publish always requires `POST .../publish` and the validator must pass; the cockpit additionally soft-locks Approve behind a human "figures verified" tick. (The `MEMORY.md` "deterministic AUTO-APPROVER / `AUTO_APPROVE` kill-switch" lives in a *separate* `news-investwithraj-site` repo's `draft-once.ts`/PR #1, not present in this `news-investwithraj` tree — see ⚠️ unresolved at end.)

### `lib/news-review/draft-engine.ts` — research → build → validate one article

| Aspect | Detail |
|---|---|
| Purpose | Cluster → validated `DraftArticle` + `NewsDraftProvenance`. Does NOT stage; caller decides (`addDraft` server-side or POST from CI). `draft-engine.ts:8-10` |
| Key exports | `DRAFT_SYSTEM_PROMPT` (`:27-50`), `buildProvenance(cluster)` (`:80-94`), `buildCitations(...)` (`:96-128`, not exported), `draftFromCluster(cluster, whitelist, opts)` (`:132-289`) |
| Interfaces | `DraftAttempt {ok,reason?,article?,provenance?}` (`:63-68`); `DraftOpts {model?,maxSearches?,maxTokens?}` (`:70-74`); `DraftJson` (Claude output shape, `:52-61`) |
| AI model used | `callClaudeResearch` (Anthropic `web_search_20250305` tool, `name:"web_search"`), `maxSearches ?? 4`, `maxTokens ?? 4200`, `temperature 0.4` (`:143-155`). Model = `opts.model` else default `ANTHROPIC_MODEL` (`claude-sonnet-4-5-20250929`) — see claude.ts |
| Imports / deps | `callClaudeResearch` ← `@/lib/ai/claude`; `validateDraft`,`DraftArticle as ValidatorInput` ← `@/lib/voice/validator`; `fetchArticleText` ← `@/lib/sources/extract`; `rootCtaUrl` ← `@/lib/constants`; `findBestStockImage` ← `@/lib/stock/providers`; `buildQueryForArticle` ← `@/lib/stock/query-builder`; types ← `@/lib/pipeline/types` (`Cluster`), `./types`, `@/content/news/types` |
| External calls | Anthropic Messages API (via claude.ts); stock-image providers (Wikimedia/Openverse, `allowSynthetic:false` — no AI imagery for news, `:223-236`); `fetchArticleText(url)` HTTP-fetches each cited article's real body for the verify gate (`:259-263`) |
| Env vars | None read directly (delegates to claude.ts → `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`; stock providers read their own keys) |

**`DRAFT_SYSTEM_PROMPT` rules (the drafter's contract, `:27-50`):** every number/name/claim must be web-sourced (never invented); return `{"skip":true,"reason":...}` if <650 defensible words; UK English + em-dashes mandatory; **first paragraph must carry a specific sourced number**; banned buzzwords listed inline; ≥3 analytical-register terms; body 650–1100 words, no markdown headings. Output = single JSON object with `skip,title(≤88c),subtitle,tldr[3],body,faq[],citations[{source,url}]` and **2–5 citations** = real article URLs used.

**`draftFromCluster` algorithm (`:132-289`):**
- Builds a "STORY LEAD" prompt from up to 8 cluster entries (`:138-141,:148-153`).
- Calls `callClaudeResearch`; on `!ok || !text` → `{ok:false}` (`:157`).
- Parses first `{...}` JSON block; unparseable → fail; `skip` / missing `title`/`body`/`tldr` → fail with reason (`:159-168`).
- **Citation capture for verify gate:** extracts text inside `<cite index=…>…</cite>` spans Claude emits → `citedText` (figures Claude attributed to a source), then strips the tags for a clean `body` (`:171-180`).
- **Whitelist citation rule (`buildCitations`, `:96-128`):** keeps only citation URLs whose hostname (`www.` stripped) `=== w` or `endsWith(.w)` for a whitelist domain; dedupes; caps at 5. If zero survive, falls back to ≤3 cluster-entry domains that are in the whitelist. If still empty → `draftFromCluster` returns `{ok:false, reason:"no whitelisted citation"}` (`:182-183`). **This is the ≥1-whitelisted-cite rule at draft time.**
- Category coerced to one of `VALID_CATEGORIES` (else `"market-pulse"`, `:22-25,:185-187`); slug = `${YYYY-MM-DD}-${slugify(title)}` (`slugify` lowercases, dashes non-alnum, ≤60c, `:76-78,:190`).
- Builds `DraftArticle` (`:192-213`): `author:"raj-tomar"`, `tier:"news"`, `tldr` forced to 3-tuple, `heroImage.src` initially `/news/<slug>/cover.jpg`, `cta.href = rootCtaUrl({campaign:"news_auto_draft",content:"newsletter-cta"})`.
- **Hero sourcing (`:215-243`):** `findBestStockImage` (landscape, minWidth 1200, rights-clean, no synthetic). If none found / not an `http(s)` URL → hard fallback `MARKET_HERO_FALLBACK = https://upload.wikimedia.org/wikipedia/commons/d/d3/Dubai_aerial.jpg` (credit "Wikimedia Commons") so an article never ships with a dead placeholder cover.
- **Validation gate (`:245-251`):** `validateDraft(article)`; if not ok → `{ok:false, reason:"failed gates: "+ <block-severity gate names>}`.
- **Provenance enrichment (`:253-286`):** `buildProvenance` (cluster id/topic/score/breakdown + ≤12 cluster sources) then appends (a) each citation with its **fetched real article text** (`fetchArticleText`, tier `"national-press"`) and (b) every URL `web_search` surfaced (`res.searchedUrls`); capped at 24; sets `provenance.citedText` to the per-citation `{c,text}` array.
- Returns `{ok:true, article, provenance}`.

### `lib/voice/validator.ts` — the 8-gate validator (`validateDraft`)

| Aspect | Detail |
|---|---|
| Purpose | Programmatic editorial gate; mirrors `raj-profile.md`; recomputed on every draft write; **the publish hard-gate**. `validator.ts:1-13` |
| Key exports | `validateDraft(article): ValidationResult` (`:173-314`); `summarizeResult` (`:326`); lexicon consts `BANNED_LEXICON` (`:19-57`), `APPROVED_LEXICON` (`:60-116`), `FORBIDDEN_PATTERNS` (`:119-132`); types `DraftArticle`,`ValidationResult`,`ValidationFailure` |
| Imports | `SOURCE_WHITELIST` ← `@/lib/sources/registry` (`:14`) |
| `ValidationResult` | `{ ok, failures[], metrics{ bannedLexiconCount, approvedLexiconCount, headlineLength, wordCount, emDashCount, p1HasNumber, citationCount, citationsFromWhitelist } }` (`:149-162`). `ok = (no block-severity failures)` (`:298-301`). |

**The 8 gates (run in order, `:181-285`)** — severity `block` unless noted:

| # | Name | Rule | Sev | Line |
|---|---|---|---|---|
| 1 | Banned lexicon | 0 hits from `BANNED_LEXICON` across title+subtitle+body (lowercased substring) | block | `:182-190` |
| 2 | Approved lexicon | ≥3 hits from `APPROVED_LEXICON` (analytical/quant/institutional/authority terms) | block | `:193-203` |
| 3 | Headline length | `title.length ≤ 90` | block | `:206-214` |
| 4 | P1 has a number | first paragraph (`split /\n\n/`[0]) matches `/\d/` | block | `:217-226` |
| 5 | Citation whitelist | ≥1 citation whose host (`www.` stripped) `===` or `endsWith(.wd)` a `SOURCE_WHITELIST` domain | block | `:229-247` |
| 6 | Forbidden patterns | body must NOT match: opening question, "what do you think?", emoji range | block | `:250-259` |
| 7 | Word count | body words within per-tier band: news 600–1200, insight 2500–3500, area 800–2500 | block | `:262-274` |
| 8 | Em-dash signature | ≥1 `—` in body | **warn** | `:277-285` |
| (0) | Bold density | `**…**` pairs ≤ ceil(words/500) | **warn** (extra) | `:288-296` |

> Only gates **1–7** are block-severity, so `validator.ok` can be true with gate 8 (em-dash) failing as a warning. The cockpit and `/internal/review/page.tsx` both speak of "8 gates"; `validateDraft` returns gates 1–8 plus a bonus(0).

### `lib/voice/profile.ts` — the alternate voice-gate engine (`runVoiceGates`)

| Aspect | Detail |
|---|---|
| Purpose | Machine-readable voice profile; **6 voice gates** returning retry-feedback strings for re-prompting. `profile.ts:1-7` |
| Key exports | `VOICE_GATES[]` (`:147-208`), `runVoiceGates(draft): VoiceResult` (`:215-222`), `BANNED_LEXICON` (`:29-86`), `APPROVED_LEXICON` (`:94-123`), consts `HEADLINE_MAX_CHARS=90`,`BODY_MIN_WORDS=600`,`BODY_MAX_WORDS=1200` (`:125-127`), `wordCount`,`firstParagraph` |
| The 6 gates | `headline-length` (≤90), `para-1-number` (P1 has number via `NUMBER_RE`), `body-length` (600–1200), `banned-lexicon` (0 hits, whole-word boundary), `approved-lexicon` (≥3 hits), `tldr-shape` (exactly 3 entries) (`:147-208`) |
| Note | This banned list differs from validator.ts (adds honesty-pass specifics: "151% ROI","5× leverage","anonymous Modon analyst","betting against", etc.). `runVoiceGates` is consumed by `lib/validators/index.ts` (`runAllGates`), a parallel orchestrator — see below. |

### `lib/validators/index.ts` — master gate orchestrator (`runAllGates`)

| Aspect | Detail |
|---|---|
| Purpose | Runs **citation gate + voice gates** together, concatenates failures into a single `retryFeedback` string for Claude re-prompt. `index.ts:1-18` |
| Exports | `runAllGates(draft): DraftCheckResult` (`:39-61`); re-exports `citationGate`,`validateCitations`,`runVoiceGates` + their types (`:63-64`) |
| Composition | `validateCitations(draft.citations)` (citation.ts) + `runVoiceGates(draft)` (profile.ts); `pass = citation.pass && voice.pass` (`:40-43`) |
| Imports | `./citation`; `runVoiceGates,VoiceDraftInput,VoiceResult` ← `@/lib/voice/profile` |
| Status | Documents future gates (originality, sentiment, schema, hero-image, SEO) as queued in "Block 15.2" (`:13-18`). **Not** imported by `draft-engine.ts` or the publish route — those use `validateDraft` (voice/validator.ts) instead. `runAllGates` is the reusable copywriter-retry path. ⚠️ no in-tree caller of `runAllGates` found among the files read. |

### `lib/validators/citation.ts` — citation gate #1 (`validateCitations`)

| Aspect | Detail |
|---|---|
| Purpose | ≥1 citation must resolve to the 20-source whitelist; reusable for human-edited articles. `citation.ts:1-7` |
| Exports | `validateCitations(citations): CitationResult` (`:46-98`); `citationGate(citations): {pass,reason}` (`:101-107`); types `CitationInput`,`CitationResult` |
| Rule | Empty array → fail (`:55-63`); resolve each `c.url` via `findSourceByUrl`; `whitelistHits` get `tierWeight` from `TIER_WEIGHT`; `topTierWeight` = max hit weight (fed to scorer); all-non-whitelist → fail with helpful reason; ≥1 whitelist hit → `pass=true` (`:65-97`) |
| Imports | `findSourceByUrl`,`SOURCE_WHITELIST`,`TIER_WEIGHT` ← `@/lib/sources/registry` |

### `lib/sources/registry.ts` — the verified-source whitelist + tier weights

| Aspect | Detail |
|---|---|
| Purpose | Hard citation whitelist; discovery feeds; tier weighting. `registry.ts:1-7` |
| Key exports | `SOURCE_WHITELIST: VerifiedSource[]` (`:37-238`); `DISCOVERY_FEEDS` (`:311-314`); `FETCH_SOURCES` (`:337-340`, = discovery feeds + AGBI); `REDDIT_FEEDS` (disabled, `:331-333`); `TIER_WEIGHT` (`:344-350`); `findSourceByUrl(url)` (`:353-363`); `getWhitelistDomains()` (`:368-372`, citable-only); types `SourceTier`,`SourceFetchType`,`VerifiedSource` |
| Whitelist | Listed "20-source" set spans **5 tiers** (gov ×7, national-press ×4, regional-press ×2, institutional-research ×5, industry-portal ×2) plus a large **citation-anchor block** (`:208-237`: AGBI, Gulf Business, MEED, WAM, ValuStrat, Property Monitor, developer sites, Reuters/Bloomberg/FT/CNBC, etc.) so their cited URLs pass gate 5 |
| `TIER_WEIGHT` | government 1.0, national-press 0.85, institutional-research 0.80, regional-press 0.65, industry-portal 0.50 (`:344-350`) |
| Discovery | Google News + Bing News RSS query builders (`citable:false` → surface stories but never a valid citation target; `:251-314`); each entry re-attributed to its real publisher |
| `getWhitelistDomains()` | returns only `citable !== false` hostnames — the list passed to `draftFromCluster` as `whitelist` from `draft-once.ts` |

### `lib/ai/claude.ts` — Anthropic client (the AI brain)

| Aspect | Detail |
|---|---|
| Purpose | Single-call (`callClaude`) + web-research (`callClaudeResearch`) Anthropic wrappers. `claude.ts:1-2` |
| Env vars | `ANTHROPIC_API_KEY` (`:4`), `ANTHROPIC_MODEL` default `"claude-sonnet-4-5-20250929"` (`:5`) |
| `callClaudeResearch` | POSTs `https://api.anthropic.com/v1/messages` with `tools:[{type:"web_search_20250305",name:"web_search",max_uses:maxSearches??4}]` (`:118-136`); loops up to 6 steps handling `stop_reason:"pause_turn"` (continues the turn, `:159-166`); accumulates text + collects every `web_search_tool_result` URL into `searchedUrls` + counts `server_tool_use` as `searchCount` (`:149-157`); returns `ClaudeResearchResult` (`:170-177`) |
| External call | Anthropic Messages API (`x-api-key`, `anthropic-version: 2023-06-01`) |

### `lib/news-review/serialize.ts` — draft → build-safe TS module

| Aspect | Detail |
|---|---|
| Purpose | Turn reviewed draft into `content/news/<slug>.ts` + patched `content/news/index.ts`. Clean APPEND, never in-place edit. `serialize.ts:1-7` |
| Exports | `slugToVarName(slug)` → `art_<slug-with-_>` (`:12-14`); `serializeArticle(article): string` (`:17-27`); `patchIndex(src, slug): string` (`:31-61`) |
| `serializeArticle` | Inlines `{ status:"live", ...article }` as `JSON.stringify(...,2)` literal; emits header comment + `import type {NewsArticle} from "./types"` + `export const article: NewsArticle = <literal>;`. No `rootCtaUrl` import (cta.href already resolved). |
| `patchIndex` | Idempotent: if `from "./<slug>"` already present, returns unchanged (`:33`). Inserts `import { article as <var> } from "./<slug>";` after the last article import (fallback: before `NEWS_ARTICLES` decl); then registers `<var>,` at the **top** of `NEWS_ARTICLES[]` (newest-first, `:54-58`). |
| Env vars | None |

### `lib/news-review/github.ts` — atomic publish commit (the one git write)

| Aspect | Detail |
|---|---|
| Purpose | Commit article file + patched registry + self-hosted hero as ONE commit; Vercel auto-deploys on push. `github.ts:1-6` |
| Exports | `githubConfigured(): boolean` (= `Boolean(TOKEN)`, `:17-19`); `publishArticleCommit(slug, article): Promise<string>` (commit SHA, `:42-154`) |
| Env vars | `GITHUB_TOKEN` (fine-grained PAT, contents:write; required, `:11,:46`); `GITHUB_OWNER` default `"investwithraj"`; `GITHUB_REPO` default `"news-investwithraj-site"`; `GITHUB_BRANCH` default `"main"` (`:11-14`) |
| Target branch | **`main`** (env-overridable). Target repo = `investwithraj/news-investwithraj-site` |
| External API | GitHub Git Data API (`api.github.com`, `Bearer TOKEN`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `cache:no-store`); thrown on non-2xx (`:21-38`) |

**Commit algorithm (`:42-153`):**
1. Read branch tip ref → `headSha` → its commit → `baseTree` (`:51-54`).
2. GET `content/news/index.ts?ref=<branch>`, base64-decode, `patchIndex(currentIndex, slug)` (`:57-61`).
3. **Hero self-hosting (`:64-111`):** if `heroImage.src` is `http(s)`, derive a Wikimedia 1600px thumbnail URL (else pass-through), fetch with custom UA + Wikimedia Referer, fall back to the original URL if the 1600px thumb 404s (the missed-self-host bug fix); on success create a base64 git blob `public/news/<slug>/cover.<ext>` and rewrite `finalArticle.heroImage.src` to the local `/news/<slug>/cover.<ext>`. All failures non-fatal (keep remote CDN src).
4. Create blobs for `serializeArticle(finalArticle)` (utf-8) + `nextIndex` (utf-8), in parallel (`:113-124`).
5. Create tree on `base_tree` with entries: `content/news/<slug>.ts`, `content/news/index.ts`, + optional hero blob (`:127-137`).
6. Create commit (message `news: publish <slug> (reviewed + approved)`, parent `headSha`) and PATCH the branch ref `sha=commit.sha, force:false` (`:140-151`). Return commit SHA.

### `lib/news-review/storage.ts` — draft staging store (KV / fs)

| Aspect | Detail |
|---|---|
| Purpose | KV-backed review-staging store; **drafts never touch git** until publish. Mirrors `lib/queue/storage.ts`. `storage.ts:1-7` |
| Where drafts live | **Upstash-compatible Redis (Vercel KV)** when configured, else **file-system fallback** `pipeline-runs/news-drafts.json` (ephemeral on Vercel → KV required in prod). Single KV key `"iwr:news:drafts"` holding a JSON array (`:15-23`) |
| Env vars | `KV_REST_API_URL`, `KV_REST_API_TOKEN` (both present ⇒ `useKv()` true, `:17-23`) |
| KV adapter | `kvGet` GET `${KV_URL}/get/iwr:news:drafts` (`Bearer KV_TOKEN`), tolerant of array/string result; `kvSet` POST `${KV_URL}/set/...` text/plain body (`:27-66`) |
| Public API | `getAllDrafts()` (newest-first, `:92-96`); `getDraft(id)` (`:102-105`); `validateArticle(article)` → `validateDraft` (`:108-110`); `addDraft(input)` (`:113-130`); `updateDraft(id, patch)` (`:133-145`); `deleteDraft(id)` (`:147-153`); `getStorageBackend()` → `"vercel-kv"`|`"file-system"` (`:155-157`) |
| Validator integration | `addDraft` sets `status:"review"`, `validator = validateArticle(article)`, `verifiedSources:[]` (`:113-130`); `updateDraft` **recomputes the validator whenever `patch.article` changes** (`:141`) |
| External | Upstash REST (or local fs); imports `validateDraft` ← `@/lib/voice/validator` |

### `lib/news-review/types.ts` — staging types

- `DraftArticle = Omit<NewsArticle, "status">` (status set to `"live"` only at publish, `:14`).
- `ProvenanceSource {name,tier,url,summary,publishedAt?}` (`:18-24`).
- `NewsDraftProvenance {clusterId,topic,score,scoreBreakdown{uhnwRelevance,sourceTier,freshness,rajAngle},sources[],citedText?}` (`:27-43`). `citedText` = concatenated `<cite>` figure text; cockpit treats a figure found here as source-backed (gold).
- `NewsDraft {id,createdAt,updatedAt,status:"review",article,validator:ValidationResult,provenance,reviewNote?,verifiedSources?}` (`:46-59`) — `validator` recomputed on every write; `verifiedSources` drives the Approve soft-lock.
- `NewsDraftInput {article,provenance,reviewNote?}` (`:62-66`).
- Imports `NewsArticle` ← `@/content/news/types`; `ValidationResult` ← `@/lib/voice/validator`.

### `lib/news-review/auth.ts` — route guard (`authorize`)

| Aspect | Detail |
|---|---|
| Purpose | Guard for `/api/news/draft*`; two accepted credentials. `auth.ts:1-11` |
| Env vars | `INTERNAL_BASIC_AUTH` (cockpit, browser-held), `POST_PUBLISH_SECRET` (cron / server-to-server) (`:15-16`) |
| Logic | `authorize(req)`: if NEITHER env set → `{ok:false, status:503}` ("Review API disabled"); else allow if `basicAuthOk` OR `secretOk`, else `{ok:false, status:401}` (`:52-62`) |
| `basicAuthOk` | `Authorization: Basic <b64>`, `atob`-decode, `timingSafeEq` vs `INTERNAL_BASIC_AUTH` (`:31-42`) |
| `secretOk` | `?secret=` query OR `x-post-publish-secret` header, `timingSafeEq` vs `POST_PUBLISH_SECRET` (`:44-49`) |
| Note | Constant-time compare via hand-rolled `timingSafeEq` (`:24-29`). NextRequest only. |

### `scripts/draft-once.ts` — autonomous one-shot (GitHub Actions runner)

| Aspect | Detail |
|---|---|
| Purpose | Full pipeline + web-research draft with **no 60s Vercel cap**; the real daily driver. POSTs finished drafts to `/api/news/draft` for review. `draft-once.ts:1-11`. Run: `npx tsx scripts/draft-once.ts` |
| Env vars | `POST_PUBLISH_SECRET` (auth GET+POST), `ANTHROPIC_API_KEY` (web-research), `SITE_URL` default `https://news.investwithraj.com`, `DRAFT_MODEL` (optional model override), `PIPELINE_MIN_SCORE` default `45`, `PIPELINE_CAP` default `1` (max drafts), `PIPELINE_MAX_ATTEMPTS` default `3` (`:20-24`) |
| Imports | `fetchAllSources`,`flattenEntries` ← `lib/sources/fetchers`; `dedupeEntries`,`similarity` ← `lib/pipeline/dedupe`; `clusterAndScore` ← `lib/pipeline/cluster`; `getWhitelistDomains` ← `lib/sources/registry`; `draftFromCluster` ← `lib/news-review/draft-engine`; `NEWS_ARTICLES` ← `content/news` |
| Flow | (1) GET existing staged drafts via `/api/news/draft?secret=` → `draftedIds` (by clusterId) + `coveredTitles` (staged + today's published). (2) `fetchAllSources → flattenEntries → dedupeEntries → clusterAndScore(...,12)` filtered to `score ≥ MIN_SCORE`. (3) candidates = clusters not already drafted AND not title-similar (`similarity ≥ 0.55`) to covered titles (`:46-52`). (4) Loop until `staged ≥ MAX_DRAFTS` or `attempts ≥ MAX_ATTEMPTS`: `draftFromCluster(cluster, whitelist, {model:DRAFT_MODEL,maxSearches:4,maxTokens:4200})`; on ok POST to `/api/news/draft?secret=` (`:58-83`). |
| Side effects | Stages drafts into KV (never publishes). `process.exit(1)` on top-level failure. |

### Route: `app/internal/review/page.tsx` — "The Desk" (review cockpit shell)

| Aspect | Detail |
|---|---|
| Path / segment | `/internal/review`, no dynamic segments |
| Render mode | `export const dynamic = "force-dynamic"` (SSR every request, `:12`) — server component |
| Metadata | `{ title: "The Desk — editorial review", robots:{index:false,follow:false} }` (`:13-16`). No JSON-LD (admin surface). |
| Auth | Gated upstream by `proxy.ts`/middleware Basic-Auth (`INTERNAL_BASIC_AUTH`); page passes `actionSecret = process.env.POST_PUBLISH_SECRET` down so the client appends `?secret=` (browser Basic-Auth scoped to `/internal/*` doesn't reach `/api/news/draft/*`) (`:50-60`) |
| Data feeds | `getAllDrafts()` + `getStorageBackend()` ← `lib/news-review/storage`; `NEWS_ARTICLES` ← `@/content/news` for cadence stats |
| Computes | `publishedToday`/`publishedThisWeek` (live articles by `publishedAt` window); `avgConfidence` = mean of `(8 − #distinct block-severity failed gates)/8` across drafts ×100 (`:24-48`). Renders `<ReviewDesk drafts backend stats actionSecret/>`. |

#### Client: `app/internal/review/ReviewDesk.tsx` — verify-gate UI

- **The figure-traceability verify gate** (`figureBacked`/`highlightFigures`, `:43-54,:690-734`): each body figure (regex `NUMBER_RE`, AED/USD/Dh/$/€/£ + digits + unit) with digit-core ≥2 is "backed" iff its digits appear in `provenance.citedText` OR in any `provenance.sources[].summary`. Backed → gold mark; unbacked → amber "verify manually". `unbackedCount` surfaced as a chip + next to the checkbox (`:251-258`).
- **Soft-lock:** `canPublish = validator.ok && figuresVerified` (`:260`); "Approve & publish" disabled until the human ticks "I've checked every figure against its source" AND validator passes (`:453-517`). Two-stage confirm for publish + reject.
- **Gate constellation:** 8 colored squares (green pass / amber warn / red block) from `validator.failures` (`:371-388`); `confidence = (8 − blockedGates.size)/8 ×100` rendered in a `ConfidenceArc`.
- **Three tabs:** Verify (split body + source rail), Preview (`SemaformLayout` with `status:"live"`), Edit (title/subtitle/body → PATCH `/api/news/draft/[id]`, re-validates) (`:401-442,:286-300`).
- **API helper (`:267-284`):** appends `?secret=actionSecret`, `credentials:"include"`; calls publish (`POST /api/news/draft/[id]/publish`), reject (`DELETE /api/news/draft/[id]`), save (`PATCH /api/news/draft/[id]`). `router.refresh()` after each.
- `LaunchConsole` shows distribution channels (IndexNow always on; Telegram/LinkedIn/Listmonk from `article.distribution`) (`:902-933`). No native `alert/confirm/prompt`.

### API: `app/api/news/draft/route.ts` — stage + list

| Method | Purpose | Auth | Request | Response | Side effects |
|---|---|---|---|---|---|
| `GET` | List all staged drafts | `authorize` (Basic-Auth or `?secret=`) | — | `{ok,drafts,backend}` | none |
| `POST` | Stage a new review draft | `authorize` | `{article{slug,title,body,citations[]…}, provenance?, reviewNote?}` (validates required fields; default `provenance` = `clusterId:"manual"`) | `{ok,draft}` | `addDraft` → KV write, validator computed | 
- `runtime="nodejs"`, `dynamic="force-dynamic"` (`:12-13`). NEVER publishes. Called by `draft-once.ts` (`?secret=`) + cockpit. Env via auth.ts.

### API: `app/api/news/draft/[id]/route.ts` — edit + reject

| Method | Purpose | Auth | Request | Response | Side effects |
|---|---|---|---|---|---|
| `PATCH` | Edit draft (re-runs validator when `article` changes) | `authorize` | `{article?,reviewNote?,verifiedSources?,provenance?}` | `{ok,draft}` / 404 | `updateDraft` → KV write + validator recompute |
| `DELETE` | Reject (drop from KV; repo untouched) | `authorize` | — | `{ok}` / 404 | `deleteDraft` → KV write |
- Dynamic segment `[id]` (`params: Promise<{id}>`, awaited). `runtime="nodejs"`, `dynamic="force-dynamic"`.

### API: `app/api/news/draft/[id]/publish/route.ts` — approve + publish (the only git write)

| Aspect | Detail |
|---|---|
| Method / path | `POST /api/news/draft/[id]/publish`; dynamic `[id]` |
| Auth | `authorize` (Basic-Auth or `?secret=`) (`:27-28`) |
| Guards | (1) `githubConfigured()` false → `503` "Publishing disabled — set GITHUB_TOKEN" (`:30-35`). (2) draft missing → `404`. (3) **Hard validator gate:** `!draft.validator.ok` → `422` with block-severity failures (`:42-50`). |
| Side effects | `publishArticleCommit(slug, draft.article)` → GitHub commit (errors → `502`); fires `/api/post-publish?secret=` fan-out (IndexNow + sitemap pings, best-effort, never blocks); `deleteDraft(id)` clears KV (`:54-72`) |
| Response | `{ok,slug,url,commitSha}`; `url = ${NEXT_PUBLIC_SITE_URL||https://news.investwithraj.com}/news/<slug>` (`:64,:72`) |
| Env vars | `NEXT_PUBLIC_SITE_URL` (`:20`), `POST_PUBLISH_SECRET` (fan-out, `:76`), + `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH` (via github.ts), `INTERNAL_BASIC_AUTH`/`POST_PUBLISH_SECRET` (via auth.ts) |
| `runtime` | `"nodejs"`, `dynamic="force-dynamic"` |

### Route: `app/internal/dashboard/page.tsx` — Approval Queue (DIFFERENT subsystem)

> ⚠️ Out of subsystem scope but listed in the brief: this page is the **outreach/lead Approval Queue**, NOT the news review desk. It uses `lib/queue/storage` (`getPendingItems/getQueueStats/getAllItems`), `lib/queue/expiry` (`runExpirySweep`,`getUrgentItems`), `lib/queue/types` (`CHANNEL_POLICIES`) and renders `<DashboardClient/>`. Path `/internal/dashboard`, `dynamic="force-dynamic"`, auth via `middleware.ts` Basic-Auth (`INTERNAL_BASIC_AUTH`). It runs `runExpirySweep()` (idempotent) before render and surfaces posted/skipped/expired activity in the last 24h. The news cockpit links to it ("outreach queue →") but they share no data store. (`dashboard/page.tsx:1-53`)

### Cross-cutting env-var inventory (NAMES ONLY)

`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DRAFT_MODEL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `INTERNAL_BASIC_AUTH`, `POST_PUBLISH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`, `PIPELINE_MIN_SCORE`, `PIPELINE_CAP`, `PIPELINE_MAX_ATTEMPTS`.

### ⚠️ Unresolved / cross-repo notes

- **`AUTO_APPROVE` kill-switch + fully-deterministic publish-without-human auto-approver:** NOT present in this `news-investwithraj` repo. `MEMORY.md` attributes it to the separate `investwithraj/news-investwithraj-site` repo (`draft-once.ts` + PR #1). In **this** tree, publish is always human-gated (cockpit tick + validator hard-gate at `/publish`). No `process.env.AUTO_APPROVE` reference exists in the files read.
- `lib/validators/index.ts` `runAllGates` has no in-tree caller among the files examined (draft-engine + publish route use `validateDraft` instead). It is the documented copywriter-retry orchestrator.
- `draft-engine.ts` deps referenced but not read here (mapped elsewhere): `@/lib/constants` (`rootCtaUrl`), `@/lib/stock/providers` (`findBestStockImage`), `@/lib/stock/query-builder`, `@/lib/pipeline/types` (`Cluster`), `@/lib/pipeline/{dedupe,cluster}`, `@/lib/sources/fetchers`.

## NEWS · Distribution + Voice + AI Providers

Subsystem covering: (1) the multi-channel social/email distribution layer (`lib/distribute/*`), (2) the ElevenLabs voice client + Raj voice-profile config + draft validators (`lib/voice/*`), and (3) the external AI provider clients + rate-limit wrapper (`lib/ai/*`). All clients share the same defensive contract: read env at module load, expose an `isXConfigured()` guard, and **no-op gracefully** (return `{ ok:false, error:"…not set/Skipped" }`) when env is missing — never throw.

**Consumers (out-of-scope route group, listed for traceability):** `app/api/distribute/route.ts`, `app/api/digest/route.ts`, `app/api/voice/route.ts`, `app/api/cover-image/route.ts`, `app/api/daily-intro/route.ts`, `app/api/brief/route.ts`, `app/api/translate/route.ts`, `app/api/anchor/route.ts`, `app/api/cron/draft/route.ts`, `app/api/vertex-test/route.ts`, `app/api/veo-test/route.ts`, plus `lib/news-review/draft-engine.ts` and `lib/validators/index.ts`.

---

### `lib/distribute/types.ts` — shared distribution types

Pure type module, no runtime/env.

| Export | Kind | Detail |
|---|---|---|
| `Channel` | union type | 14 channels: 12 Postiz-managed (`linkedin-personal`, `linkedin-company`, `x`, `facebook`, `instagram-feed`, `instagram-stories`, `threads`, `tiktok`, `pinterest`, `bluesky`, `mastodon`, `youtube-shorts`) + 2 direct-webhook (`telegram`, `discord`) (`types.ts:3`) |
| `DistributionVia` | union | `"postiz" \| "telegram-bot" \| "discord-webhook"` (`types.ts:21`) |
| `ChannelResult` | interface | `{ channel, via, ok, scheduledFor?, externalId?, error? }` (`types.ts:24`) |
| `ContentVariant` | interface | `{ channel, text, hashtags?, imageUrl?, link? }` (`types.ts:37`) |
| `DistributionRun` | interface | `{ articleSlug, startedAt, finishedAt, results[], successCount, failureCount, skippedCount }` (`types.ts:50`) |

---

### `lib/distribute/index.ts` — dispatch orchestrator

- **Purpose:** Compose content-adapter + schedule + per-channel clients into one "ship this article everywhere" call (`index.ts:1`).
- **Imports:** `NewsArticle` (`@/content/news/types`); types from `./types`; `buildVariants` (`./content-adapter`); `scheduleTimeFor`, `DEFAULT_PHASE_1_CHANNELS`, `ALL_CHANNELS` (`./schedule`); `schedulePostizPost`, `POSTIZ_CHANNELS` (`./postiz`); `postToTelegram` (`./telegram`); `postToDiscord` (`./discord`) (`index.ts:5-15`).
- **Re-exports (barrel):** all `./types`, `./schedule` (`ALL_CHANNELS`, `DEFAULT_PHASE_1_CHANNELS`, `scheduleTimeFor`), `./postiz` (`isPostizConfigured`, `POSTIZ_CHANNELS`), `isTelegramConfigured`, `isDiscordConfigured` (`index.ts:17-28`).

| Function | Signature | Behavior | External calls |
|---|---|---|---|
| `distributeArticle` | `(article, channels=DEFAULT_PHASE_1_CHANNELS) → Promise<DistributionRun>` (`index.ts:40`) | Builds variants → filters Postiz vs telegram/discord. Postiz channels are **SCHEDULED** at staggered times via `scheduleTimeFor`; Telegram + Discord posted **IMMEDIATELY**. Runs all via `Promise.all`. Counts success/failure/skipped (skipped = `error` contains `"Skipped"`). (`index.ts:44-78`) | indirectly: Postiz/Telegram/Discord clients |
| `distributeBatch` | `(articles[], channels?) → Promise<DistributionRun[]>` (`index.ts:82`) | Sequential `for…await` loop (avoids parallel API hammering) (`index.ts:86-90`) | — |
| `getActiveChannels` | `() → { active: Channel[], inactive: Channel[] }` (`index.ts:94`) | Probes env: Postiz needs `POSTIZ_BASE_URL`+`POSTIZ_API_TOKEN`; Telegram needs `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHANNEL_ID`; Discord needs `DISCORD_WEBHOOK_URL`; each Postiz channel additionally needs a dynamic per-channel ID env `POSTIZ_<CHANNEL>_ID` (uppercased, `-`→`_`) (`index.ts:102-117`) | reads `process.env` only |

- **Env vars referenced:** `POSTIZ_BASE_URL`, `POSTIZ_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `DISCORD_WEBHOOK_URL`, dynamic `POSTIZ_*_ID` (`index.ts:102-114`).

---

### `lib/distribute/content-adapter.ts` — per-platform content transformation

- **Purpose:** Transform a `NewsArticle` into one `ContentVariant` per channel, applying per-surface voice/tone rules from `raj-profile.md` (LinkedIn 1300c, X 280c, Threads 500c, BlueSky 300c, Mastodon 500c, etc.) (`content-adapter.ts:1-19`).
- **Imports:** `NewsArticle` (`@/content/news/types`); `Channel`, `ContentVariant` (`./types`).
- **External calls:** none (pure string transforms). Reads `process.env.NEXT_PUBLIC_SITE_URL` for the article base URL (fallback `https://news.investwithraj.com`) (`content-adapter.ts:31`).

| Function | Purpose |
|---|---|
| `articleUrl(article, channel)` (export, `:24`) | Builds canonical `/news/<slug>` URL with `utm_source=<channel>`, `utm_medium=social`, `utm_campaign=<slug>` |
| `extractLeadNumber(article)` (`:40`) | Regex pulls first `AED/USD/$/€ <n> M/B/K` figure from `article.body` — used for X/Threads hooks |
| `defaultHashtags(article)` (`:47`) | Market+category+brand tags (UAE→`UAE`, Dubai→`DubaiRealEstate`, Abu Dhabi→`AbuDhabiRealEstate`, RAK→`RAK`+`WynnAlMarjan`; launch→`OffPlan`; regulatory→`DLD`+`RERA`; always `InvestWithRaj`); dedup via `Set` |
| `truncate(text, maxChars, reservedForLink)` (`:63`) | Word-boundary truncation reserving link/ellipsis budget |
| `buildLinkedIn/X/Facebook/InstagramFeed/InstagramStories/Threads/TikTok/Pinterest/BlueSky/Mastodon/YouTubeShorts/Telegram/Discord` (`:73-219`) | Per-platform builders. Notable: IG-feed uses link-in-bio (strips outbound link); Telegram emits HTML (`<b>`,`<a>`) via local `escapeHtml`; Discord emits Markdown `**bold**` + imageUrl=heroImage; X reserves 25 chars for shortened link |
| `escapeHtml(s)` (`:221`) | Local — only escapes `& < >` (Telegram variant) |
| `buildVariants(article, channels)` (export, `:234`) | Main entrypoint — `switch` over channel → builder; filters `undefined`. Both LinkedIn variants reuse `buildLinkedIn` with channel override |

---

### `lib/distribute/schedule.ts` — per-channel scheduling

- **Purpose:** Decide when each variant publishes; all times GST (UTC+4), articles drop 06:30 GST then stagger through the day (`schedule.ts:1-6`). No env, no external calls.
- **`CHANNEL_OFFSET_MINUTES`** (`:12`): offset-from-now per channel — LinkedIn/X=30 (07:00), threads=60 (07:30), facebook/instagram-feed=150 (09:00), instagram-stories=210 (10:00), tiktok/youtube-shorts=330 (12:00), pinterest=450 (14:00), bluesky/mastodon=510 (15:00), telegram/discord=570 (16:00).
- **`scheduleTimeFor(channel, baseTime=now)`** (export, `:46`): returns `new Date(baseTime + offset*60_000)`.
- **`ALL_CHANNELS`** (export, `:52`): all 14 channels.
- **`DEFAULT_PHASE_1_CHANNELS`** (export, `:71`): conservative default — `["linkedin-personal", "x", "telegram", "discord"]`.

---

### `lib/distribute/postiz.ts` — Postiz social scheduler client

- **Purpose:** Postiz (open-source self-hosted social scheduler, Hetzner) handles 12 of 14 channels (`postiz.ts:1-3`).
- **Env vars:** `POSTIZ_BASE_URL`, `POSTIZ_API_TOKEN` (`:16-17`); per-channel integration IDs `POSTIZ_LINKEDIN_PERSONAL_ID`, `POSTIZ_LINKEDIN_COMPANY_ID`, `POSTIZ_X_ID`, `POSTIZ_FACEBOOK_ID`, `POSTIZ_INSTAGRAM_FEED_ID`, `POSTIZ_INSTAGRAM_STORIES_ID`, `POSTIZ_THREADS_ID`, `POSTIZ_TIKTOK_ID`, `POSTIZ_PINTEREST_ID`, `POSTIZ_BLUESKY_ID`, `POSTIZ_MASTODON_ID`, `POSTIZ_YOUTUBE_SHORTS_ID` (`:26-39`).
- **Exports:** `isPostizConfigured()` (base+token) (`:20`); `POSTIZ_CHANNELS` (the 12 Postiz channels) (`:42`); `schedulePostizPost(variant, scheduledFor)` (`:61`).
- **`schedulePostizPost`:** guards config + per-channel integration ID; composes `text` + hashtags (`#tag` joined); **POST** `${POSTIZ_BASE_URL}/api/v1/posts` with `Authorization: Bearer <token>`, `cache:"no-store"`. Payload `{ type:"schedule", date: ISO, posts:[{ integration:{id}, value:[{content, image:[{path:imageUrl}]}] }] }`. Returns `ChannelResult` with `externalId` from `data.id || data.postId` (`:84-143`).
- **External service:** Postiz REST API `POST /api/v1/posts`.

---

### `lib/distribute/telegram.ts` — Telegram Bot API (direct)

- **Purpose:** Direct post to a Telegram channel; no native scheduling on Bot API (delayed posts handled by Vercel Cron / schedule skill) (`telegram.ts:1-22`).
- **Env vars:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` (username `@…` or numeric chat_id; bot must be channel admin) (`:11-12`).
- **Exports:** `isTelegramConfigured()` (`:14`); `postToTelegram(variant)` (`:23`).
- **`postToTelegram`:** **POST** `https://api.telegram.org/bot<TOKEN>/sendMessage`, body `{ chat_id, text, parse_mode:"HTML", disable_web_page_preview:false, link_preview_options:{prefer_large_media:true} }`, `cache:"no-store"`. Checks both `res.ok` and Telegram's `data.ok`; `externalId` = `message_id` (`:36-86`).
- **External service:** Telegram Bot API `sendMessage`.

---

### `lib/distribute/discord.ts` — Discord webhook (direct)

- **Purpose:** Direct POST to a Discord channel webhook as a rich embed (`discord.ts:1-7`).
- **Env vars:** `DISCORD_WEBHOOK_URL` (`:11`); reads `NEXT_PUBLIC_DISCORD_AVATAR_URL` (fallback `https://news.investwithraj.com/icon.svg`) for embed avatar (`:38`).
- **Exports:** `isDiscordConfigured()` (`:13`); `postToDiscord(variant)` (`:18`).
- **`postToDiscord`:** parses title (first line, strips `**`) + body from `variant.text`; **POST** `DISCORD_WEBHOOK_URL` with `{ username:"Invest With Raj", avatar_url, embeds:[{ title, description, url:variant.link, color:0xC9A961 (brand gold), image:{url:imageUrl}, footer:{text:"news.investwithraj.com"}, timestamp }] }`. Treats both `res.ok` and HTTP **204** as success (`:30-78`).
- **External service:** Discord webhook endpoint.

---

### `lib/distribute/listmonk.ts` — Listmonk + AWS SES newsletter client

- **Purpose:** Listmonk REST client; self-hosted Hetzner CX22 + AWS SES on `news.investwithraj.com` (us-east-1). No-ops gracefully when unconfigured (`listmonk.ts:1-14`). *(Not wired into `index.ts` orchestrator — invoked separately via the digest route + `digest-builder`.)*
- **Env vars:** `LISTMONK_BASE_URL`, `LISTMONK_API_USERNAME`, `LISTMONK_API_TOKEN`, `LISTMONK_DIGEST_LIST_ID`, `LISTMONK_FROM_EMAIL`, `LISTMONK_FROM_NAME` (default `"Raj Tomar"`), `LISTMONK_TEMPLATE_ID` (optional) (`:16-22`).
- **Auth:** HTTP **Basic** — `Basic base64(user:token)` via `authHeader()` (`:29-31`).
- **Types:** `CampaignDraft { subject, textBody, htmlBody, contentType?: "html"|"richtext"|"plain"|"markdown" }` (`:33`); `ListmonkResult { ok, campaignId?, status?, message }` (`:43`).
- **Exports / functions:**

| Function | Method/Endpoint | Detail |
|---|---|---|
| `isListmonkConfigured()` (`:24`) | — | requires base+user+token+listId+fromEmail |
| `createListmonkCampaign(draft)` (`:56`) | **POST** `/api/campaigns` | payload `{ name, subject, lists:[listId], from_email:"<name> <email>", type:"regular", content_type (default richtext), body:html, altbody:text, messenger:"email", tags:["daily-digest","beyond-the-deal"] }`; adds `template_id` if set. Returns `campaignId`, status `"draft"` |
| `setCampaignStatus(campaignId, status)` (`:123`) | **PUT** `/api/campaigns/<id>/status` | status ∈ `running\|draft\|paused\|scheduled\|cancelled`; `"running"` sends immediately |
| `sendListmonkDigest(draft)` (`:170`) | create → set `"running"` | one-call cron flow; on send failure returns campaign created but status draft |

- **External service:** Listmonk API (delivers via AWS SES).

---

### `lib/distribute/digest-builder.ts` — HTML email template builder

- **Purpose:** Build email-client-safe (inline-CSS, table-layout, no `<style>`) daily-digest HTML/text/subject; v11 navy/gold register (`digest-builder.ts:1-7`). No env (uses `SITE`/`CONTACT` constants), no external calls.
- **Imports:** `SITE`, `CONTACT` (`@/lib/constants`); `NewsArticle` (`@/content/news/types`); `CampaignDraft` (`./listmonk`).
- **Internal:** `COL` brand palette (paper `#F8FAFC`, ink `#0A1024`, gold `#C9A961`, …) (`:13`); `formatDigestDate` (`:26`); `articleLink(slug)` + `rootLink()` — UTM-tag `utm_source=newsletter`, `utm_medium=email`, `utm_campaign=daily-digest` (`:36-52`); `articleRow` (`:167`); `escapeHtml` (`:198`).
- **Exports:** `buildDigestSubject(articles, date)` → `"Daily Read — <date> · N article(s)"` (`:56`); `buildDigestTextBody` (plain-text fallback, embeds `CONTACT.whatsappNumber` + `{{ UnsubscribeURL }}` Listmonk token) (`:68`); `buildDigestHtmlBody` (full responsive HTML, "Beyond the Deal / Daily Read" header, article cards, dark footer CTA, WhatsApp `wa.me/<E164>`, unsubscribe token) (`:81`); `buildDigestDraft(articles, date)` → returns `CampaignDraft` (`contentType:"richtext"`) ready for `sendListmonkDigest` (`:211`).

---

### `lib/voice/elevenlabs.ts` — ElevenLabs TTS client (Raj's PVC voice)

- **Purpose:** TTS via ElevenLabs; settings are the **locked "Reel-1 Emotional Mode"** (May 2026) (`elevenlabs.ts:1-12`).
- **Config / env vars (names only):**
  - `ELEVENLABS_API_KEY` (`:14`) — auth via `xi-api-key` header.
  - `ELEVENLABS_RAJ_VOICE_ID` (default voice id `3PmZaGGPRbZDCjAl7KBE`, "rt") (`:16`).
  - `ELEVENLABS_MODEL` (default `eleven_multilingual_v2`) (`:17`).
  - `ELEVENLABS_STABILITY` (0.40), `ELEVENLABS_SIMILARITY` (0.88), `ELEVENLABS_STYLE` (0.20), `ELEVENLABS_SPEED` (1.0); `use_speaker_boost:true` hardcoded (`:19-25`).
  - Base URL constant `https://api.elevenlabs.io/v1` (`:15`).
- **`RAJ_VOICE_SETTINGS`** (export, `:19`): `{ stability, similarity_boost, style, use_speaker_boost, speed }`.
- **Functions:** `isElevenConfigured()` (`:27`); `synthesise(req)` (`:56`) — guards config + text length 1–5000; **POST** `/text-to-speech/<voiceId>?output_format=<fmt>` with body `{ text, model_id, voice_settings }`, `Accept` mp3/wav by format; returns `ArrayBuffer` audio + contentType. `synthesiseToDataUrl(req)` (`:108`) — wraps `synthesise`, returns base64 `data:` URL.
- **Types:** `SynthRequest { text, outputFormat?, voiceId? }` (formats: `mp3_44100_192|128|64`, `pcm_24000|44100`, `ulaw_8000`; default `mp3_44100_192`); `SynthResult { ok, audio?, contentType?, error? }`.
- **External service:** ElevenLabs TTS REST API.

---

### `lib/voice/profile.ts` — machine-readable voice gates (6-gate set)

- **Purpose:** Programmatic voice gates run on every auto-drafted article before commit; extracted from `raj-profile.md` + IWR Notes 01-03 (`profile.ts:1-6`). Pure logic, no env/external calls.
- **Lexicons:** `BANNED_LEXICON` (~50 hype/honesty-pass/fake-credibility/salesy terms incl. v16 specifics like `"151% ROI"`, `"5× leverage"`, `"anonymous Modon analyst"`) (`:29`); `APPROVED_LEXICON` (editorial-DNA phrases: `"the read"`, `"cycle position"`, `"structural"`, `"trade-killer"`, `"mandate-fit"`, `"compression"`, `"DLD"`, `"RERA"`, …) (`:94`).
- **Constants:** `HEADLINE_MAX_CHARS=90`, `BODY_MIN_WORDS=600`, `BODY_MAX_WORDS=1200` (`:125-127`).
- **Helpers:** `wordCount` (`:130`), `firstParagraph` (`:135`), `NUMBER_RE` (`:140`).
- **`VOICE_GATES`** (export, `:147`) — 6 gates, each `check(draft) → string|null`:
  1. `headline-length` ≤90 chars
  2. `para-1-number` — P1 must match `NUMBER_RE`
  3. `body-length` 600–1200 words
  4. `banned-lexicon` — 0 banned terms (whole-word regex)
  5. `approved-lexicon` — ≥3 approved hits
  6. `tldr-shape` — exactly 3 TL;DR entries
- **Types/exports:** `VoiceGate`, `VoiceDraftInput {title, subtitle, body, tldr[]}`, `VoiceResult {pass, failures[]}`, `runVoiceGates(draft)` (`:215`).

---

### `lib/voice/validator.ts` — 8-gate draft validator (citation-aware)

- **Purpose:** Stricter, citation-aware validator (8 gates) — separate from `profile.ts`'s 6; mirrors `raj-profile.md`. Pipeline policy: all-pass→commit, 1-2 fail→redraft (≤2×), 3+→manual review (`validator.ts:1-13`).
- **Imports:** `SOURCE_WHITELIST` from `@/lib/sources/registry` (used for the citation gate) (`:14`). No env/external calls.
- **Lexicons:** `BANNED_LEXICON` (buzzword/breathless/marketing-broker/throat-clearing — note: distinct list from `profile.ts`, `as const`) (`:19`); `APPROVED_LEXICON` (analytical/quantitative/institutional/authority terms incl. developer + research-house names) (`:60`); `FORBIDDEN_PATTERNS` — regexes for opening-with-question, "what do you think?", and emoji in body (`:119`).
- **Types:** `DraftArticle { title, subtitle?, body, citations:[{source,url,accessedAt?}], tier:"news"|"insight"|"area" }` (`:136`); `ValidationResult { ok, failures[], metrics{…} }` (`:149`); `ValidationFailure { gate, name, detail, severity:"block"|"warn" }` (`:164`).
- **`validateDraft(article)`** (export, `:173`) — 8 gates + 1 bonus:
  1. Banned lexicon = 0 (block)
  2. Approved lexicon ≥3 (block)
  3. Headline ≤90 chars (block)
  4. P1 has a digit (block)
  5. ≥1 citation from `SOURCE_WHITELIST` (hostname match, www-stripped, subdomain-aware) (block)
  6. No `FORBIDDEN_PATTERNS` (block)
  7. Word count per tier — news 600-1200, insight 2500-3500, area 800-2500 (block)
  8. ≥1 em-dash (warn)
  - Bonus: bold density >⌈words/500⌉ (warn)
  - `ok` = zero **block**-severity failures.
- **Exports:** `summarizeResult(result)` — one-line pipeline log string (`:326`); local `countWords` (`:318`).
- **⚠️ note:** two parallel banned/approved lexicons exist (`profile.ts` vs `validator.ts`) with overlapping-but-different entries — drift risk if maintained separately.

---

### `lib/voice/raj-profile.md` — editorial voice guide (source of truth)

- **Purpose:** Human-readable editorial profile (v1.0, 2026-05-26) that both validators encode. Defines cadence (em-dash signature, three-beat staccato), USE/NEVER lexicons, stance ("read 100 deals", "I'd pass on this"), P1 rule (fact+number→mechanism→implication), **per-surface tone table** (LinkedIn 1300c, X 280c, Reddit 1-in-10 promo, etc.), 8 forbidden patterns, the 8 validation gates (mirrors `validator.ts`), place-naming + numbers/units conventions, the citation-whitelist requirement (`lib/sources/registry.ts`), and the **anti-fabrication rule** (PASS over publish). Reference corpus: IWR Notes 01-03 + Beyond the Deal Ed. 01.

---

### `lib/ai/claude.ts` — Anthropic Claude client

- **Purpose:** Claude client for F16 personalized briefs + F18 translation; graceful no-op (`claude.ts:1-2`).
- **Env vars:** `ANTHROPIC_API_KEY` (`:4`); `ANTHROPIC_MODEL` (default `claude-sonnet-4-5-20250929`) (`:5`).
- **Auth:** headers `x-api-key`, `anthropic-version: 2023-06-01`.
- **Functions:**
  - `isClaudeConfigured()` (`:7`).
  - `callClaude(opts)` (`:38`) — single **POST** `https://api.anthropic.com/v1/messages`; body `{ model, max_tokens(1500), temperature(0.4), system, messages }`; returns `{ ok, text, inputTokens, outputTokens }`.
  - `callClaudeResearch(opts & {maxSearches?})` (`:103`) — same endpoint with server-side `web_search_20250305` tool (`max_uses` default 4); loops ≤6 steps handling `stop_reason==="pause_turn"` (re-sends assistant partial turn); accumulates text + dedups every surfaced `web_search_tool_result` URL; returns `ClaudeResearchResult { …, searchedUrls[], searchCount }`. Default `max_tokens` 4000.
- **Types:** `ClaudeMessage`, `ClaudeOptions {system?, messages, maxTokens?, temperature?, model?}`, `ClaudeResult`, `ClaudeResearchResult`.
- **External service:** Anthropic Messages API (incl. server-side web_search).

---

### `lib/ai/gemini.ts` — Gemini Omni (Veo 3) video client

- **Purpose:** F13 daily cinematic intro generator via Gemini Developer API (Veo 3); no-op without key → homepage skips intro overlay (`gemini.ts:1-6`).
- **Env vars:** `GEMINI_API_KEY` (`:8`); `GEMINI_BASE_URL` (default `https://generativelanguage.googleapis.com/v1beta`) (`:9`); `GEMINI_VIDEO_MODEL` (default `veo-3.0-generate-preview`) (`:10`).
- **Auth:** API key as `?key=` query param.
- **Functions:**
  - `isGeminiConfigured()` (`:12`).
  - `generateVideo(req)` (`:35`) — **POST** `/models/<model>:predictLongRunning?key=…`; body `{ instances:[{ prompt, aspectRatio(16:9), durationSeconds(4) }] }`; returns long-running `operationId` (`data.name`).
  - `getVideoOperation(operationId)` (`:69`) — **GET** `/<operationId>?key=…`; returns `videoUrl` from `response.predictions[0].video.uri` when `done`.
  - `buildDailyIntroPrompt({headline, scene?})` (`:100`) — composes the Dubai-skyline golden-hour cinematic prompt + negatives.
- **Types:** `GeminiVideoRequest {prompt, aspectRatio?, durationSeconds?}`, `GeminiVideoResult {ok, operationId?, videoUrl?, error?}`.
- **External service:** Google Generative Language API (Veo 3).

---

### `lib/ai/vertex.ts` — Vertex AI (Imagen 4 + Veo 3) via Workload Identity Federation

- **Purpose:** Vertex AI client authed by **WIF OIDC token exchange** (no static SA JSON) — Vercel OIDC → GCP STS → impersonate `vercel-news-runtime` SA; bills against the Google AI Ultra Cloud credit (`vertex.ts:1-22`).
- **Imports:** `ExternalAccountClient` (`google-auth-library`), `getVercelOidcToken` (`@vercel/oidc`) (`:24-25`).
- **Env vars:** required `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`; optional `VERTEX_LOCATION` (default `us-central1`), `VERTEX_IMAGEN_MODEL` (default `imagen-4.0-fast-generate-001`), `VERTEX_VEO_MODEL` (default `veo-3.0-generate-001`) (`:27-35`).
- **Auth internals:** `isVertexConfigured()` (`:37`); `getAuthClient()` (cached `ExternalAccountClient.fromJSON` with STS `audience`/`token_url`/`service_account_impersonation_url` + `subject_token_supplier.getSubjectToken → getVercelOidcToken()`) (`:54`); `getAccessToken()` returns Bearer token, tolerant of string|`{token}` shape (`:80`).
- **Functions:**

| Function | Method/Endpoint | Detail |
|---|---|---|
| `generateImage(req)` (`:131`) | **POST** `https://<LOC>-aiplatform.googleapis.com/v1/projects/<P>/locations/<LOC>/publishers/google/models/<model>:predict` | Imagen 4. `IMAGEN_DIMENSIONS` map per aspect ratio (`:122`); params `sampleCount`, `aspectRatio`, `personGeneration:"dont_allow"`, `safetySetting:"block_only_high"`; returns images as `data:` URLs from `bytesBase64Encoded` |
| `startVideoGeneration(req)` (`:231`) | **POST** `…/<VEO_MODEL>:predictLongRunning` | Veo 3; params incl. `personGeneration:"allow_adult"`; returns `operationName` |
| `pollVideoGeneration(operationName)` (`:288`) | **POST** `…/<modelPath>:fetchPredictOperation` (non-standard) | parses model path from op name via regex; returns `done` + `videoUri` (GCS `gcsUri` or legacy `generatedSamples[].video.uri`, or base64 `data:` fallback) |

- **Types:** `ImagenRequest/ImagenResult`, `VeoRequest/VeoStartResult/VeoPollResult`.
- **External services:** GCP STS (`sts.googleapis.com`), IAM Credentials, Vertex AI aiplatform (Imagen 4 + Veo 3).

---

### `lib/ai/higgsfield.ts` — Higgsfield Soul image client

- **Purpose:** F14 AI cover-image per article (Higgsfield Soul); cached to Vercel Blob on first gen; no-op without key (`higgsfield.ts:1-6`).
- **Env vars:** `HIGGSFIELD_API_KEY` (`:8`); `HIGGSFIELD_BASE_URL` (default `https://api.higgsfield.ai`) (`:9`).
- **Auth:** `Authorization: Bearer <key>`.
- **Functions:**
  - `isHiggsfieldConfigured()` (`:11`).
  - `generateImage(req)` (`:36`) — **POST** `/v1/images/generate`; body `{ prompt, negative_prompt, aspect_ratio(16:9), seed, model:"soul" }`; returns `url` (`data.url||data.image_url`) + `credits` (`credits_used`).
  - `buildArticleCoverPrompt({category, market[], title})` (`:75`) — composes the Knight Frank/Mansion-Global editorial-photography prompt (navy+gold+cream, golden-hour, no people) + negatives.
- **Types:** `HiggsfieldImageRequest {prompt, aspectRatio?, negativePrompt?, seed?}`, `HiggsfieldImageResult {ok, url?, credits?, error?}`.
- **External service:** Higgsfield Soul image API.

---

### `lib/ai/rate-limit.ts` — in-memory IP rate limiter

- **Purpose:** Day-1 abuse control for AI endpoints; in-memory `Map` **per Vercel instance** (explicitly flagged to replace with Vercel KV / Upstash Redis at scale) (`rate-limit.ts:1-3`). No env, no external calls.
- **State:** module-level `buckets: Map<string, {count, resetAt}>` (`:5`).
- **Functions:**
  - `checkRateLimit(ip, config={max:5, windowMs:3_600_000})` (`:20`) — sliding fixed-window per IP; returns `{ allowed, remaining, resetAt }`. Default **5 calls / hour**.
  - `getClientIp(headers)` (`:43`) — reads `x-forwarded-for` (first) → `x-real-ip` → `"unknown"`.
- **Types:** `RateLimitConfig {max, windowMs}`, `RateLimitResult {allowed, remaining, resetAt}`.
- **⚠️ note:** non-distributed — per-instance state means limits are not enforced globally across Vercel lambdas.

---

### Cross-cutting notes

- **Uniform client contract:** every external client (Postiz/Telegram/Discord/Listmonk/ElevenLabs/Claude/Gemini/Vertex/Higgsfield) module-loads env, exposes `isXConfigured()`, and returns a tagged result object on failure rather than throwing; `cache:"no-store"` used on most fetches.
- **Two voice-validation modules** exist (`profile.ts` 6-gate vs `validator.ts` 8-gate); `validator.ts` is the citation-aware one wired to `SOURCE_WHITELIST`. ⚠️ unresolved: which is canonical in the live draft pipeline is not determinable from these files alone (both are imported by consumers under `lib/news-review/` + `lib/validators/`).
- **Env-var inventory by provider (names only):**
  - Distribution: `POSTIZ_BASE_URL`, `POSTIZ_API_TOKEN`, `POSTIZ_<CHANNEL>_ID` (×12), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, `DISCORD_WEBHOOK_URL`, `NEXT_PUBLIC_DISCORD_AVATAR_URL`, `NEXT_PUBLIC_SITE_URL`.
  - Newsletter: `LISTMONK_BASE_URL`, `LISTMONK_API_USERNAME`, `LISTMONK_API_TOKEN`, `LISTMONK_DIGEST_LIST_ID`, `LISTMONK_FROM_EMAIL`, `LISTMONK_FROM_NAME`, `LISTMONK_TEMPLATE_ID`.
  - Voice: `ELEVENLABS_API_KEY`, `ELEVENLABS_RAJ_VOICE_ID`, `ELEVENLABS_MODEL`, `ELEVENLABS_STABILITY`, `ELEVENLABS_SIMILARITY`, `ELEVENLABS_STYLE`, `ELEVENLABS_SPEED`.
  - AI: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_VIDEO_MODEL`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_BASE_URL`, `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `VERTEX_LOCATION`, `VERTEX_IMAGEN_MODEL`, `VERTEX_VEO_MODEL`.

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

## Coverage Audit — news-investwithraj

> Independent inventory of the live repo (`app/`, `lib/`, `scripts/`, `content/`, crons, env) cross-checked against this map. Performed by the iwr-backend-map coverage-audit pass. Env var NAMES only — no secret values.

### Methodology / scope inventoried
- **Page routes:** 18 `app/**/page.tsx` — all 18 documented.
- **Route handlers:** 28 `app/**/route.ts(x)` (24 API + 4 special: `rss.xml`, `news-sitemap.xml`, `llms.txt`, IndexNow key file) — all 28 documented.
- **Metadata files:** `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`, `app/template.tsx`, `app/not-found.tsx`, `app/icon.svg` — all documented. (No `manifest.ts`, `error.tsx`, `loading.tsx`, or `opengraph-image.*` files exist.)
- **`lib/`:** 74 files — 70 documented, **4 not documented** (see below).
- **`scripts/`:** 7 files — all 7 documented.
- **`content/`:** all registries + types documented (15 news articles + index/types covered collectively; `articles/index.ts` is the lone gap).
- **Crons:** `vercel.json` single cron documented; `.github/workflows/news-cron.yml` is **named but its schedule/config is not documented**.
- **Env vars:** ~95 distinct `process.env.*` names in source — all source-grounded names documented. 5 example-only names + 1 table omission found below.

### Missing from the map

**Library files that EXIST but are not documented (none are in the news-pipeline path — they are the immersive/v17 front-end runtime):**
- `lib/audio.ts` — v13 Web Audio UI sound system; **live** (imported by `components/UISounds.tsx`, `components/v16/sections/EngagementCTA.tsx`).
- `lib/motion.ts` — `"use client"` motion hooks; **live** (imported by `components/CustomCursor.tsx`, referenced in `app/globals.css`).
- `lib/scroll/scrollRig.ts` — v17 scroll-rig singleton for scroll-driven 3D; **live** (imported by `components/immersive/ImmersiveWorld.tsx`).
- `lib/frame-manifest.ts` — v14 Draftly FrameScroll typed registry (generated by `scripts/generate-frames.mjs`); present, not currently imported by `app/` or `components/` (dormant/asset registry).

**Cron / scheduling not documented:**
- `.github/workflows/news-cron.yml` — the map names this file (line 182) as "the real daily driver" but never documents its actual config: **three** schedules `cron: "7 3 * * *"`, `"7 9 * * *"`, `"7 15 * * *"` (03:07 / 09:07 / 15:07 UTC = **07:07 / 13:07 / 19:07 GST, 3×/day** — NOT the single daily run implied by the `vercel.json` section), plus `workflow_dispatch`, `node-version: "22"`, `checkout ref: main`, `npm ci` → `npx tsx scripts/draft-once.ts`, env `SITE_URL` / `POST_PUBLISH_SECRET` / `ANTHROPIC_API_KEY` (GH secrets). The 3×/day cadence is a material omission given the map's cron section only decodes the (fallback) `vercel.json` `3 3 * * *`.

**Env vars that EXIST but are not in the env inventory:**
- `POSTIZ_INSTAGRAM_ID` — `.env.production.example` (provisioned; code uses the split `POSTIZ_INSTAGRAM_FEED_ID`/`_STORIES_ID`).
- `POSTIZ_YOUTUBE_ID` — `.env.production.example` (provisioned; code uses `POSTIZ_YOUTUBE_SHORTS_ID`).
- `REDDIT_CLIENT_ID` — `.env.production.example` (provisioned for the disabled Reddit fetcher/queue; not yet read in code).
- `REDDIT_CLIENT_SECRET` — `.env.production.example` (same).
- `X_BEARER_TOKEN` — `.env.production.example` (provisioned for future X/sentiment; not yet read in code).
- `APPLE_PASS_CERT_PASS` — referenced in map prose (wallet route, line 637) and in `app/api/wallet/install/route.ts` header comment, but **omitted from the "COMPLETE ENV VAR INVENTORY" Wallet table** (only 4 of the 5 Apple vars listed there).

**Content file not documented:**
- `content/articles/index.ts` — a legacy/secondary registry distinct from `content/news/index.ts`; never referenced in the map (the map documents `content/news`, `areas`, `power-list`, `closing-bell`, `insights`, `daily-anchor` but not `articles`).

### Possible inaccuracies (claims in the map not verifiable in code, or contradicted by it)

- **Cron cadence framing.** The "vercel.json — Cron schedule" section presents `3 3 * * *` (03:03 UTC ≈ 07:03 GST) as the daily driver and frames the GitHub Actions runner only as "the real daily driver." In reality the GH workflow runs **3×/day** (`7 3/9/15`), so the "07:00 GST morning brief" single-run framing understates actual publishing cadence. Not wrong about the fallback, but incomplete.
- **`vercel.json` line cite.** Map cites the cron at `vercel.json:3-5`; the live file has the cron object on line 4 (`crons` array opens line 3). Cosmetic line-number drift only.
- **"8-gate validator" canonicality.** The map flags (correctly) that two voice-validation modules exist (`lib/voice/profile.ts` 6-gate vs `lib/voice/validator.ts` 8-gate) and states it is "not determinable … which is canonical." This remains an unresolved claim, not an inaccuracy — noted here as still-open. `lib/validators/citation.ts` + `lib/validators/index.ts` are referenced but their relationship to the two voice modules is not fully traced in the map.
- **Apple Wallet env count.** Map prose lists 5 Apple vars incl. `APPLE_PASS_CERT_PASS`, but the consolidated env table lists only 4 — internal inconsistency within the map (see Missing, above).

### Coverage estimate

**~95% of source files documented** (70/74 `lib/` + 18/18 pages + 28/28 route handlers + 7/7 scripts + content registries). Gaps are concentrated in (a) the immersive/v17 front-end runtime libs (`audio`/`motion`/`scrollRig`/`frame-manifest` — outside the backend-pipeline focus the map was scoped to), (b) the GitHub Actions cron's 3×/day schedule, and (c) 6 provisioned-but-unwired / table-omitted env names. No API route, page route, or pipeline lib is missing.
