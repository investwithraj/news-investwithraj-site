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
