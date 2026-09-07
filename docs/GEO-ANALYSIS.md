# Invest With Raj Intelligence — SEO and GEO release analysis

**Assessment date:** 7 September 2026  
**Scope:** `https://news.investwithraj.com`  
**Release candidate:** the uncommitted search-discovery repair based on `cf83860`

## Executive assessment

| State | Readiness | Meaning |
| --- | ---: | --- |
| Current live baseline | 64/100 | Strong canonical coverage and structured reporting, but public social/search images are blocked, archive pagination is weak, entity naming drifts and Search Console/Bing ownership is not proven. |
| This release candidate | 87/100 | The material technical discovery defects are repaired. The remaining gap is provider-side verification and accumulated authority, which code cannot manufacture. |

This is a technically credible newsroom, not a traffic guarantee. Search visibility will depend on continued original reporting, crawl/index confirmation, external references, reader response and time. Bulk-publishing weak or duplicated backlog material would reduce—not improve—its chances.

## Platform readiness

### Google Search, Discover and Google News

**Release-candidate status: ready for submission and automatic consideration.**

- Every indexable route is server rendered, canonical and included in `sitemap.xml`.
- Fresh news is exposed through a dedicated Google News sitemap limited to the recent 48-hour window.
- Articles carry `NewsArticle` structured data, visible publication/modification dates, a visible collective byline, publisher identity and source links.
- Representative 1200 × 630 article cards become crawlable in this release instead of inheriting an API-wide `noindex` response.
- The site advertises a single canonical RSS feed from every page.
- Google News no longer accepts a manual Publisher Center application. Eligible publications are automatically considered after Google discovers and evaluates their pages.
- Search Console still needs to be completed under `office@investwithraj.com`, followed by submission of both canonical sitemaps. Normal articles must not use Google's Indexing API.

### Bing, Microsoft surfaces and Copilot

**Release-candidate status: technically ready; account verification remains.**

- Canonical pages and both sitemaps are publicly available.
- IndexNow is enabled only after canonical publication verification and stores a durable receipt.
- Bing Webmaster ownership should be imported from Search Console or verified directly, then both sitemaps should be submitted.
- The retired Bing PubHub workflow is not part of the plan.

### ChatGPT and OpenAI discovery

**Release-candidate status: strong.**

- `OAI-SearchBot`, `ChatGPT-User` and the other named answer-engine crawlers are explicitly allowed on public routes.
- `llms.txt` identifies the publication, its evidence rules, archive/area/developer hubs and exactly the five newest evidence-certified articles.
- Article summaries and bodies expose stable semantic hooks; pages remain useful without client-side execution.

### Perplexity and other answer engines

**Release-candidate status: strong.**

- `PerplexityBot` and `Perplexity-User` are explicitly allowed.
- Citability is supported by visible source lists, direct publisher URLs, dates, concise summaries and article-level schema.
- No engine-specific ranking or citation outcome can be promised.

## Crawler policy

Public HTML, sitemaps, RSS and indexable article cards are crawlable. Internal review routes, general API routes and held/noindex material remain excluded. The narrow `/api/og` allowance overrides the general `/api/` block only for public cards; cards for held or noindex content keep `noindex, nofollow, noarchive` and `no-store`.

This separation prevents a search-readiness fix from exposing internal review data or drafts.

## Entity and brand consistency

- Publication: **Invest With Raj Intelligence**
- Article author: **Invest With Raj News Desk**, represented truthfully as an editorial Organization
- Publisher: the separate **NewsMediaOrganization** entity
- Named publisher/advisor: **Raj Tomar**
- Instagram identity: `@thedubaiupgrade`
- YouTube identity: `@TheDubaiUpgrade`
- Unverified X/Twitter ownership metadata: removed
- Generic publication identity now consistently uses **real estate**, not **property**

The News Desk is the article author unless a future article carries a separately verified individual byline. Raj remains the named publisher and real estate advisor; the schema does not invent article authorship, credentials or affiliations.

## Citability and structured data

The release keeps a linked WebSite, NewsMediaOrganization and Person graph and corrects article authorship. It removes the unsupported `diversityPolicy` claim. Article `speakable` selectors now target literal `.article-tldr` and `.article-body` elements that exist in rendered HTML.

Each new automatic publication must continue to pass:

1. independently fetched evidence;
2. source and publication-date checks;
3. numeric-claim parsing and cross-checking;
4. duplicate/event clustering;
5. content-hash and lifecycle validation;
6. canonical deployment verification before IndexNow notification.

## Rendering, navigation and discovery

- Public routes are server rendered.
- Archive pagination now uses crawlable `rel="prev"` and `rel="next"` links rather than click-only navigation.
- Pagination keeps active desk, area, developer and search parameters.
- RSS language is `en-AE` and publication naming is consistent.
- `llms.txt` uses the same 24-hour refresh window as its cache headers.
- All public pages receive one durable RSS autodiscovery link, even when child metadata replaces other fields.

## Publishing backlog decision

The production queue contains **109 active held drafts and 0 safely auto-publishable drafts**.

- 108 lack sufficient independent publishers and independently fetched evidence.
- 59 contain unparsed material numeric claims.
- 34 have source-whitelist problems.
- 10 have date or freshness problems.
- 1 rejected Dubai Land Department draft is permanently quarantined.
- Many are duplicate versions of the same event.

The two curated candidates that passed the current policy—the Dubai Land Department registration platform and Ras Al Khaimah H1 housing report—are already live. The correct action is to rebuild worthwhile old topics from fresh direct evidence, not release the unsafe queue in bulk.

## Distribution plan

| Channel | Action |
| --- | --- |
| Google News | No application. Maintain eligibility and submit sitemaps through Search Console. |
| Google Search/Discover | Submit sitemaps, monitor indexing and enhancement reports, then improve coverage based on observed queries. |
| Bing/Copilot | Verify Bing Webmaster, submit both sitemaps and retain post-publication IndexNow. |
| Flipboard | Apply under the authorised publication account and provide the canonical RSS feed after the account owner is ready. |
| Feedly | Public RSS is ready; seed the canonical feed once. |
| Medium or other republication | Only selected evergreen pieces, manually, with an explicit canonical link and clear republication label. No mass syndication. |
| Instagram, YouTube, LinkedIn, TikTok | Social auto-posting remains disabled by owner instruction. |

## Five highest-impact changes in this release

1. Make public 1200 × 630 newsroom cards crawlable while keeping held cards private from indexing.
2. Replace click-only archive pagination with crawlable links.
3. Correct article author/publisher structured-data roles and remove an unsupported policy claim.
4. Stabilise publication identity, `@thedubaiupgrade`, RSS discovery and the `en-AE` feed locale.
5. Turn `llms.txt` into a useful, bounded map of the publication and its newest evidence-certified reporting.

## Remaining provider-side work

1. Finish Google Workspace sign-in in the open Search Console tab.
2. Verify the Domain property and `https://news.investwithraj.com/` URL-prefix property.
3. Submit `https://news.investwithraj.com/sitemap.xml` and `https://news.investwithraj.com/news-sitemap.xml`.
4. Import or verify the site in Bing Webmaster and submit the same two sitemaps.
5. Apply to Flipboard only from an authorised publication account; do not invent an account or accept terms on the owner's behalf.
6. Monitor coverage, crawl, queries and referring domains for at least 28 days before judging organic traction.

## Acceptance criteria for this release

- Build, TypeScript, lint and focused newsroom tests pass.
- The exact deployed commit is Ready on the canonical domain.
- Public OG cards return `200`, public caching and no `X-Robots-Tag: noindex`.
- Held/noindex cards remain noindex and uncached.
- Robots, sitemap, news sitemap, RSS and `llms.txt` are reachable.
- `/news` contains crawlable pagination links.
- Article JSON-LD identifies the News Desk as author and the publication as publisher.
- The two 7 September articles remain on the homepage, news sitemap and RSS after deployment.

## Official references

- Google News publication changes: https://support.google.com/news/publisher-center/answer/15898024
- Google News automatic consideration: https://support.google.com/news/publisher-center/answer/9606538
- Google News sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
- Google article images: https://developers.google.com/search/docs/appearance/google-images
- IndexNow protocol: https://www.indexnow.org/documentation
- Bing Webmaster sitemaps: https://www.bing.com/webmasters/help/how-to-submit-sitemaps-82a15bd4
- Flipboard publisher information: https://about.flipboard.com/for-publishers/
