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
| Local-evidence tooling authority | `0aabdefaccceaf97fcc336ddcc1ab2c11a7eb145` | Pins the runtime inputs, portable local receipts and deterministic local evidence manifest; it is not the deploy candidate. |
| Hosted operator tooling authority | `31ba37e4e588a1a1b67dc63d20f2280324bae1f5` | Clean committed descendant containing provider deployment-file preflight, package aliases, strict alias policy and cross-bound final evidence closure; it is not the deploy candidate. |
| Readiness-document execution authority | Pending docs-only successor of `31ba37e4e588a1a1b67dc63d20f2280324bae1f5` | At execution, pin the exact clean committed HEAD containing this final packet and prove its diff from `31ba37e...` is documentation-only. |
| Proposed create-only branch | `codex/iwr-newsroom-preview-54c3566` | Preview branch only; never a Production branch or alias. |

The runtime, local-evidence tooling and hosted operator tooling are deliberately
layered authorities. The final closure must run from a clean committed
documentation-only descendant of `31ba37e...`, record that exact HEAD/tree, and
prove that the runtime inputs pinned by `0aabdef...` have not changed. The
deployment source remains exact `54c3566...`; neither tooling nor documentation
HEAD may replace it.

## Local evidence — not hosted evidence

A local Preview-mode build of the exact runtime candidate generated **98 / 98**
pages with build ID `Vw3nq0gSlyv08qacF7Xo8`. Both newsroom flags were off.
These receipts were produced against localhost with
`authConfigured: false`; they do not prove Vercel protection, a hosted Preview,
or any public response.

The authoritative local evidence index is the checked-in
`docs/migration/HOSTED-PREVIEW-LOCAL-EVIDENCE-54C3566.json`. It pins both Git
trees, the local build, portable receipt paths, hashes, byte counts and the
complete hosted receipt contract. Files under `outputs/` are retained local
working copies only and are not the release authority.

| Evidence | Checked-in portable receipt | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Default served runtime | `docs/migration/evidence/hosted-readiness-54c3566/default-runtime.json` | 66,516 | `8806976FD2980BAB389F47C798DD96BA1472AB1223104578BC4CF022E5635E76` |
| Protected-Preview media policy, exercised locally | `docs/migration/evidence/hosted-readiness-54c3566/media-delivery.json` | 9,639 | `110C555EFD7E6FA308D532D097A48B39C45946FAFDB4ECA3692B12010406F358` |

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
2. Confirm local-evidence tooling `0aabdef...` and hosted operator tooling
   `31ba37e4e588a1a1b67dc63d20f2280324bae1f5` are ancestors of the exact clean
   committed execution HEAD. Require the execution diff from `31ba37e...` to
   contain this readiness-document update only, and require zero changes to
   application/runtime inputs.
3. Pass the offline preflight alias and validate the checked-in local evidence
   manifest and portable receipts.
4. Verify that `refs/heads/codex/iwr-newsroom-preview-54c3566` is absent using
   the two-stage read-only remote check below. Stop if it exists or either
   query is inconclusive.
5. Obtain explicit approval for one new branch push and its automatic protected
   Preview deployment. That approval does not include an environment edit,
   custom-domain assignment, Production deployment, alias move, lifecycle
   activation, provider mutation, or external publication.

Run the remote absence check immediately before approval and again immediately
before the push:

```powershell
$branchRef = 'refs/heads/codex/iwr-newsroom-preview-54c3566'
$transportProbe = & git ls-remote --exit-code origin HEAD 2>&1
$transportCode = $LASTEXITCODE
if ($transportCode -ne 0 -or [string]::IsNullOrWhiteSpace(($transportProbe -join "`n"))) {
  throw 'Remote transport/authentication was not proven; branch absence is unknown.'
}
$branchProbe = & git ls-remote --exit-code --heads origin $branchRef 2>&1
$branchCode = $LASTEXITCODE
$branchText = ($branchProbe -join "`n").Trim()
if ($branchCode -eq 0) { throw "Preview branch already exists: $branchText" }
if ($branchCode -ne 2 -or $branchText.Length -ne 0) {
  throw 'Branch query failed or was ambiguous; do not treat it as absent.'
}
```

`git ls-remote --exit-code --heads origin refs/heads/codex/iwr-newsroom-preview-54c3566`
returns exit `2` with no output for no matching ref, but that result is accepted
only after the immediately preceding `origin HEAD` probe returned exit `0` with
nonempty output. Exit `0` from the branch query means the branch exists; every
other state is a stop. The empty lease below remains the final race-safe guard.

Only after approval, the create-only empty-lease command is:

```powershell
git push origin 54c35668f90dcdf696785c6fd5cc6e67a268e866:refs/heads/codex/iwr-newsroom-preview-54c3566 --force-with-lease=refs/heads/codex/iwr-newsroom-preview-54c3566:
```

The empty lease is mandatory. Do not retry with a force push, ordinary update,
or non-empty lease if the branch was created concurrently. The resulting
deployment must remain a Preview, must not own `news.investwithraj.com`, and
must resolve to the exact candidate SHA.

Every Preview alias must be unique and match the strict operator allowlist
`^news-investwithraj-site(?:-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)?-office-2271s-projects\.vercel\.app$`.
No custom domain, `news.investwithraj.com`, other project prefix, other team
suffix or malformed DNS label is allowed. The immutable deployment origin is
additionally constrained to the exact 8–16-character deployment-hash form.
Manually assigned or custom aliases are prohibited even when they appear
benign; acceptance is limited to provider-returned aliases that pass this exact
allowlist.

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

All output paths below are hosted evidence paths. Do not overwrite the
checked-in local evidence. Operator tooling `31ba37e...` supplies these exact
package aliases:

| Alias | Purpose |
| --- | --- |
| `test:hosted-preflight` | Offline auth, provider-preflight, invariance, media, browser, origin and public-media contracts |
| `audit:hosted-provider-preflight` | Read-only provider/project/env/deployment discovery and exact Production/Preview build discovery from Vercel deployment-file inventories |
| `audit:hosted-invariance` | Production/provider before/after invariance |
| `audit:hosted-media-delivery` | Exact 71-request protected media contract |
| `audit:hosted-browser` | Exact 85-route / 170-viewport browser contract plus controls |
| `audit:newsroom-evidence-runtime` | Default served-runtime contract |
| `audit:hosted-batch-8` | Batch 8 hosted browser/report gate |
| `audit:hosted-batch-9` | Batch 9 hosted cross-site/report gate |
| `audit:hosted-evidence-closure` | Strict clean-Git, receipt, determinism, secret-scan and closure manifest gate |

### 1. Offline contracts and portable local evidence

From the exact clean committed execution HEAD:

```powershell
npm run test:hosted-preflight
```

This alias must pass before any hosted request. The closure contract also
validates `docs/migration/HOSTED-PREVIEW-LOCAL-EVIDENCE-54C3566.json`, its two
portable receipts, exact SHA/tree ancestry and the absence of runtime-input
drift from `0aabdef...`.

### 2. Create-only branch and protected Preview

Perform the two-stage remote absence check and the empty-lease push only after
the separate approval boundary above. Wait for exactly one `READY` Preview for
the exact candidate SHA and branch. Do not discover or copy build IDs manually.

### 3. Read-only provider preflight and generated operator values

Supply both runner-only credentials, then let the committed provider preflight
discover and validate the exact Production and Preview deployment IDs, SHAs,
immutable URLs, project/env state, protection and strict alias set. Build IDs
are derived from each deployment's Vercel
`/v6/deployments/<deployment-id>/files` inventory, then verified with a
same-origin authenticated `HEAD` to the exact build manifest. Run preflight
twice because closure requires deterministic provider evidence:

```powershell
$env:NEWSROOM_CANDIDATE_SHA='54c35668f90dcdf696785c6fd5cc6e67a268e866'
$env:NEWSROOM_PREVIEW_BRANCH='codex/iwr-newsroom-preview-54c3566'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-provider-preflight.json'
$env:NEWSROOM_VERCEL_API_TOKEN='<runner-only provider token>'
$env:NEWSROOM_VERCEL_PROTECTION_BYPASS='<runner-only newsroom bypass>'
npm run audit:hosted-provider-preflight
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-provider-preflight-repeat.json'
npm run audit:hosted-provider-preflight

$preflightPath='outputs/hosted-readiness-54c3566/hosted-provider-preflight.json'
$preflight = Get-Content -LiteralPath $preflightPath -Raw | ConvertFrom-Json
$env:NEWSROOM_PUBLIC_PRODUCTION_URL='https://news.investwithraj.com'
$env:NEWSROOM_IMMUTABLE_PRODUCTION_URL=[string]$preflight.production.url
$env:NEWSROOM_PRODUCTION_DEPLOYMENT_ID=[string]$preflight.production.id
$env:NEWSROOM_EXPECTED_PRODUCTION_SHA=[string]$preflight.production.source.sha
$env:NEWSROOM_EXPECTED_PRODUCTION_BUILD_ID=[string]$preflight.production.buildId
$env:NEWSROOM_PREVIEW_URL=[string]$preflight.preview.url
$env:NEWSROOM_PREVIEW_DEPLOYMENT_ID=[string]$preflight.preview.id
$env:NEWSROOM_BUILD_ID=[string]$preflight.preview.buildId
```

The primary receipt, not operator transcription, feeds every command below;
the primary and repeat receipts must be byte-identical. Stop if either does not
report `result: pass`, exact candidate/branch, one `READY` Preview,
canonical Production alias ownership, Preview alias allowlist compliance,
protected/noindex anonymous and authenticated behavior, distinct immutable
origins, or a single verified build ID for each deployment. Hash and byte-pin
both provider-preflight receipts.

Leave `NEWSROOM_LIFECYCLE_CUTOVER` and
`NEWSROOM_EVIDENCE_HOLD_PREVIEW` **unset** throughout.

### 4. Production/provider baseline and first Preview invariance

```powershell
$env:NEWSROOM_INVARIANCE_PHASE='before'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-production-before.json'
npm run audit:hosted-invariance

$env:NEWSROOM_INVARIANCE_PHASE='after'
$env:NEWSROOM_EXPECTED_RUNTIME_MODE='default'
$env:NEWSROOM_PRODUCTION_BASELINE='outputs/hosted-readiness-54c3566/hosted-production-before.json'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-invariance-after.json'
npm run audit:hosted-invariance
```

Acceptance requires exact project/environment/deployment identity, protected
immutable Production and Preview, no Preview canonical alias, exact
candidate/build identity and four unchanged public Production identities.

### 5. Hosted media delivery — 71 requests, repeated

```powershell
$env:NEWSROOM_EXPECT_PROTECTED_PREVIEW='1'
$env:NEWSROOM_AUDIT_URL=$env:NEWSROOM_PREVIEW_URL
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-media-delivery.json'
npm run audit:hosted-media-delivery
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-media-delivery-repeat.json'
npm run audit:hosted-media-delivery
```

Acceptance is 16 / 16 approved `HEAD`, 3 / 3 nonempty ranged `GET`, 51 / 51
fail-closed denied `HEAD`, and one exact build identity. Every response remains
same-origin without a redirect. Governed media and denial responses carry the
protected noindex policy; the build-manifest identity probe is not a media
robots check. The two receipts must be byte-identical.

### 6. Hosted browser — 85 routes / 170 viewport cases, repeated

```powershell
$env:IWR_EXPECT_NEWSROOM_PROTECTED_PREVIEW='1'
$env:IWR_NEWS_AUDIT_URL=$env:NEWSROOM_PREVIEW_URL
$env:IWR_NEWS_CANDIDATE_SHA=$env:NEWSROOM_CANDIDATE_SHA
$env:IWR_NEWS_BUILD_ID=$env:NEWSROOM_BUILD_ID
$env:IWR_NEWS_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-browser.json'
npm run audit:hosted-browser
$env:IWR_NEWS_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-browser-repeat.json'
npm run audit:hosted-browser
```

Acceptance is the exact 79-route canonical sitemap and 41-article authority,
their 85-route HTML union across desktop and mobile (170 cases), seven static,
two private and three not-found controls. All 24 held articles remain
default-mode indexable with article schema. Contracted basic accessibility,
overflow, console, same-origin media, canonical, redirect, secret-scope and
build checks must pass. This is not an Axe/general accessibility certificate.
The two receipts must be byte-identical.

### 7. Default served-runtime — repeated

```powershell
$env:NEWSROOM_AUDIT_URL=$env:NEWSROOM_PREVIEW_URL
$env:NEWSROOM_RUNTIME_MODE='default'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-default-runtime.json'
npm run audit:newsroom-evidence-runtime
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-default-runtime-repeat.json'
npm run audit:newsroom-evidence-runtime
```

Acceptance is exactly 79 sitemap URLs, 41 discovery articles, six developer
reports, zero lifecycle redirects and zero Gone responses. Root sitemap,
canonical, RSS, News sitemap, schema, robots, held/retained article, 404 and
authority-state checks must pass. The two receipts must be byte-identical.

### 8. Batch 8 and Batch 9 aliases

```powershell
$env:IWR_NEWS_AUDIT_URL=$env:NEWSROOM_PREVIEW_URL
$env:IWR_NEWS_CANONICAL_URL='https://news.investwithraj.com'
$env:IWR_NEWS_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/batch-8'
npm run audit:hosted-batch-8

$env:IWR_BATCH_9_OUTPUT='outputs/hosted-readiness-54c3566/batch-9'
$env:IWR_ADVISORY_AUDIT_URL='<separately approved advisory control origin>'
npm run audit:hosted-batch-9
```

Both reports must contain zero failures. Batch 8/9 retain origin-scoped auth
and manual redirects. Batch 9 runs only with a separately approved advisory
control. Its newsroom API probes remain exact read-only `GET` status/rejection
checks; no mutation method, publication, queue write, wallet registration,
external delivery or provider mutation is permitted. These reports contain
`generatedAt`: hash and byte-pin each, but do not require repeat-byte identity.

### 9. Final invariance repeat and deterministic closure

After all hosted audits, rerun the same after-phase invariance into its required
repeat path:

```powershell
$env:NEWSROOM_INVARIANCE_PHASE='after'
$env:NEWSROOM_AUDIT_OUTPUT='outputs/hosted-readiness-54c3566/hosted-invariance-after-repeat.json'
npm run audit:hosted-invariance
```

The initial and repeated invariance receipts must be byte-identical. Then run
the committed closure from the exact clean documentation execution HEAD:

```powershell
$env:NEWSROOM_HOSTED_CLOSURE_OUTPUT='outputs/hosted-readiness-54c3566/hosted-evidence-closure.json'
npm run audit:hosted-evidence-closure
Get-FileHash -Algorithm SHA256 -LiteralPath $env:NEWSROOM_HOSTED_CLOSURE_OUTPUT
```

Closure fails unless the runtime/local-evidence authority manifest, portable
receipts, exact Git ancestry/tree, pinned runtime inputs, all eight hosted
receipt groups, required deterministic repeats, provider-preflight identity
cross-binding, Batch 8/9 pass states, one shared hosted candidate build ID and
configured secret-sentinel scans all pass. Provider Production/Preview
deployments, project, environment set, SHAs, origins and build IDs must exactly
match the invariance receipts.
It records the exact clean execution HEAD/tree as operator tooling. Only the
closure receipt and its hash/bytes may close hosted evidence; it does not grant
release approval.

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
