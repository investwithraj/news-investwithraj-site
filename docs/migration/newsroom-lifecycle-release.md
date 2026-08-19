# Newsroom lifecycle release contract

The disposition authority remains news-url-disposition.csv. This release
contract does not change any row or editorial decision.

## Single activation switch

NEWSROOM_LIFECYCLE_CUTOVER=1 is the only value that activates the URL
consolidation. The variable is server-side release configuration, not a secret
and not a NEXT_PUBLIC value.

- Unset, 0, true, whitespace and every other value mean **off**.
- Off preserves the current public route response and the exact 79-URL
  pre-cutover sitemap.
- On activates exactly 31 approved one-hop redirects and the six new removal
  gates: five article URLs plus /pulse. Each exact URL returns a direct 410
  Gone response with no redirect, no removed-page metadata, no-store caching
  and a noindex/nofollow/noarchive header.
- On emits the exact 31 KEEP + IMPROVE URLs in sitemap discovery.
- /wallet remains outside that six-route release because it already returned
  the unreleased-product 404 before this lifecycle work.
- The three held redirects remain readable and non-redirecting. They are
  `index, follow` while lifecycle cutover is off and become `noindex, follow`
  only while lifecycle cutover is on; the evidence-hold preview alone does not
  change their indexation.
- PRIVATE and research records remain unavailable in both states.

The flag is evaluated at build/release time. Changing an environment value is
not a production cutover until a separately approved deployment is created.
Before activation, attach Search Console, backlink/referral, analytics and
access-log demand checks for all six removals. The Kuwait and Fendi articles
remain medium-confidence removal decisions until that evidence is reviewed.

## Evidence-hold preview

`NEWSROOM_EVIDENCE_HOLD_PREVIEW=1` enables a separate evidence-hold preview
only when `VERCEL_ENV` is not `production`. The default is off, every value
other than the exact string `1` is off, and Production fails closed to the
existing public projection even if the flag is present.

The preview uses the checked-in 24-record remediation manifest. Those articles
remain readable at their self-canonical URLs, but become noindex and emit no
NewsArticle, FAQ, image, or article breadcrumb schema. Discovery, the front
page, RSS, the news sitemap, and the generic sitemap exclude the held records.
With lifecycle cutover off the preview emits 55 sitemap URLs and 17 discovery
articles; with lifecycle cutover on it emits 7 sitemap URLs and 2 discovery
articles. Redirect and six-route removal behavior is unchanged in both modes.

This flag is non-authorizing. It does not activate lifecycle cutover, approve
the 24 evidence records, prove a hosted preview, or permit production release.

## Outbound safety is not release-dependent

OG article rendering, the automated brief source packet, digest previews,
distribution previews and slug-driven outreach drafts always use the approved
public lifecycle projection. A disabled cutover therefore cannot cause a
REMOVE, PRIVATE, research or redirect-source record to be re-syndicated.

## Canonical-host rule

Every activated local lifecycle destination is converted to an absolute
https://news.investwithraj.com/... URL before it enters Next.js redirect
configuration. If www.news.investwithraj.com DNS is enabled later, an exact
retired URL reaches its final canonical destination in one hop instead of
first canonicalising the host.

## Pinned advisory evidence

advisory-redirect-evidence-2026-08-16.csv is the minimal immutable snapshot
needed to validate external redirect destinations. It was copied from the
advisory repository's live-production-delta-2026-08-16.csv, captured at
2026-08-15T23:03:02.717Z. The snapshot contains only the 17 approved external
redirect targets and the held Wynn target. Refreshing it requires a new dated
artifact; do not silently edit historical observations.

Source provenance: advisory commit
3efac6cbf8f7c1c082397ae54e80083977a5e6d9 (`docs: record live production
migration delta`), source CSV SHA-256
0C3DF6DA4B3483247603AE3B9EB047A4D2C584F7084AD8632C4DF7B51536E5C2.
The lifecycle test reads only the pinned newsroom snapshot and never a sibling
worktree.
