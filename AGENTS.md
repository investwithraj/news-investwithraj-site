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

Read [the daily news standard](docs/editorial/DAILY-NEWS-STANDARD.md) before
writing or changing the news routine. Fresh news is a concise, original update,
not a research report stretched to satisfy a template.

The authoritative GitHub Actions routine runs at 01:37 UTC / 05:37 Dubai,
with a recovery window at 05:17 UTC / 09:17 Dubai. Scheduling can be delayed by
GitHub; the configured Vercel watchdog is a separate recovery mechanism.
1. Pull current material from the configured discovery sources.
2. De-duplicate, cluster and rank candidate events.
3. Research a bounded candidate and retain independently fetched evidence.
   Scheduled news uses the explicit short-update format (80–500 words, never
   padded to reach a long-report target). Facts, attribution and originality
   checks still apply; long analysis is a distinct format.
4. Validate every source, material figure, date, voice and integrity rule.
5. Hold anything incomplete in The Desk; never treat discovery feeds as evidence.
6. Publish at most one passing article, then verify its exact canonical deployment.
7. Notify IndexNow only after canonical verification and persist the receipt.
8. Expose the article through the homepage, canonical sitemap, Google News sitemap and RSS.

An automated run without a verified publication for its Dubai day must report
action required, even if yesterday's feed is still within the older freshness
window. Do not describe a completed job as a successful publication.

Use workflow-dispatch `research_only=true` to test normal discovery, research
and staging without approving or publishing any draft. Leave the candidate
inputs at their defaults, `publication_only=false` and `morning_date` empty.
This is a paid research test with private draft writes, not a read-only dry run.
Its result must be described as staged, held or failed, never as published.

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
  When a review server is active, use a new, unused `NEXT_DIST_DIR=.next-<run>`
  for the clean build instead; never delete or replace a running server's build.

## Stack

Next.js 16 + React 19 + Tailwind 4 + TypeScript strict.
The approved v1.2 Invest With Raj × The Dubai Upgrade system is authoritative:
blue and its shades, governed marks and the current typography hierarchy. Do
not reintroduce the retired brown/gold or legacy v1.1 identity.
