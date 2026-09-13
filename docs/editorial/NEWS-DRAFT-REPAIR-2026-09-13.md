# News drafting repair — 13 September 2026

Scope: repair candidate selection and drafting failures observed in research-only run `34740233471`. This change does not edit articles, the main website, environment values, publication schedules, social delivery or database schema.

## Observed failures and corrections

1. Foreign stories were admitted through broad real-estate keywords and a default UAE market label. Each entry now needs a UAE link in its actual title/summary before clustering and ranking. A publisher's location, a developer name alone or a company-origin phrase does not establish a local story. Named local communities and explicit UAE investor links remain eligible.
2. The corporate-intent announcement matcher requires one source, while the drafter could submit several citations and was instructed to use every source. The research prompt now states the singleton contract. An editor can explicitly select an exact subset of current, already-fetched citation URLs; it cannot add a source, silently drop the reporting-basis source or alter metadata. The same claim/publisher requirements still apply after selection.
3. A syntactically valid first rewrite could remain unsupported and receive no further source-alignment feedback. Short updates now receive at most one final source-alignment correction, using only the selected fetched packet and current failure list. The existing numeric correction uses the same final slot. Provider failures stop; genuine editor skips retain their reason.
4. Removing a citation must not hide copied prose. All original fetched research remains in hashed provenance and is checked for copying again at stored approval. Uncited retained records require their exact source-history URL, complete immutable freshness proof, same-publisher final URL and matching content hash. They never count as selected claim support or additional corroborating publishers.

## Validation

Deterministic tests cover the actual New Zealand/Goa headlines, mixed-cluster contamination, local project aliases, explicit citation selection, missing/foreign/duplicate selections, retained research, staging validation and evidence approval, copied prose from an omitted source, failed provider calls and the two-correction limit. Existing announcement, numeric, source freshness, publication and schedule protections remain intact.

The first clean build caught a typing error in a new regression test. An explicit provenance type fixed it. The final clean build passed in the new `.next-news-repair-20260913-final` directory (103 static pages). All 24 workflow regression scripts, the additional claim-support and auto-publication checks, TypeScript, scoped lint and diff checks pass. Independent review found no remaining blocking issues. No active review server was stopped or replaced.

Fixtures prove corrected paths can produce a valid draft and pass stored approval. They are not live news and do not establish that a real daily run published an article. Release and hosted test outcomes must be recorded separately; retain failures rather than report a successful job as successful publication.

## Second live retry and phase parsing repair

Release `c21b13f` reached Production. Research-only run `34741251688` selected three UAE candidates (no foreign candidates), but staged zero drafts. This was not a successful publishing run. Its three holds concerned a phase identifier, unsupported forecast clauses and an invalid corporate-intent attribution.

The phase failure was reproduced: `Phase 2 will include more` was incorrectly extracted as one numeric claim. Phase identifiers now end at the numeric identifier and remain evidence-bound. Missing or different phases still fail; home counts, currencies, threshold context and ranges remain checked independently. New regression coverage reproduces the observed failure and checks those negative cases.

The research request now includes its current date and prefers the canonical primary release for straightforward announcements. It explicitly distinguishes an actual company plan stated by a named speaker from personal feelings, historical performance or nearby reporter prose. Those distinctions guide the writer; they do not weaken the existing approval contract. The inspected Azizi source did not justify loosening the speaker matcher. Forecasts still require independent support.

Independent review caught an ambiguous verbal use ("phase 2 million homes") before release. The identifier now requires a recognised clause/location boundary; quantities, percentages, units and scales continue through the complete numeric parser. Sixteen additional negative fixtures cover that distinction.

All 25 workflow regression scripts pass, with the numeric and short-update suites repeated after the final changes. Auto-publication, claim-support, TypeScript, focused lint and diff checks pass. The exact final source passed a clean production build in `.next-news-phase-release-20260913` (103 static pages), with its numeric-module hash unchanged throughout. Second-pass release and live verification are pending. No article has been published by the research-only retries.

## Discovery reliability follow-up

Release `73a4393` reached Production. Research-only run `34742022497` could not test drafting: twenty Google feeds returned 503, three Bing feeds failed the XML content-type boundary, and the remaining sources yielded no qualified candidate. Zero model attempts, drafts or publications. These responses do not establish whether the cause was throttling, a challenge or provider unavailability.

Inspection found all 33 configured source requests launched concurrently (twenty to Google), with a separate live health pass immediately before ingestion. Discovery and the standalone health checker now share a dispatcher: one active source per initial target host, four hosts maximum. A 403/429/503 or rejected HTML feed stops that host's queued requests for this run. Other publishers continue. There are no automatic probes, retries, identity changes or accepted HTML feeds. Safe error metadata records only bounded host/status/MIME/Retry-After information, and skipped requests are distinct from transport successes. The duplicate workflow health request pass is removed; actual ingestion still reports its health.

An index placeholder containing a publisher name could also supply false geography and scoring keywords. Complete synthetic WebFetch placeholders no longer count as story content. Actual headlines/excerpts remain intact. Independent review also caught a UK development inheriting local relevance from the company name Dubai Holding. Maintained geography-bearing corporate names are now excluded only from geographic matching; separate local context and normal developer entities remain usable.

The minimum ranking score was also excluding plain first-party announcements: a current, uncomplicated developer release can score 44, below the cutoff of 45. When the automatic score-qualified pool is empty, one current primary-source UAE real-estate announcement can now proceed to normal research. The topic-driving entry itself must pass explicit date (0–72 hours), direct registered publisher, article-shaped URL, UAE content, real-estate headline and announcement-action checks. Forecasts, unrelated content, source metadata, future/invalid dates and noncanonical links cannot supply this fallback. Scores, manual targets and every subsequent source, originality, date, image and publication gate remain unchanged.

Separate configuration gap: the deployed watchdog reports `disabled`; Production lacks both `ENABLE_NEWS_WATCHDOG` and its dedicated `GITHUB_ACTIONS_DISPATCH_TOKEN`. GitHub schedules are active but recent runs started hours late. No environment values were pulled or changed. WAM remains an approved citation source; a recurring dated WAM discovery index/feed has not been verified and no guessed endpoint was added.

All 27 workflow regression scripts passed, followed by repeated final dispatcher, relevance and primary-fallback checks. TypeScript, focused lint and diff checks passed. A clean build in `.next-news-discovery-release-20260913-final` produced 103 static pages with the final cluster-module hash unchanged during the build. Independent review passed after the corporate-name counterexample was fixed. Release and live outcomes are recorded separately. None of the research-only tests establishes restored daily publication.
