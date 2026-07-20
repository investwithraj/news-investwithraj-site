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
