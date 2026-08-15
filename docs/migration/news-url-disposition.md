# Invest With Raj newsroom URL disposition

Audit date: 2026-08-15  
Decision scope: `news.investwithraj.com`, its content registries, route code, generated sitemaps, saved UX metrics, and the full-site audit  
Change scope: recommendation only; no application, content, configuration, deployment, or production change was made

The row-level source of truth is [`news-url-disposition.csv`](./news-url-disposition.csv). It contains 130 unique current URLs or route patterns and no duplicate `current_url` values.

## Executive decision

The indexed newsroom is too broad for the amount of defensible, fresh reporting behind it. Reduce the primary sitemap from 79 URLs to about 31 index-eligible newsroom URLs: five durable/static URLs and 26 retained article URLs. Consolidate thin taxonomy pages into `/news` filters and the main advisory site's dossiers; do not let generated area/developer collections or keyword desks masquerade as independent editorial assets.

### Current primary sitemap: 79 URLs

| Family | Current | KEEP | IMPROVE | MERGE | REDIRECT | NOINDEX | PRIVATE | REMOVE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Static | 9 | 4 | 1 | 2 | 1 | 1 | 0 | 0 |
| Articles | 40 | 1 | 25 | 3 | 3 | 3 | 0 | 5 |
| Areas | 19 | 0 | 0 | 0 | 12 | 7 | 0 | 0 |
| Developers | 6 | 0 | 0 | 0 | 5 | 1 | 0 | 0 |
| Vertical desks | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 0 |
| **Total** | **79** | **5** | **26** | **10** | **21** | **12** | **0** | **5** |

This leaves **31 index-eligible primary newsroom URLs** (`KEEP + IMPROVE`), a reduction of 48 URLs or about 61%.

### Full code/content inventory: 130 rows

| Scope | Rows |
|---|---:|
| Primary sitemap | 79 |
| Content exceptions: one live unsitemapped duplicate plus four research records | 5 |
| Non-sitemap public, empty-format, and internal pages | 8 |
| Discovery/support endpoints | 6 |
| Legacy redirect patterns | 3 |
| API route patterns | 29 |
| **Total** | **130** |

Across all 130 rows: `KEEP 8`, `IMPROVE 30`, `MERGE 10`, `REDIRECT 26`, `NOINDEX 18`, `PRIVATE 24`, and `REMOVE 14`. These totals mix content pages, XML/text support resources, redirects, internal tools, and APIs; use the 79-URL table for the indexed-estate decision.

## Decision rules and issue codes

- `KEEP`: retain canonical URL and current strategic role.
- `IMPROVE`: retain canonical URL but repair evidence, freshness, media, copy, taxonomy, or conversion.
- `MERGE`: move useful content/behavior into the named destination, then 301 when the destination exists.
- `REDIRECT`: 301 to the named equivalent or canonical advisory destination.
- `NOINDEX`: keep accessible for users/operations, remove from sitemap, and enforce `noindex` in meta or `X-Robots-Tag`.
- `PRIVATE`: require authentication or keep the format out of public routing until publication gates pass.
- `REMOVE`: use 410 after dependency, traffic, and backlink checks; do not blanket-redirect unrelated content.

Article shorthand:

- Freshness: `H` high (market/policy/live availability or forecast); `M` medium (historical event, but terms/targets may change); `L` low.
- Image: `I0` exact approved editorial image; `I1` contextual/broad or mismatched fallback; `I2` no display media; `I3` research placeholder.
- Source: `S1` first-party/official plus corroboration; `S2` multiple independent secondary sources; `S3` one credible publication; `S4` unsupported, homepage-only, or non-independent same-domain set; `S5` single syndicated press release.
- Relationship: `A` direct advisory dossier bridge; `N` newsroom only; `N→R` stays News but may support a separately verified, personally authored Raj thesis; `X` no strategic relationship.

## Evidence findings that drive the matrix

1. **Freshness is the biggest product failure.** The audit ran at `2026-08-15T15:37:30Z`; the newest article was published at `2026-08-13T00:06Z`, about 63.5 hours earlier. The Google News sitemap uses a 48-hour window, so it would be empty. A newsroom promising current intelligence needs a measured 24–48 hour heartbeat or an honest archive state.
2. **The registry has 45 records, but the public model is inconsistent.** Forty-one are `live` and four are `research`. The article route generates only live slugs, so research records return 404 even though stale schema comments say research slugs stay warm. Of the 41 live records, 40 enter the sitemap; the second Danah Bay article remains public and indexable but is silently omitted by near-duplicate selection.
3. **Evidence depth is uneven.** The 41 live articles contain 13 one-source, 13 two-source, eight three-source, six four-source, and one five-source records. Thirteen are single-source even though the public editorial standard describes a two-allowlisted-domain automated publication gate. Bottom-of-page source lists do not substitute for claim-level links in long, analytical paragraphs.
4. **Media rarely evidences the report.** Only 1 of 41 live articles passes the strict exact editorial-image gate. Twenty-four render broad area/developer context and 16 render no image. Several fallbacks are materially mismatched: Yas imagery on a Masdar launch, Saadiyat imagery on Yas Point, Palm Jumeirah imagery on RAK and Al Barari stories, and Nakheel imagery on a Dubai Holding/CBD report.
5. **Publication provenance is mostly legacy.** Only the two 2026-08-13 records carry `publicationContentHash`; 39 do not. All 41 have `modifiedAt === publishedAt`, so there is no visible correction or revalidation history despite time-sensitive claims.
6. **Generated taxonomies create thin and false associations.** All 19 public area records have empty source bodies and no citations; the page supplies generic copy. Loose full-body name matching produces incidental results such as 15 Palm Jumeirah reports, including RAK and Al Barari stories. The six developer pages are similarly thin; Nakheel and Sobha matches appear entity-adjacent rather than central.
7. **The developer hub is oversized.** `/developers` renders 45 canonical cards, but only six developers have any live internal report page; the other 39 cards point to external official sites. The audited page is 29.5 screens, 1,220 words, and 165 links. The advisory developer directory should own comparison/decision intent.
8. **Five verticals are overlapping keyword collections.** They contain 5, 13, 6, 4, and 7 reports and include duplicate or retirement candidates. Merge them into supported `/news` filters. Reserve “Beyond the Deal” for an actual Raj-authored edition.
9. **News and Raj-authored Intelligence are currently blurred.** Every live `NewsArticle` is hardcoded to `tier: "news"` and `author: "raj-tomar"`; current records do not expose an actual `semaform.theTake`, and `content/insights` is empty. The newsroom home calls its feed “Current intelligence,” while advisory uses “Intelligence / Latest from Raj.” Reported facts, desk synthesis, and Raj's personal conclusion need explicit boundaries.
10. **Some copy is defensive or misleading.** `/pulse` is linked as live numbers/direction but says it is a future test with no public scores. “Ask Raj” leads to an automated tool whose page says it is not Raj. `/map`, developer pages, media notices, article disclaimers, and `llms.txt` repeatedly explain what the product is not. Replace this with verifiable scope, source, timestamp, and ownership language.

## Static primary URLs

| URL | Decision | Destination | Role after migration | Main issue |
|---|---|---|---|---|
| `/` | IMPROVE | `/` | Fresh newsroom gateway | 63.5-hour stale lead; Intelligence naming collision |
| `/news` | KEEP | `/news` | Canonical archive and filter surface | Add filters, freshness state, imagery and contextual conversion |
| `/areas` | MERGE | `/news` | Area filter plus outbound dossiers | Thin generated directory |
| `/map` | MERGE | `/news` | Optional view/filter inside archive | No independent data layer; defensive copy |
| `/terminal` | NOINDEX | self | Power-user utility | Remove from sitemap; not a search landing page |
| `/developers` | REDIRECT | `https://investwithraj.com/developers` | Advisory comparison/dossier hub | 45-card, 165-link overgrowth |
| `/about` | KEEP | self | Publisher trust | Keep claims factual |
| `/about/editorial-standards` | KEEP | self | Editorial governance | Corpus and two-domain promise diverge |
| `/legal/privacy` | KEEP | self | Legal support | Re-review after analytics/form changes |

## Article matrix: all 40 sitemap articles plus the live unsitemapped duplicate

| # | Sitemap | Article slug | Decision | Destination | Risk / source / image | Relationship and route |
|---:|:---:|---|---|---|---|---|
| 1 | yes | `2026-08-13-dubai-luxury-segment-posts-aed-87-71bn-as-conviction` | IMPROVE | self | H / S1 / I1 | N→R; separate authored thesis, then `/engage` |
| 2 | yes | `2026-08-13-omniyat-acquires-36-600-sqm-marjan-beach-plot-in-first-rak` | IMPROVE | self | M / S1 / I2 | A; Al Marjan dossier, then `/engage` |
| 3 | yes | `2026-07-28-burtville-launches-405-unit-bab-al-qasr-garden-residences-65` | IMPROVE | self | H / S5 / I1 | A after evidence repair; decision CTA |
| 4 | yes | `2026-07-26-off-plan-sales-capture-71-of-dubai-transactions-as-h1-2026-h` | IMPROVE | self | H / S2 / I1 | N→R; separate off-plan thesis, then `/engage` |
| 5 | yes | `2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes` | IMPROVE | self | H / S3 / I1 | N; DLD filter, then decision CTA |
| 6 | yes | `2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island` | KEEP | self | M / S1 / I0 | A; Saadiyat/Aldar dossier, then `/engage` |
| 7 | yes | `2026-07-22-dubai-office-rents-stabilise-at-aed-238-sqft-as-grade-a-scar` | IMPROVE | self | H / S3 / I1 | N→R; separate office thesis, then `/engage` |
| 8 | yes | `2026-07-21-ethiopia-sets-10m-investment-bar-for-golden-visa-18-uae-prop` | REMOVE | 410 | H / S4 / I2 | X; cited URL does not support Ethiopia claim |
| 9 | yes | `2026-07-19-aed-318-billion-q1-transactions-reveal-diverging-investor-ma` | IMPROVE | self | H / S1 / I1 | N→R; separate allocation thesis, then `/engage` |
| 10 | yes | `2026-07-14-dubai-property-prices-fall-1-24-in-june-as-yields-hold-at-6-` | IMPROVE | self | H / S3 / I1 | N→R; separate pricing/yield thesis |
| 11 | yes | `2026-07-12-kuwait-property-deals-fall-13-as-land-fees-and-war-chill-h1-` | REMOVE | 410 | H / S3 / I2 | X; out of UAE decision scope |
| 12 | yes | `2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe` | IMPROVE | self | H / S1 / I1 | A; Yas/Aldar dossier, then `/engage` |
| 13 | yes | `2026-07-10-dubai-retail-sales-surge-171-to-aed-2-1bn-as-off-plan-mandat` | IMPROVE | self | H / S1 / I1 | N→R; clarify retail-property thesis |
| 14 | yes | `2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co` | IMPROVE | self | H / S5 / I1 | A; Modon dossier after terms verification |
| 15 | yes | `2026-07-08-dubai-ultra-prime-sales-hit-5-1bn-as-296-homes-above-10m-tra` | MERGE | Aug-13 luxury report | H / S2 / I1 | N→R; preserve non-duplicate series data |
| 16 | yes | `2026-07-06-bugatti-residences-closes-aed-270mn-in-june-penthouse-sales` | IMPROVE | self | H / S2 / I2 | N; decision CTA |
| 17 | yes | `2026-07-02-dubai-real-estate-sets-historic-high-water-mark-with-aed-252` | IMPROVE | self | H / S1 / I1 | N→R; separate cycle analysis |
| 18 | yes | `2026-07-01-uk-buyers-lead-dubai-property-demand-but-banks-tighten-the-g` | IMPROVE | self | H / S2 / I1 | N→R; separate buyer-finance thesis |
| 19 | yes | `2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif` | REMOVE | 410 | H / S5 / I2 | X; out of UAE scope and press-release-only |
| 20 | yes | `2026-06-28-dubai-mandates-monthly-rent-option-across-12-landlords-in-fl` | REDIRECT | Jun-23 Flexi Rent report | H / S2 / I2 | N→R; merge clarifications, then 301 |
| 21 | yes | `2026-06-24-oman-tenders-1-035bn-solar-mandate-as-vision-2040-absorbs-1-` | REMOVE | 410 | H / S4 / I2 | X; non-property and same-domain citations |
| 22 | yes | `2026-06-23-dubai-launches-flexi-rent-12-landlords-offer-monthly-instalm` | IMPROVE | self | H / S2 / I2 | N→R; canonical Flexi Rent report |
| 23 | yes | `2026-06-22-oman-scraps-sponsor-mandate-for-property-linked-residency-pe` | NOINDEX | self | H / S4 / I2 | X pending exact official rule |
| 24 | yes | `2026-06-22-from-dhoom-to-dubai-how-rimi-sen-traded-bollywood-for-luxury` | REMOVE | 410 | M / S2 / I2 | X; celebrity profile lacks decision consequence |
| 25 | yes | `2026-06-20-ahs-properties-acquires-shangri-la-dubai-for-dh1-1bn-eyes-dh` | REDIRECT | Jun-10 Shangri-La report | M / S2 / I2 | N; same transaction |
| 26 | yes | `2026-06-18-dld-expands-barwa-programme-with-workshops-after-serving-18-` | NOINDEX | self | M / S1 / I2 | N; low capital-decision consequence |
| 27 | yes | `2026-06-18-abu-dhabi-residential-sales-hit-dh38-1bn-in-record-q1-2026` | IMPROVE | self | H / S3 / I1 | N→R; separate Abu Dhabi cycle analysis |
| 28 | yes | `2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-gains-i` | IMPROVE | self | M / S2 / I1 | A; canonical Danah Bay survivor |
| 29 | **no** | `2026-06-17-dir-completes-189-villa-delivery-at-danah-bay-as-rak-absorbs` | REDIRECT | preceding Danah Bay report | M / S2 / I2 | A; public/indexable duplicate omitted from sitemap |
| 30 | yes | `2026-06-14-branded-residences-command-64-premium-as-dubai-buyers-chase-` | IMPROVE | self | H / S2 / I1 | N→R; separate branded-residence thesis |
| 31 | yes | `2026-06-13-palm-jumeirah-handover-2026-two-sold-out-towers-test-the-cre` | IMPROVE | self | M / S3 / I1 | A; Palm Jumeirah dossier |
| 32 | yes | `2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may` | MERGE | Aug-13 luxury report | H / S3 / I1 | N→R; preserve May series point |
| 33 | yes | `2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du` | IMPROVE | self | H / S2 / I1 | A; Emaar dossier |
| 34 | yes | `2026-06-10-shangri-la-dubai-sells-for-dh1-1bn-as-sheikh-zayed-road-valu` | IMPROVE | self | M / S2 / I1 | N; canonical transaction survivor |
| 35 | yes | `2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-` | IMPROVE | self | H / S2 / I1 | A after entity-match repair |
| 36 | yes | `2026-06-07-dubai-logs-dhs28-51bn-in-may-property-deals-as-off-plan-abso` | IMPROVE | self | H / S1 / I2 | N→R; off-plan cycle input |
| 37 | yes | `2026-06-06-dubai-s-off-plan-dominance-66-900-sales-in-five-months-as-ma` | MERGE | Jul-26 H1 off-plan report | H / S2 / I2 | N→R; preserve compatible series point |
| 38 | yes | `2026-06-05-abu-dhabi-s-rent-freeze-a-structural-intervention-in-the-cap` | IMPROVE | self | H / S2 / I2 | N→R; official rule required |
| 39 | yes | `2026-05-31-al-barari-villa-leased-for-aed-14-million-sets-dubai-rental-` | REDIRECT | May-30 Al Barari report | M / S3 / I1 | N; same AED 7m-per-year deal |
| 40 | yes | `2026-05-30-al-barari-villa-lease-resets-dubai-ultra-prime-rental-ceilin` | IMPROVE | self | M / S2 / I1 | N→R; canonical survivor |
| 41 | yes | `2026-05-30-dubai-s-19-6m-visitors-drive-luxury-property-surge-as-touris` | NOINDEX | self | H / S2 / I1 | N; causal thesis needs primary series |

Exact redirect targets, full titles, conversion routes, confidence, and blockers are in the CSV.

### Research-only article records

| Route | Current | Decision | Destination |
|---|---|---|---|
| `/news/2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-` | 404 | REDIRECT | Live 2026-07-23 Marsa report |
| `/news/2026-05-26-dld-21b-week` | 404 | PRIVATE | No public route until reviewed publication |
| `/news/2026-05-26-modon-hudayriyat-golf-estate` | 404 | PRIVATE | No public route until reviewed publication |
| `/news/2026-05-26-golden-visa-mortgage-flex` | 404 | PRIVATE | No public route until reviewed publication |

## Area pages

All 19 are generated report indexes with generic substitute copy, empty registry bodies, and zero page citations. The report count below is the current loose matcher count, not the number of area-focused investigations.

| URL | Reports | Decision | Destination / hold state |
|---|---:|---|---|
| `/areas/hudayriyat-island` | 2 | REDIRECT | `https://investwithraj.com/areas/hudayriyat-island` |
| `/areas/palm-jebel-ali` | 4 | REDIRECT | `https://investwithraj.com/areas/palm-jebel-ali` |
| `/areas/wynn-al-marjan` | 2 | REDIRECT | `https://investwithraj.com/projects/wynn-al-marjan` |
| `/areas/downtown-dubai` | 5 | REDIRECT | `https://investwithraj.com/areas/downtown-dubai` |
| `/areas/dubai-marina` | 2 | REDIRECT | `https://investwithraj.com/areas/dubai-marina` |
| `/areas/palm-jumeirah` | 15 | REDIRECT | `https://investwithraj.com/areas/palm-jumeirah` |
| `/areas/business-bay` | 9 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/difc` | 1 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/dubai-hills-estate` | 3 | REDIRECT | `https://investwithraj.com/areas/dubai-hills-estate` |
| `/areas/jvc` | 3 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/mbr-city` | 1 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/dubai-creek-harbour` | 1 | REDIRECT | `https://investwithraj.com/areas/dubai-creek-harbour` |
| `/areas/saadiyat-island` | 4 | REDIRECT | `https://investwithraj.com/areas/saadiyat-island` |
| `/areas/yas-island` | 4 | REDIRECT | `https://investwithraj.com/areas/yas-island` |
| `/areas/al-reem-island` | 4 | REDIRECT | `https://investwithraj.com/areas/al-reem-island` |
| `/areas/al-raha-beach` | 2 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/masdar-city` | 1 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/al-reef` | 1 | NOINDEX | Internal filter until canonical dossier exists |
| `/areas/al-marjan-island` | 3 | REDIRECT | `https://investwithraj.com/areas/al-marjan-island` |

Create a new public newsroom area landing page only when it has a distinct search purpose, a real editorial introduction/source pack, and preferably at least three central-subject reports. A mere string mention is not enough.

## Developer pages

| URL | Reports | Decision | Destination / hold state |
|---|---:|---|---|
| `/developer/emaar` | 1 | REDIRECT | `https://investwithraj.com/developers/emaar` |
| `/developer/aldar` | 2 | REDIRECT | `https://investwithraj.com/developers/aldar` |
| `/developer/nakheel` | 1 | REDIRECT | `https://investwithraj.com/developers/nakheel` |
| `/developer/modon` | 1 | REDIRECT | `https://investwithraj.com/developers/modon` |
| `/developer/sobha` | 2 | REDIRECT | `https://investwithraj.com/developers/sobha` |
| `/developer/dubai-holding` | 2 | NOINDEX | Internal filter until a canonical advisory dossier exists |

The Nakheel and Sobha match sets need manual review before links are carried into advisory dossiers; the current articles do not appear centrally about those developers.

## Vertical desks

| URL | Reports | Decision | Destination |
|---|---:|---|---|
| `/v/dld-pulse` | 5 | MERGE | `/news?desk=dld-pulse` |
| `/v/off-plan-watch` | 13 | MERGE | `/news?desk=off-plan-watch` |
| `/v/uhnw-trades` | 6 | MERGE | `/news?desk=uhnw-trades` |
| `/v/sovereign-plays` | 4 | MERGE | `/news?desk=sovereign-plays` |
| `/v/beyond-the-deal` | 7 | MERGE | `/news?desk=beyond-the-deal` |

Implement the filter destinations and canonical behavior before issuing redirects. Re-run membership after article merges/removals so retired and duplicate stories do not survive through a desk page.

## Non-sitemap and support estate

### Public, empty-format, and internal pages

| Route | Current state | Decision | Reason |
|---|---|---|---|
| `/ask` | 200, noindex | NOINDEX | Keep automated brief tool; rename “Ask the desk” and route to human `/engage` handoff |
| `/pulse` | 200, noindex | REMOVE | Empty/future methodology contradicts “live numbers” nav promise |
| `/spatial` | 200, noindex | REDIRECT `/news` | Duplicate navigation surface |
| `/wallet` | 404 | REMOVE | Dead feature |
| `/closing-bell` | 404 while empty | PRIVATE | Publish only after reviewed editions exist |
| `/power-list/[year]` | 404 while empty | PRIVATE | Publish only with defensible methodology and edition |
| `/internal/dashboard` | authenticated, noindex/noarchive | PRIVATE | Retain with defense-in-depth controls |
| `/internal/review` | authenticated, noindex/noarchive | PRIVATE | Retain with defense-in-depth controls |

### Discovery and legacy support

- KEEP: `/sitemap.xml`, `/rss.xml`, and the IndexNow verification text route.
- IMPROVE: `/news-sitemap.xml` (currently empty after 48 hours without a story), `/robots.txt`, and `/llms.txt`.
- REDIRECT: exact `/v17` and `/v16` roots to `/`.
- IMPROVE: replace blanket `/v16/:path* -> /` with one-to-one mappings or 410s after historical URL/log/backlink inventory. A catch-all homepage redirect creates soft-404 risk.

### API inventory: 29 patterns

Apply `X-Robots-Tag: noindex, nofollow, noarchive` consistently to any publicly reachable API response where meaningful. Robots disallow alone is not an indexation control.

- `NOINDEX` public/support APIs (5): `/api/brief`, `/api/dld-pulse`, `/api/fx`, `/api/front`, `/api/og`. `/api/front` is conditional on an external consumer contract; none was visible in local page code.
- `PRIVATE` editorial/operational APIs (17): `/api/anchor`, `/api/cron/draft`, `/api/daily-intro`, `/api/digest`, `/api/distribute`, `/api/indexnow`, `/api/news/draft`, `/api/news/draft/reservation`, `/api/news/draft/[id]`, `/api/news/draft/[id]/media-approval`, `/api/news/draft/[id]/publish`, `/api/news/draft/[id]/deployment`, `/api/post-publish`, `/api/press-inbox`, `/api/queue/add`, `/api/queue/action/[id]`, `/api/stock-cover`.
- `REMOVE` disabled/test/dead APIs (7): `/api/cover-image`, `/api/sentiment`, `/api/translate`, `/api/veo-test`, `/api/vertex-test`, `/api/voice`, `/api/wallet/install`. Check access logs/external consumers before removing translate or voice.

## News versus “Latest from Raj” contract

Use three explicit editorial states:

1. **News** — verified event/data reporting. Suggested byline: “IWR News Desk,” with “reviewed by Raj Tomar” only when review is logged. These articles may link to advisory dossiers and `/engage` but must not automatically populate “Latest from Raj.”
2. **Raj's view inside News** — a clearly labeled, separately attested block with author timestamp, distinct from reported facts. Do not infer it from generic “why this matters” prose.
3. **Latest from Raj / Intelligence** — first-person, thesis-led, durable advisory analysis that Raj has explicitly authored or approved. It should live on the advisory canonical surface and cite supporting News as evidence.

Strong candidates for a separately authored extraction, subject to Raj's attestation and stronger evidence, are the Aug-13 luxury-cycle report; Jul-19 diverging mandates; Jul-14 price/yield read; Jul-1 UK buyer/finance piece; Jun-23 Flexi Rent; Jun-5 rent freeze; Jun-14 branded residences; and the H1 off-plan analysis. The underlying newsroom reports remain `News`.

## Conversion routes by family

- Article: keep the current slug-specific `decisionCta` pattern to `/engage?utm_source=news&utm_medium=article...`; precede it with the most relevant advisory area/developer/project dossier when one exists.
- Raj-thesis candidate: News evidence → separately authored advisory “Latest from Raj” asset → `/engage`.
- Area/developer decision intent: 301 directly to the canonical advisory dossier → `/engage`.
- `/news` and filters: selected report/dossier → `/engage`; add contextual routes because the archive currently relies mostly on global footer/header conversion.
- `/ask`: automated brief → clearly offered human review → `/engage`.
- Removed/private/off-topic content: no conversion redirect to an unrelated commercial page.

## Migration controls and order

1. Export Search Console performance, backlinks, server logs, and analytics for every retirement candidate. Preserve a content/evidence snapshot.
2. Create `/news` area/desk filters and verify advisory dossier destinations before any MERGE/REDIRECT release.
3. Merge useful unique evidence into canonical survivors; add explicit one-to-one 301s for duplicate URLs, including the live unsitemapped Danah Bay record and research Marsa duplicate.
4. Apply noindex and remove affected URLs from sitemap, Google News sitemap, RSS where relevant, `llms.txt`, internal navigation, and structured data in the same release.
5. Use 410 for unsupported/off-scope pages only after traffic/backlink/client-use checks. Do not redirect them to `/`.
6. Rebuild the primary sitemap at about 31 index-eligible content URLs; validate status, canonical, robots, feeds, XML, schema, and redirect chains.
7. Establish a freshness SLO, correction timestamp, claim-level citation pattern, exact-media gate, and byline/attestation log before increasing cadence.

## Confidence and evidence blockers

High confidence applies to route existence, sitemap membership, registry counts, generated relationships, code-level indexability, duplicate mechanics, image selection, source-domain counts, and current internal redirect behavior.

The following evidence was not available and must gate irreversible action:

- No Search Console query/page export, backlink inventory, GA4/conversion data, or production access logs. Therefore strategic 410 recommendations for Kuwait, Fendi/Oman, and dead formats remain medium confidence until demand/dependency checks.
- Advisory relation destinations come from the newsroom relation map; production ownership/status should be confirmed with the advisory workstream before redirects ship.
- No author attestation log exists to prove which analytical passages Raj personally wrote or approved. Do not promote any current News article to “Latest from Raj” solely from its byline.
- Source URLs and code records were inspected, but this workstream did not independently re-report every factual claim. High-stakes policy pieces require official-source revalidation.
- External consumers were not available for `/api/front`, `/api/translate`, `/api/voice`, or the blanket `/v16/:path*` legacy estate.
- No historical correction/version log exists; `modifiedAt` equals `publishedAt` across all 41 live records.

## Evidence base

- Source repo: `worktrees/iwr-news-redesign`
- Sitemap generator: `app/sitemap.ts`
- Public boundary: `lib/public-content.ts`
- Article registry: `content/news/index.ts` and `content/news/*.ts`
- Editorial matching/deduplication: `lib/news-editorial.ts`
- Display-media resolver: `lib/article-display-media.ts`
- Advisory destination map: `lib/advisory-relations.ts`
- UX metrics: `outputs/full-site-audit-2026-08-15/news-ux-metrics.json`
- Full-site audit: `worktrees/iwr-production-recovery/outputs/full-site-audit-2026-08-15/IWR-FULL-SITE-AUDIT.md`

