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
