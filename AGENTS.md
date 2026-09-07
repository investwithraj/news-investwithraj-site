# news.investwithraj.com — agent notes

This is the **news firehose subdomain** of the Invest With Raj brand
family. It is a separate Next.js 16 app from the IWR root repo at
`~/Downloads/landing page/investwithraj/`. Do not cross-pollinate.

## What lives here

- News articles (at most one evidence-ready article per scheduled run)
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

- Every article footer CTA → `investwithraj.com/engage?utm_source=news&...` (lead-back)
- GA4 cross-domain linker enabled (G-8L028E8RFH on both)
- Same Meta Pixel + LinkedIn Insight (unified retargeting)
- Beyond the Deal LinkedIn editions mirrored here at `/insights/[slug]`
  with `rel=canonical → LinkedIn URL` (give LinkedIn the SEO credit)
- IWR Notes referenced by name in news articles when relevant
- Cross-domain link decoration via the GA4 linker config

## Content pipeline

The authoritative GitHub Actions routine runs at 03:07 UTC / 07:07 Dubai:
1. Pull current material from the configured discovery sources.
2. De-duplicate, cluster and rank candidate events.
3. Research a bounded candidate and retain independently fetched evidence.
4. Validate every source, material figure, date, voice and integrity rule.
5. Hold anything incomplete in The Desk; never treat discovery feeds as evidence.
6. Publish at most one passing article, then verify its exact canonical deployment.
7. Notify IndexNow only after canonical verification and persist the receipt.
8. Expose the article through the homepage, canonical sitemap, Google News sitemap and RSS.

Google News eligibility is automatic; ordinary news articles must not use the
Google Indexing API. Social auto-posting, Medium/Substack/Beehiiv reposting,
email sends, Telegram and Discord delivery are disabled until separately
authorised and protected by an idempotent delivery design.

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
The approved v1.2 Invest With Raj × The Dubai Upgrade system is authoritative:
blue and its shades, governed marks and the current typography hierarchy. Do
not reintroduce the retired brown/gold or legacy v1.1 identity.
