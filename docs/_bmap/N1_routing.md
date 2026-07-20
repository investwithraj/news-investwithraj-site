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
