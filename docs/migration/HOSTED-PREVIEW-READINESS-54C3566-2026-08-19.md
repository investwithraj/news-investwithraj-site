# Newsroom hosted Preview readiness — `54c3566`

Date: 2026-08-19

Decision: **ready for a separately approved, create-only protected Preview;
not deployed and not approved for Production or lifecycle activation**

This packet defines the only acceptable hosted Preview target and the evidence
that must be collected around it. It records local and read-only provider facts;
it is not evidence that the proposed branch, deployment, or hosted receipts
exist.

## Exact authorities

| Authority | Exact value | Role |
| --- | --- | --- |
| Runtime and deploy candidate | `54c35668f90dcdf696785c6fd5cc6e67a268e866` | The only application commit that may be deployed by this packet. |
| Audit-tooling authority | `0aabdefaccceaf97fcc336ddcc1ab2c11a7eb145` | Clean committed descendant used to run the hosted audits; it must not replace the deploy candidate. |
| Proposed create-only branch | `codex/iwr-newsroom-preview-54c3566` | Preview branch only; never a Production branch or alias. |

At documentation time, the tooling worktree was clean, the tooling authority
was a descendant of the runtime candidate, and the hosted browser gate was
pinned to the exact runtime candidate. Recheck all three facts immediately
before execution.

## Local evidence — not hosted evidence

A local Preview-mode build of the exact runtime candidate generated **98 / 98**
pages with build ID `Vw3nq0gSlyv08qacF7Xo8`. Both newsroom flags were off.
These receipts were produced against localhost with
`authConfigured: false`; they do not prove Vercel protection, a hosted Preview,
or any public response.

| Evidence | Exact path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Default served runtime | `outputs/hosted-readiness-54c3566/default-runtime.json` | 66,516 | `8806976FD2980BAB389F47C798DD96BA1472AB1223104578BC4CF022E5635E76` |
| Protected-Preview media policy, exercised locally | `outputs/hosted-readiness-54c3566/media-delivery.json` | 9,639 | `110C555EFD7E6FA308D532D097A48B39C45946FAFDB4ECA3692B12010406F358` |

The default receipt proves the local 79-sitemap / 41-discovery / zero-redirect /
zero-Gone projection. The media receipt proves its local 71-request contract:
one build identity, 16 approved `HEAD`, three ranged `GET`, and 51 fail-closed
denials. Neither receipt authorizes a provider change.

## Verified provider snapshot

The following is a read-only snapshot captured at
`2026-08-19T05:49:18Z`. It is a preflight reference, not durable truth; the
invariance auditor must re-read and match provider state immediately before and
after Preview creation.

| Provider fact | Verified value |
| --- | --- |
| Project | `news-investwithraj-site`; `prj_kfTRKu4x1NZThilS9JTJTFt8S47h` |
| Team | `team_fX0MDhZugKxOW3rijXKAgYiA`; slug `office-2271s-projects`; authenticated CLI account `office-2271` |
| Git source | `investwithraj/news-investwithraj-site`; repository ID `1248443593`; Vercel `productionBranch` `main` |
| Runtime settings | Next.js; Node `24.x`; automatic custom-domain assignment enabled |
| Current Production | `dpl_8E31vxF1y7iCkSkZdcxVwHqsGmwe`; `READY`; created `2026-08-13T05:51:25Z`; branch `main`; SHA `4a3280271d9c1b52c941bcad8bfe83bcb6d1f32a`; immutable URL `https://news-investwithraj-site-179bid75d-office-2271s-projects.vercel.app` |
| Stale Preview | `dpl_Bcy5db1KiPzoKGaDq7wdw1vrqwPm`; `READY`; created `2026-07-31T15:38:13Z`; branch `codex-news-redesign`; SHA `4738ed8737ca9591857a7c7b5adba7bd7a8af0d3`; immutable URL `https://news-investwithraj-site-7hnm45pod-office-2271s-projects.vercel.app`; not candidate evidence |
| Protection | SSO enabled with `all_except_custom_domains`; Git fork protection enabled; one bypass entry exists, with its value not read; no password or trusted-IP exception |
| Environment metadata | 50 entries representing 23 unique names; `NEWSROOM_LIFECYCLE_CUTOVER`, `NEWSROOM_EVIDENCE_HOLD_PREVIEW`, and `NEWSROOM_VERCEL_PROTECTION_BYPASS` absent from every target |

The project contains sensitive inherited environment names, including KV/Redis
and internal-auth credentials. No value was read. The candidate Preview must
inherit no newsroom lifecycle/evidence flag and must receive neither audit
credential as application environment. Hosted acceptance uses only read-only
`GET`/`HEAD` application requests and read-only Vercel API requests. It must not
invoke a mutation method or mutation workflow. Batch 9's exact queue and wallet
checks are `GET` rejection/status probes only; any method or route-contract
drift is a stop condition.

The live Git audit at the snapshot time found account `investwithraj` with
`ADMIN`, Git default branch `main`, and remote `main` at the Production SHA. An
older proposed `ae9be86` ref was absent then. That observation says nothing
about the new `54c3566` branch: its absence must be rechecked immediately before
the push.

## Approval boundary and create-only push

Before seeking approval:

1. Confirm the application object exists and remains exactly
   `54c35668f90dcdf696785c6fd5cc6e67a268e866`.
2. Confirm the audit tooling is clean at exact
   `0aabdefaccceaf97fcc336ddcc1ab2c11a7eb145` and that the runtime candidate is
   its ancestor.
3. Capture the read-only Production/provider baseline described below.
4. Verify that `refs/heads/codex/iwr-newsroom-preview-54c3566` is absent using a
   fresh remote query. Stop if it exists or the query is inconclusive.
5. Obtain explicit approval for one new branch push and its automatic protected
   Preview deployment. That approval does not include an environment edit,
   custom-domain assignment, Production deployment, alias move, lifecycle
   activation, provider mutation, or external publication.

Only after approval, the create-only empty-lease command is:

```powershell
git push origin 54c35668f90dcdf696785c6fd5cc6e67a268e866:refs/heads/codex/iwr-newsroom-preview-54c3566 --force-with-lease=refs/heads/codex/iwr-newsroom-preview-54c3566:
```

The empty lease is mandatory. Do not retry with a force push, ordinary update,
or non-empty lease if the branch was created concurrently. The resulting
deployment must remain a Preview, must not own `news.investwithraj.com`, and
must resolve to the exact candidate SHA.

## Runner-only credentials

- `NEWSROOM_VERCEL_API_TOKEN` is supplied only to the invariance runner. It may
  authenticate read-only Vercel project, environment-metadata, and deployment
  reads. It must never enter the app, a URL, a receipt, or an application
  request.
- `NEWSROOM_VERCEL_PROTECTION_BYPASS` is supplied only to the protected-audit
  runner. It may be sent only to the exact validated immutable newsroom origin.
  It must never enter Vercel project environment, a URL, a receipt, a console
  message, public Production, or an external resource.
- `IWR_VERCEL_PROTECTION_BYPASS`, if Batch 9 requires a separately approved
  protected advisory target, is likewise runner-only and origin-scoped. Do not
  set it when the advisory control is public or not approved.

Remove runner variables immediately after the audit session. Receipts may
record only `authConfigured: true`, never credential material.

## Exact hosted acceptance sequence

All output paths below are new hosted evidence paths. Hash and byte-pin every
receipt after a pass. Do not overwrite the two local receipts above.

### 1. Offline auth and tooling contracts

```powershell
node scripts/test-protected-preview-auth.mjs
node scripts/test-hosted-newsroom-invariance-contract.mjs
node scripts/test-hosted-newsroom-media-delivery-contract.mjs
node scripts/test-newsroom-hosted-browser-contract.mjs
.\node_modules\.bin\tsx.cmd scripts/test-newsroom-evidence-hold-runtime-origin.ts
```

All must pass at the exact tooling authority before any hosted request.

### 2. Production/provider baseline — before branch creation

Supply the exact current Production build ID discovered during preflight; do
not reuse the local Preview build ID.

```powershell
$env:NEWSROOM_INVARIANCE_PHASE='before'
$env:NEWSROOM_PUBLIC_PRODUCTION_URL='https://news.investwithraj.com'
$env:NEWSROOM_IMMUTABLE_PRODUCTION_URL='https://news-investwithraj-site-179bid75d-office-2271s-projects.vercel.app'
$env:NEWSROOM_PRODUCTION_DEPLOYMENT_ID='dpl_8E31vxF1y7iCkSkZdcxVwHqsGmwe'
$env:NEWSROOM_EXPECTED_PRODUCTION_SHA='4a3280271d9c1b52c941bcad8bfe83bcb6d1f32a'
$env:NEWSROOM_EXPECTED_PRODUCTION_BUILD_ID='<fresh exact Production build ID>'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-production-before.json'
$env:NEWSROOM_VERCEL_API_TOKEN='<runner-only provider token>'
node scripts/test-hosted-newsroom-invariance.mjs
```

This captures four public Production identities plus exact provider, project,
environment-name, Production deployment, alias, and Git-source facts. Stop on
any difference from the verified project identity or if either feature flag or
either runner credential appears in Vercel environment metadata.

### 3. Protected Preview invariance — immediately after `READY`

Read the new immutable URL, deployment ID, and build ID from the exact Preview;
do not use an alias or guessed value.

```powershell
$env:NEWSROOM_INVARIANCE_PHASE='after'
$env:NEWSROOM_EXPECTED_RUNTIME_MODE='default'
$env:NEWSROOM_PREVIEW_BRANCH='codex/iwr-newsroom-preview-54c3566'
$env:NEWSROOM_PREVIEW_URL='<exact immutable Preview origin>'
$env:NEWSROOM_PREVIEW_DEPLOYMENT_ID='<exact Preview deployment ID>'
$env:NEWSROOM_CANDIDATE_SHA='54c35668f90dcdf696785c6fd5cc6e67a268e866'
$env:NEWSROOM_BUILD_ID='<exact hosted Preview build ID>'
$env:NEWSROOM_PRODUCTION_BASELINE='outputs/hosted-readiness-54c3566/hosted-production-before.json'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-invariance-after.json'
$env:NEWSROOM_VERCEL_PROTECTION_BYPASS='<runner-only newsroom bypass>'
node scripts/test-hosted-newsroom-invariance.mjs
```

Retain the section 2 Production variables and provider token for this command.
Leave `NEWSROOM_LIFECYCLE_CUTOVER` and
`NEWSROOM_EVIDENCE_HOLD_PREVIEW` **unset**. Acceptance requires the Preview to
be SSO-protected and `noindex`, exact candidate/build identity, no canonical
alias, and byte-equivalent before/after Production identities. The immutable
Production deployment must remain protected and unchanged.

### 4. Hosted media delivery — exactly 71 requests

```powershell
$env:NEWSROOM_EXPECT_PROTECTED_PREVIEW='1'
$env:NEWSROOM_AUDIT_URL='<exact immutable Preview origin>'
$env:NEWSROOM_CANDIDATE_SHA='54c35668f90dcdf696785c6fd5cc6e67a268e866'
$env:NEWSROOM_BUILD_ID='<exact hosted Preview build ID>'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-media-delivery.json'
node scripts/test-hosted-newsroom-media-delivery.mjs
```

Acceptance is 16 / 16 approved `HEAD`, 3 / 3 nonempty ranged `GET`, 51 / 51
fail-closed denied `HEAD`, and one exact build identity. Every response must
remain same-origin without a redirect. The governed media and denial responses
must carry the protected noindex policy; the build-manifest identity probe is
not a media robots check.

### 5. Hosted browser — 85 routes / 170 viewport cases plus controls

```powershell
$env:IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW='1'
$env:IWR_NEWS_AUDIT_URL='<exact immutable Preview origin>'
$env:IWR_NEWS_CANDIDATE_SHA='54c35668f90dcdf696785c6fd5cc6e67a268e866'
$env:IWR_NEWS_BUILD_ID='<exact hosted Preview build ID>'
$env:IWR_NEWS_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-browser.json'
node scripts/test-newsroom-hosted-browser.mjs
```

Acceptance is the exact 79-route canonical sitemap and 41-article authority,
their 85-route HTML union across desktop and mobile (**170 cases**), plus seven
static, two private, and three not-found controls. All 24 held articles remain
default-mode indexable with article schema. No redirect, Preview-host canonical,
credential-bearing external resource, contracted basic-accessibility failure,
overflow, console error, same-origin media request failure, or build mismatch
may be accepted. This is not an Axe or general accessibility certification.

### 6. Default mode of the four-mode served-runtime auditor

```powershell
$env:NEWSROOM_AUDIT_URL='<exact immutable Preview origin>'
$env:NEWSROOM_RUNTIME_MODE='default'
$env:NEWSROOM_CANDIDATE_SHA='54c35668f90dcdf696785c6fd5cc6e67a268e866'
$env:NEWSROOM_BUILD_ID='<exact hosted Preview build ID>'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-default-runtime.json'
.\node_modules\.bin\tsx.cmd scripts/test-newsroom-evidence-hold-runtime.ts
```

Acceptance is exactly 79 sitemap URLs, 41 discovery articles, six developer
reports, zero lifecycle redirects, and zero Gone responses. The root sitemap
location must be exactly `https://news.investwithraj.com` without a trailing
slash; all canonical, RSS, News sitemap, schema, robots, held-article, retained,
404, and current-state assertions must pass.

### 7. Batch 8 and Batch 9

```powershell
$env:IWR_NEWS_AUDIT_URL='<exact immutable Preview origin>'
$env:IWR_NEWS_CANONICAL_URL='https://news.investwithraj.com'
$env:IWR_NEWS_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/batch-8'
node scripts/audit-batch-8.mjs

$env:IWR_BATCH_9_OUTPUT='outputs/hosted-readiness-54c3566/batch-9'
$env:IWR_ADVISORY_AUDIT_URL='<separately approved advisory control origin>'
node scripts/audit-batch-9.mjs
```

Both reports must contain zero failures. Batch 8/9 must retain origin-scoped
browser and request authentication with redirects disabled. Batch 9 may run
only when its advisory control origin and authentication state have been
separately approved. Its newsroom API probes must remain exact read-only `GET`
status/rejection checks; no `POST`, `PUT`, `PATCH`, `DELETE`, publication,
queue write, wallet registration, external delivery, or provider mutation is
permitted.

### 8. Final invariance and receipt closure

Rerun the section 3 invariance command after all hosted audits. Require the
same Production identities, provider configuration, Production deployment,
canonical alias ownership, environment-name set, and candidate Preview identity.
Hash and byte-count all hosted receipts. Repeat and require deterministic output
only for the invariance, media, browser, and served-runtime receipts designed
for that contract. Batch 8/9 reports include `generatedAt`; preserve and
hash/byte-pin each exact report, but do not require repeat-byte identity. Search
every receipt and console log for runner-secret sentinels before accepting it;
only boolean authentication state may be persisted.

## Stop conditions

Stop without retrying, aliasing, or changing provider configuration if any of
the following occurs:

- the branch is not provably absent immediately before the create-only push;
- runtime SHA, tooling SHA, branch, Preview SHA, deployment ID, immutable host,
  project/team/repository identity, or build ID differs;
- either newsroom flag is set, Production behavior appears, or the Preview is
  not default mode;
- the Preview is anonymously public, lacks SSO/noindex protection, redirects
  outside the authentication challenge, or receives a custom/canonical alias;
- the bypass reaches another origin, a redirect, public Production, provider
  API, URL, receipt, log, subresource, or application environment;
- the provider token reaches an application origin or any non-Vercel origin;
- any audit uses a mutation method, mutation credential, or external delivery;
- any exact route/count/canonical/schema/robots/media/browser/control assertion
  fails, a receipt is incomplete or violates its designed determinism contract,
  or a protected asset is broken; or
- Production deployment, SHA, build, aliases, public route identities,
  environment metadata, canonical domain, DNS, or response content changes.

## Rollback boundary

Rollback is Preview-only and separately approved:

1. Preserve the failed receipts and exact Preview deployment identity.
2. Remove only the new Preview deployment through an approved provider action.
3. Delete only `codex/iwr-newsroom-preview-54c3566`, using a lease pinned to the
   exact observed remote SHA. Never use an unscoped force deletion.
4. Re-run the Production/provider invariance baseline and prove the canonical
   domain still resolves to the same Production deployment and content.

Do not change or redeploy `main`; move or assign `news.investwithraj.com`; edit
Vercel environment; activate lifecycle/evidence flags; change DNS; or alter a
Production alias as either execution or rollback.

## Holds that remain after a successful hosted Preview

A successful Preview would clear only the hosted rendering/delivery evidence
defined here. It would not clear:

1. **Three held redirects:** their targets and indexation decisions remain
   unresolved; all three stay readable and non-redirecting.
2. **Twenty-four policy-v3 content-hash holds:** 17 still require content
   repair and remain uncertified.
3. **Seven one-source records:** this cohort still requires a distinct second
   allowlisted source and is included within the 24 holds.
4. **Six removal-demand checks:** Search Console, backlinks/referrals,
   analytics, and access logs remain required for five articles and `/pulse`;
   Kuwait and Fendi remain medium-confidence retirement decisions.

Production release, lifecycle/evidence activation, redirects, removals, live
indexing, Search Console, DNS, canonical aliases, provider configuration,
durable KV/Redis, cron, internal publication, AI/model services, email, social,
analytics, consent, media rights/provenance, privacy, and legal approval all
remain outside this packet. No hosted Preview may be described as Production,
live, indexed, rights-cleared, externally connected, or release-approved.
