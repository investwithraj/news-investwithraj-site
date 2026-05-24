# news.investwithraj.com — agent notes

This is the **news firehose subdomain** of the Invest With Raj brand
family. It is a separate Next.js 16 app from the IWR root repo at
`~/Downloads/landing page/investwithraj/`. Do not cross-pollinate.

## What lives here

- News articles (5-15/day, AI-drafted from verified sources, auto-published)
- Insights (1-2/week, longer deep-dives, PR-reviewed before commit)
- Programmatic Areas pages (30+ priority Dubai/AD areas by Month 2)
- `/about` + `/about/editorial-standards` (Google News E-E-A-T)
- `/legal/privacy` (PDPL + GDPR)
- `/internal/dashboard` (basic-auth, Approval Queue for Reddit/Quora/HARO)

## What does NOT live here

- The 12-page institutional Notes (canonical: investwithraj.com/notes/[slug])
- The lead form + Plug In CTA (canonical: investwithraj.com/#engagement)
- Curated Areas + Distress Positions inventory (canonical: investwithraj.com/areas/[slug])
- Beyond the Deal LinkedIn newsletter canonical (LinkedIn Pulse)
- Cal.com booking widget (only on IWR root for now)

## Cross-domain coordination

- Every article footer CTA → `investwithraj.com/?utm_source=news&...` (lead-back)
- GA4 cross-domain linker enabled (G-8L028E8RFH on both)
- Same Meta Pixel + LinkedIn Insight (unified retargeting)
- Beyond the Deal LinkedIn editions mirrored here at `/insights/[slug]`
  with `rel=canonical → LinkedIn URL` (give LinkedIn the SEO credit)
- IWR Notes referenced by name in news articles when relevant
- Cross-domain link decoration via the GA4 linker config

## Content pipeline (Block 2, not yet built)

Daily routine 06:00 GST via `schedule` skill:
1. Pull last 24h from 20-source verified whitelist (RSS + WebFetch)
2. De-dupe + cluster by topic + score (UHNW relevance × freshness × source tier)
3. Apply Voice Profile (`lib/voice/raj-profile.md`) to draft top 5-15
4. Validate: ≥1 whitelist citation + 0 banned-lexicon + ≥3 approved-lexicon
5. Commit → Vercel auto-deploys (~60-90s)
6. IndexNow + Google Indexing API ping
7. Postiz schedules 14 social channels
8. Medium + Substack + Beehiiv reposts with `rel=canonical`
9. Listmonk daily digest queued for 07:30 GST
10. Telegram Bot + Discord webhooks fire
11. Reddit / Quora / HARO drafts → Approval Queue dashboard

## Coordination rules

- VS Code agent OFF. Only one Claude session at a time.
- News content files (`content/news/*.ts`) only edited by the scheduled
  routine OR via the news-pipeline scripts. Do not manually edit articles.
- IWR root files NEVER edited from this repo. Cross-references only.
- This repo's `main` branch ships to production via Vercel auto-deploy.
- Build verification (`rm -rf .next .turbo && npm run build`) MANDATORY
  before every push — same lesson learned on IWR root.

## Stack

Next.js 16 + React 19 + Tailwind 4 + TypeScript strict.
Same v11 palette + typography as IWR root (Space Grotesk + Inter +
JetBrains Mono + Fraunces, navy/gold primary + cyan live-signal accent).
