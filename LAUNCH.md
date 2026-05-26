# Launch runbook — news.investwithraj.com

Single-source guide for going from "deployed code" → "real content firehose."
Every action item, every URL, every env var, every copy-paste value.

---

## 0 · Where everything lives

| | |
|---|---|
| GitHub repo | https://github.com/investwithraj/news-investwithraj-site |
| Vercel project | `news-investwithraj-site` on team **office-2271's projects** (id `team_fX0MDhZugKxOW3rijXKAgYiA`, project `prj_kfTRKu4x1NZThilS9JTJTFt8S47h`) |
| Live URL | https://news.investwithraj.com |
| Email tied to Vercel team | office@investwithraj.com |
| Cloudflare zone | `investwithraj.com` (CNAME `news → cname.vercel-dns.com`, DNS-only / grey-cloud) |

> **Important** — your local `vercel` CLI is logged in as `rajtomardxb-7565` (personal team), NOT `office-2271`. To use CLI for env-var management, run `vercel logout` and re-login with the office-2271 credentials, OR generate a Vercel API token scoped to that team and pass it via `--token`.

---

## 1 · Tier 1 — Go-live (≈30 min)

### 1.1 — POST_PUBLISH_SECRET ✅ generated

```
a45f779d74d1f78a1683ddf6c8c90c55b38c160385fbe41ad6579a53394292ea
```

**Add to Vercel** (Production + Preview + Development):
1. https://vercel.com/dashboard → switch context to **office-2271's projects** → open `news-investwithraj-site`
2. Settings → Environment Variables
3. **Add New** → Key `POST_PUBLISH_SECRET`, Value above, check all 3 environments
4. Save

### 1.2 — Vercel KV

1. Same Vercel project → **Storage** tab → **Create Database** → **KV**
2. Name it `iwr-news-queue`, pick region closest to UAE (Frankfurt `fra1` or Mumbai `bom1`)
3. Click **Connect Project** → news-investwithraj-site → all 3 environments
4. The env vars `KV_REST_API_URL` / `KV_REST_API_TOKEN` / `KV_REST_API_READ_ONLY_TOKEN` / `KV_URL` are auto-injected

### 1.3 — Internal dashboard

```
INTERNAL_BASIC_AUTH=raj:WhatEverStrongPasswordYouLike
```

Replace the password. Add to Vercel env (all 3 environments). After redeploy:
- https://news.investwithraj.com/internal/dashboard — browser will prompt basic-auth

### 1.4 — Redeploy

After adding env vars, trigger a fresh deploy so they're picked up:
- Vercel project → **Deployments** → top deployment → ⋯ menu → **Redeploy** → uncheck "Use existing Build Cache" → confirm
- Or push any commit to `main` (auto-triggers)

### 1.5 — First 3 articles ✅ committed

Already in `content/news/`:
- `2026-05-26-dld-21b-week.ts` (AED 21B DLD weekly print)
- `2026-05-26-modon-hudayriyat-golf-estate.ts` (Modon launch read)
- `2026-05-26-golden-visa-mortgage-flex.ts` (Feb 2026 visa rule update)

All cite real published sources (Arabian Business, Aletihad, Gulf News, Hudson McKenzie, etc.). All pass the Voice Profile 8-gate validator. Live at:
- https://news.investwithraj.com/news
- https://news.investwithraj.com/news/2026-05-26-dld-21b-week
- https://news.investwithraj.com/news/2026-05-26-modon-hudayriyat-golf-estate
- https://news.investwithraj.com/news/2026-05-26-golden-visa-mortgage-flex

### 1.6 — Schedule-skill cron

Three crons to register (07:00 GST + 16:30 GST + post-publish webhook):

```
# In Claude CLI, run /schedule with this prompt:

Register 3 cron jobs for news.investwithraj.com:

CRON 1 — Daily content pipeline · 07:00 GST (03:00 UTC)
1. Read content/sources/registry.ts for the 20-source whitelist
2. Run scripts/news-pipeline.ts to:
   a. Fetch from RSS + WebFetch all sources
   b. Dedupe + cluster + score with 4-axis weights
   c. Pick top 5-10 stories
3. For each story, draft a NewsArticle .ts file following the Voice Profile + Semaform structure
4. Validate every draft against lib/voice/validator.ts 8-gate checks; reject + redraft any that fail
5. git add content/news/ + commit "Daily content drop — YYYY-MM-DD"
6. git push origin main → Vercel auto-deploys
7. After Vercel READY (poll /api/post-publish GET), POST to /api/post-publish?secret=$POST_PUBLISH_SECRET with the new URLs
8. POST to /api/queue/add?secret=$POST_PUBLISH_SECRET with slugs to enqueue outreach drafts
9. POST to /api/digest?secret=$POST_PUBLISH_SECRET to fire the morning digest (if Listmonk configured)
10. POST to /api/anchor?secret=$POST_PUBLISH_SECRET with mode=full to regenerate the Daily Anchor

CRON 2 — Closing Bell · 16:30 GST (12:30 UTC)
1. Read NEWS_ARTICLES from today only
2. Draft a ClosingBellArticle: title, 3 highlights, 1-2 sentence Raj close
3. Commit to content/closing-bell/YYYY-MM-DD-closing-bell.ts, push
4. After deploy, POST to /api/distribute?secret=$POST_PUBLISH_SECRET with channels=[telegram, discord]

CRON 3 — Press inbox sweep · daily 09:00 GST (05:00 UTC)
1. POST /api/press-inbox?secret=$POST_PUBLISH_SECRET { "markSeen": true, "minScore": 0.3 }
2. Review content/press-inbound/*.json drafts manually next morning
```

---

## 2 · Tier 2 — AI layer (≈45 min)

| # | Sign up | What to paste in Vercel |
|---|---|---|
| 7 | https://console.anthropic.com/settings/keys → Create Key | `ANTHROPIC_API_KEY=sk-ant-…` |
| 8 | https://elevenlabs.io/app/settings/api-keys (account that owns voice `3PmZaGGPRbZDCjAl7KBE`) | `ELEVENLABS_API_KEY=sk_…` |
| 9 | https://aistudio.google.com/app/apikey | `GEMINI_API_KEY=AI…` |
| 10 | Higgsfield (already on your stack — copy from `~/.claude-mcp-env/.env`) | `HIGGSFIELD_API_KEY=…` |

Smoke test after each:
```bash
# Anthropic + Higgsfield + Gemini all power the brief/anchor endpoints:
curl https://news.investwithraj.com/api/brief -X POST -H "Content-Type: application/json" \
  -d '{"topic": "Saadiyat Island vs Hudayriyat — 2026 absorption read"}'

# ElevenLabs:
curl https://news.investwithraj.com/api/voice -X POST -H "Content-Type: application/json" \
  -d '{"text": "The Dubai market is compressing on the yield band."}' --output test-voice.mp3
```

---

## 3 · Tier 3 — Distribution (≈2 hours)

| # | Action | Where |
|---|---|---|
| 11 | Postiz on Hetzner CX22 — follow project_listmonk_migration.md. Get API token + per-channel IDs | Set `POSTIZ_BASE_URL`, `POSTIZ_API_TOKEN`, `POSTIZ_LINKEDIN_PERSONAL_ID`, etc. |
| 12 | Listmonk on same Hetzner CX22. SES `news.investwithraj.com` domain (us-east-1) | Set `LISTMONK_BASE_URL`, `LISTMONK_API_USERNAME`, `LISTMONK_API_TOKEN`, `LISTMONK_DIGEST_LIST_ID`, `LISTMONK_FROM_EMAIL=raj@news.investwithraj.com` |
| 13 | Telegram: BotFather → /newbot → token. Create channel `@InvestWithRaj_News`, add bot as admin | Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` (use @userinfobot for the -100xxxx ID) |
| 14 | Discord: Server → Settings → Integrations → Webhooks → New | Set `DISCORD_WEBHOOK_URL` |
| 15 | Google Workspace app password for raj@news.investwithraj.com | Set `IMAP_HOST=imap.gmail.com`, `IMAP_PORT=993`, `IMAP_USERNAME=raj@news.investwithraj.com`, `IMAP_PASSWORD=<app password>` |

> **IMAP IMPORTANT:** Never enable Resend "Inbound MX" on the apex — it'll silently break Google Workspace inbound mail. Resend should only set DKIM TXT + SPF TXT + bounce MX on the `send` subdomain. (Memory note `feedback_resend_dns_trap.md`.)

---

## 4 · Tier 4 — Analytics (≈30 min)

All pixels gated by the Klaro consent banner. Add only the ones you want:

| # | Source | Vercel env var |
|---|---|---|
| 16 | https://analytics.google.com → Admin → property → Data streams → Web | `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX` |
| 17 | https://plausible.io (cookieless) | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=news.investwithraj.com` |
| 18 | https://clarity.microsoft.com → New project (free) | `NEXT_PUBLIC_MS_CLARITY_ID=xxxxxxxxxx` |
| 19 | Meta Business Manager → Events Manager → Pixels | `NEXT_PUBLIC_META_PIXEL_ID=000000000000000` |
| 20 | LinkedIn Campaign Manager → Account Assets → Insight Tag | `NEXT_PUBLIC_LINKEDIN_INSIGHT_ID=0000000` |
| 21 | (Only if running paid ads) X / TikTok / Google Ads | `NEXT_PUBLIC_X_PIXEL_ID`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` |

---

## 5 · Tier 5 — Polish (optional)

| # | What | Set | Cost |
|---|---|---|---|
| 22 | Mapbox token for /map 3D buildings | `NEXT_PUBLIC_MAPBOX_TOKEN=pk.…` | Free 50k loads/mo |
| 23 | Apple Developer + PassKit certs | `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_CERT_PASS`, `APPLE_WWDR_PEM` | $99/yr |
| 24 | Google Wallet issuer | `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | Free |
| 25 | DLD live API (Dubai Pulse / dxbinteract) | `DLD_API_URL`, `DLD_API_KEY` | Varies |
| 26 | Reddit free + X paid Basic ($100/mo) for /pulse live scrapers | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `X_BEARER_TOKEN` | $100/mo (X only) |

---

## 6 · Tier 6 — Cross-asset

| # | Action |
|---|---|
| 27 | Drop a 1200×1500 JPG at `public/raj-portrait.jpg`. AuthorBrand placeholder auto-upgrades (you'll need to update `components/homepage/AuthorBrand.tsx` to actually render it once the file exists). |
| 28 | Area heroes: either drop 30 JPGs at `public/areas/<slug>-placeholder.jpg`, OR run `/api/cover-image` for each area slug to auto-generate via Higgsfield. |
| 29 | Power List 2026 — edit `content/power-list/index.ts` and populate the array with 100 hand-curated entries. Page auto-renders. |
| 30 | Pull Block 1-4 futurism into IWR root (`investwithraj.com`): KineticHeadline, MagneticCursor, AuroraBackground, DubaiSkyline3D, CapitalFlowGlobe, VoiceMode, AI brief endpoint. Separate session. |

---

## 7 · Day-1 smoke tests (after Tier 1 done)

```bash
# Live + new articles indexed:
curl https://news.investwithraj.com/news | grep -c "2026-05-26"   # should be 3

# Sitemap entries:
curl https://news.investwithraj.com/sitemap.xml | grep -c "/news/"  # should be ≥3

# News-sitemap (Google News spec):
curl https://news.investwithraj.com/news-sitemap.xml | head -30

# RSS feed:
curl https://news.investwithraj.com/rss.xml | head -30

# Endpoint health:
curl "https://news.investwithraj.com/api/post-publish?secret=$POST_PUBLISH_SECRET" \
  -X POST -H "Content-Type: application/json" -d '{}'  # should return ok:true

# Internal dashboard (basic-auth prompt):
curl -I "https://news.investwithraj.com/internal/dashboard"  # should return 401 with WWW-Authenticate
```

---

## 8 · Roadmap after launch

- Track: open rates on Listmonk, engagement on Postiz, /pulse heatmap activity
- Iterate: Voice Profile every 2 weeks based on what readers respond to
- Expand: Power List Q3 2026, second weekly Insight long-form, MEED partnership outreach

---

Built across Block 1 → Block 4 → Block 5. **64 static pages**, **21 dynamic API routes**, **8 AI integrations**, **fully PDPL + GDPR compliant**. Ready to go live the moment Tier 1 env vars land.
