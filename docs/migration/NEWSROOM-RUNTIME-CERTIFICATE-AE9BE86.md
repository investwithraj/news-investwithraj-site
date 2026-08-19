# Newsroom local runtime certificate — `ae9be86`

Date: 2026-08-19

Runtime candidate: `ae9be863cba17e3383fa94fc14353fdbdfd5f20a`

Decision: **local runtime evidence complete; release and activation not approved**

This certificate pins the deterministic local build and served-runtime evidence
for the four newsroom modes. It is an offline release-control artifact. It does
not prove a hosted Preview, a deployment, a live-production response, external
provider state, or approval to enable either newsroom flag.

## Exact four-mode matrix

| Runtime mode | Exact build environment | Build ID | Generated pages | Sitemap / discovery / redirects / Gone | Result |
| --- | --- | --- | ---: | --- | --- |
| `default` | non-production; `NEWSROOM_LIFECYCLE_CUTOVER` unset; `NEWSROOM_EVIDENCE_HOLD_PREVIEW` unset | `azEh_JQ359v7jpcnQ9mB1` | 98 / 98 | 79 / 41 / 0 / 0 | PASS |
| `evidence-preview` | non-production; lifecycle unset; `NEWSROOM_EVIDENCE_HOLD_PREVIEW=1` | `KJRXRzCiEd5JTbUNGANmN` | 98 / 98 | 55 / 17 / 0 / 0 | PASS |
| `lifecycle-evidence` | non-production; `NEWSROOM_LIFECYCLE_CUTOVER=1`; `NEWSROOM_EVIDENCE_HOLD_PREVIEW=1` | `8ulS7FqLD7Aqwq9AsFKOo` | 72 / 72 | 7 / 2 / 31 / 6 | PASS |
| `production` | `VERCEL_ENV=production`; lifecycle unset; `NEWSROOM_EVIDENCE_HOLD_PREVIEW=1` for the fail-closed test | `EkpGzaS5-pILkkSDw107F` | 98 / 98 | 79 / 41 / 0 / 0 | PASS |

The Production build proves the evidence-hold preview fails closed to the
unchanged public projection; the lifecycle flag remained unset. Its root
response carried an enforced Content-Security-Policy and no report-only CSP.
The three non-production builds retained report-only CSP, as expected for
local preview-mode evidence.

The served auditor also proved, per applicable mode:

- the declared build asset returned 200;
- all 24 evidence-held articles remained readable and self-canonical;
- held articles were `noindex, follow` and emitted no top-level
  `NewsArticle`, `FAQPage`, `ImageObject`, or `BreadcrumbList` nodes only in
  the two evidence-hold modes;
- the two evidence-certified articles remained indexable with article and
  breadcrumb schema;
- front API, RSS, News sitemap, archive, main sitemap, home, and developer
  discovery matched their exact authoritative slug sets;
- all 31 lifecycle sources matched their current 200/404 authority while the
  lifecycle was off and became exact one-hop 301 responses only in the
  lifecycle build;
- all three held redirects stayed readable with no `Location`; they were
  `index, follow` while lifecycle was off and `noindex, follow` while on;
- the six exact removal routes returned GET and HEAD 410 with `no-store`,
  robots denial, plain-text `Gone`, and no redirect only in the lifecycle
  build; and
- `/wallet`, a non-candidate news path, and a removal-path lookalike remained
  404.

## Deterministic receipts

Each JSON receipt records schema version, candidate SHA, build ID, mode,
expected and actual route results, discovery membership, robots and top-level
schema evidence, and only the boolean `authConfigured`. No credential value is
logged or persisted.

| Mode | Receipt | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `default` | `outputs/newsroom-runtime-ae9be86/default.json` | 66,516 | `97DC310ED747DDF547C9D9608CE4CFE35E284B684127D8FC456AECC39DC2DF4F` |
| `evidence-preview` | `outputs/newsroom-runtime-ae9be86/evidence-preview.json` | 54,059 | `F8EB3F34DB1B31612A6761C827975E5C6B5E98FCA596FAA55D722EA94029C8E7` |
| `lifecycle-evidence` | `outputs/newsroom-runtime-ae9be86/lifecycle-evidence.json` | 49,396 | `0A9A73C43440A217AC5E1A3B1EFE4ED18AEC310B66ECCA190E2D96D200396369` |
| `production` | `outputs/newsroom-runtime-ae9be86/production.json` | 66,337 | `B7EB71274A3965CBD6BF43E428D9C4B9A35AD8F517B3847C8648706E7128A707` |

All four receipts pin the full candidate SHA above, have a 200 build probe,
contain 24 held-article results, two certified-article results, 31 lifecycle
source results, and six removal-route results. `authConfigured` is `false` in
these local receipts; that is explicit evidence that they are not a protected
hosted Preview claim.

## Offline validation and authentication safety

The final candidate validation matrix passed **22 / 22** offline checks. That
matrix includes all 14 package `test:*` aliases, release certification v3,
nonincremental TypeScript, ESLint, and the focused lifecycle, evidence-hold,
remediation, served-runtime, and protected-preview authentication contracts.
No external network or provider mutation is part of that result.

The protected-preview authentication adapter passed its focused security
contract:

- newsroom and advisory credentials are origin-scoped independently;
- malformed, whitespace-padded, or control-character values fail closed;
- existing safe request options are retained while the protection header is
  added;
- credentials are never placed in URLs, JSON serialization, inspection output,
  runtime receipts, or console summaries; and
- the no-credential path remains compatible and is represented only as
  `authConfigured: false`.

This adapter evidence does not prove that a protected hosted Preview exists or
that its access controls have been exercised remotely.

## Flags remain off and non-authorizing

`NEWSROOM_LIFECYCLE_CUTOVER` and `NEWSROOM_EVIDENCE_HOLD_PREVIEW` both remain
default **OFF**. Only the exact value `1` enables their respective local build
behavior, and the evidence-hold flag additionally requires a non-production
environment. The Production evidence build proves that evidence flag fails
closed; the independently authorizing lifecycle flag was unset.

Neither local flag build is authorization to change an environment variable,
create a deployment, activate redirects or removals, alter indexing, or publish
an evidence-held record.

## Remaining release holds

The following counts remain open and are not waived by this certificate:

1. **Three held redirects.** The two article consolidations still need
   fact-preserving destination work, and `/areas/wynn-al-marjan` remains held
   until its advisory destination is indexable and reverified. They remain
   readable and do not redirect.
2. **Twenty-four missing policy-v3 content hashes.** These legacy records remain
   unresolved and fail closed under the evidence-hold preview; 17 require
   content repair.
3. **Seven one-source records.** These are the second-source-required cohort
   within the 24 unresolved records. No record is certified by retention in the
   lifecycle matrix.
4. **Six removal-demand checks.** Search Console, backlink/referral, analytics,
   and access-log demand evidence is still required for all five article
   removals and `/pulse`. The Kuwait and Fendi decisions remain
   medium-confidence until that evidence is reviewed.

External-only and operational holds also remain:

- no hosted protected Preview, deployment, or live-production route audit has
  been performed for this candidate;
- lifecycle activation, evidence-hold activation, DNS changes, redirect
  activation, and removal activation are not approved;
- Search Console, Google/Bing indexing, analytics, email, social, AI, media,
  cron, durable storage/KV, secrets, and provider connections are not proven by
  repository or local runtime tests;
- the pinned advisory redirect snapshot is not a substitute for final live
  destination verification;
- media rights/provenance, consent, privacy, and legal compliance require their
  separate human and production checks; and
- distribution, digest delivery, press-inbox production ingestion, and other
  external mutations remain disabled pending their own reviewed controls.

## Release-control conclusion

The exact candidate is reproducible and internally certified across the four
local modes. Default and Production behavior remain unchanged, the two preview
models are deterministic and fail closed, and their receipts are hash-pinned.
The candidate is **not approved for hosted Preview, deployment, production
cutover, redirect/removal activation, indexing change, or external service
operation** until the holds above are separately cleared and recorded.
