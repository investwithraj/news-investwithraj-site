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
