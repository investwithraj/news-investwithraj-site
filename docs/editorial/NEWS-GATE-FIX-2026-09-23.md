# Newsroom gate repair — 23 Sep 2026 (Claude)

Handoff note for Codex, which owns the 6–13 Sep evidence-binding work this touches.

## What was wrong

No article published since **10 Sep** (`bfbdde4`, Prestige One). Every `news-cron`
run from ~13 Sep onward exited 1: **32 failures in the last 40 runs**, both runs on
22 Sep among them. Drafting itself was healthy — each run researched ~6 real
clusters and then held every one. The queue reached **109 active drafts**, and the
watchdog failed the job because the feed was 280h old against a 36h cadence.

## Root cause

Two clause-level checks in `assessArticleClaimSupport` pull in opposite directions:

| Code | Fires when |
| --- | --- |
| `unsupported` / `mixed-signature` | the clause's wording does **not** match a source window closely enough |
| `source-copying` | the clause's wording matches a source window **too** closely |

A faithful report of a sourced fact can satisfy neither. Both 22 Sep exemplars were
true, well-sourced stories held on this basis:

- **Emaar special dividend** — 13 flagged clauses; the headline *"Emaar Properties
  board approves special dividend for shareholders"* marked `unsupported`
  ("atomic subject-action-fact tuples differ; closest publisher: Khaleej Times")
  while the tldr and body clauses carrying the same facts were marked
  `source-copying`.
- **Dubai luxury rents** — headline `source-copying`, subtitle and tldr
  `unsupported`, same run.

`61a11bd` ("record remaining real-draft failures") documents the same dead end.

## The change

`blockingClaimFailures()` in `lib/news-review/claim-support.ts` now separates
blocking failures from advisory ones, and both call sites use it:

- `lib/news-review/draft-engine.ts` — final staging gate
- `lib/news-review/auto-approve.ts` — auto-publication assessment

**Advisory** (recorded in diagnostics, still fed to the repair prompt, no longer
blocking): `unsupported`, `mixed-signature`, `ambiguous-pronoun`,
`negative-absence`, and unused-cited-evidence reporting.

**Still blocking, unchanged:** the figure gate (every number verbatim in text
fetched from a whitelisted publisher), the citation whitelist, the eight voice
gates, `trade-call`, `editorial-overreach`, and `source-copying` — copied prose
gets rewritten, never published.

`source-copying` was briefly relaxed to a >50% share threshold during this work and
put back to hard-blocking when `test-news-short-update` correctly caught a copied
short update passing. Copying is a brand and legal risk on its own terms; the
remedy is a rewrite, not a lower ceiling.

## Verification

- `tsc --noEmit` clean.
- Pass: `test-claim-support`, `test-news-short-update`, `test-announcement-policy`,
  `test-research-originality`, `test-news-scheduler`.
- `test-newsroom-pipeline-recovery` fails **identically on unmodified `origin/main`**
  (`Error: clock read more than twice`, `scripts/test-newsroom-pipeline-recovery.ts:1112`).
  Pre-existing, not caused by this change, and worth a separate look.
- Two assertions in `test-news-short-update` were updated, not deleted: a
  non-numeric clause that survives repair is now asserted to **stage with an
  advisory diagnostic** rather than be held. The repair loop's bounded
  two-attempt behaviour is asserted unchanged.
- **Not yet run against live stories.** No `ANTHROPIC_API_KEY` on the local box —
  it exists only as a GitHub Actions secret. The intended test is
  `news-cron` → Run workflow on this branch with **`research_only: true`**, which
  researches and stages without approving or publishing anything.

## 24 Sep — second pass, after the first fix went live

PR #4 merged as `cb1d22c`. The first full run on `main` showed the deadlock
gone (*"1 blocking clause(s) of 17 flagged"* on Saadiyat Grove; before, all 17
would have blocked) but still published nothing. Today's four candidates fell
to four different causes, and each became a change on
`claude/news-engine-repairs`:

| Candidate | What held it | Change |
| --- | --- | --- |
| Golden Visa / DLD | DLD portal page carries no machine-readable date → `publication date missing`; Arabian Business returns 405/403 to every fetcher | **Discovery-feed date fallback.** When a fetched page has text but no date, the Google News entry's timestamp for the same URL stands in, labelled `discovery-feed` in provenance. `canonicalDiscoveryUrl()` + `discoveryDateByUrl` in `draft-engine.ts`; `"discovery-feed"` added to `PublicationDateSource`, `sourceDateSource`, and the publish-time allow-list in `auto-approve.ts`. Arabian Business is bot-protected on their side; nothing to fix here. |
| Yas Island | drafter wrote "$1.7 billion construction cost" — source quotes AED; the figure gate caught the conversion (correctly) | **Prompt rule** in `draftSystemPrompt`: quote figures in the source's currency and unit, never convert AED↔USD or m²↔sq ft, never round a precise figure. |
| all 109 backlog drafts | `insufficient-independent-publishers: 108` | **`DEFAULT_CORROBORATION_SOURCES` 2 → 1**, Raj's 14 Jun setting. The figure gate is the protection; a second byline is not. |
| all 109 backlog drafts | `source-date-or-freshness: 109` — every source past the 7-day window | **Retired.** `scripts/retire-backlog.ts` (dry-run default, `--delete` to act) removed all 109 on 24 Sep; full copy at `pipeline-runs/retired-backlog-2026-09-24.json` (untracked). Needed a new `retireStaleDraft()` in `storage.ts`: legacy records carry no stored `contentHash`, so the cockpit's compare-and-swap could never match them. It matches id + age + no-publication-record atomically. |

Tests updated to the new contracts rather than deleted: one press publisher
whose figures trace now auto-approves (`test-news-short-update`,
`test-announcement-policy`), and a dateless page with a dated feed entry
stages with `sourceDateSource: "discovery-feed"` while one with no date from
any origin is still held. `tsc` clean; six gate suites pass.

## 24 Sep, afternoon — the backlog verified against its sources

Raj asked for the 109 retired drafts released under their original dates for
the archive. He chose "verify figures first, publish what passes". Result:

| Verdict | Count | Why |
| --- | --- | --- |
| **publish** | **3** | every figure found verbatim in a fetched whitelisted page |
| hold | 90 | 64 have **six or more** figures in no source at all; 22 have 3–5; 5 are within one or two |
| skip | 16 | duplicates of articles already live |

Method (`scripts/publish-backlog.ts`, dry-run default): the eight voice gates;
then the **June figure rule** — currency? number range? unit?, normalised,
present anywhere in the normalised source text; evidence = the article's own
citations **plus** its whitelisted discovery sources (up to 10; aggregators
skipped). Source freshness is not checked, because the article carries the
date the story broke. Passing articles are written straight into the tree
(`content/news/<slug>.ts`, `index.ts`, `article-relations.ts`) for one
reviewable commit.

Two earlier passes returned **0 / 109**. The first used the September
`findUnsupportedFigures`, which keys on the whole numeric span including its
trailing nouns, so "AED 560 million beachfront plot" failed against a page
that says "AED 560 million beachfront estate". The second used the June rule
but only the article's citations — and the drafter's citations frequently do
not contain its numbers (the "European buyer pays AED 560m" piece cites a
blocked Arabian Business page, a Gulf News story about a *different* AED 377m
sale, and a Bayut area guide). Widening to discovery sources is what produced
the 3.

**The finding that matters:** the backlog was never a publishable archive.
~600 figures across 64 drafts trace to no source. The September gates, for
all their faults, were rejecting real fabrication; the deadlock and the
fabrication are two separate problems, and only the first is fixed.

Published with original dates: 1 Aug (Abu Dhabi Parent-friendly Label
deadline), 22 Aug (Ellington × ADCB financing), 24 Aug (DIB non-resident
off-plan finance). Covers hand-audited full-frame; `backfill-covers.ts` was
run and **7 of its 11 picks were wrong** (a Bank of Montreal in Ottawa on the
DLD story, rollerbladers on Aldar, Dubai's Palm from orbit on ADGM, the same
Dubai aerial on four articles). Only the four that pass are shipped, with
real CC credits. The near-misses and the full verdict table are in
`pipeline-runs/publish-backlog-2026-09-24.json`.

**Separate live defect found on the way:** eight articles already on the
site (13 Aug – 8 Sep) point at `/news/<slug>/cover.jpg` files that do not
exist — 404 today, hero hidden. One (Omniyat, RAK) is fixed here; the other
seven need proper images chosen by a person, not the stock picker.

## Open risks

1. A fabricated non-numeric clause with no figure in it is no longer blocked at
   staging. It still faces the voice gates and human review in The Desk, but the
   deterministic backstop for that class is now the figure gate only. If you want
   belt-and-braces, the right shape is probably a signature check that compares
   facts and entities rather than surface wording, so paraphrase passes and
   invention does not — that keeps the protection without the deadlock.
2. The 109 queued drafts were staged under the old regime and have not been
   reassessed.
3. Cadence: the watchdog still fails the job when nothing publishes within 36h, so
   the first green run is the real confirmation.
