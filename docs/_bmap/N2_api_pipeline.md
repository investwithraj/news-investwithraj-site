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
