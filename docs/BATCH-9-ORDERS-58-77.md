# Batch 9 — Orders 58–77

Status: completed on local production previews; deployment intentionally withheld  
Sequence source: `../iwr-redesign/docs/NEXT-LEVEL-SITE-ARCHITECTURE-MASTER.md`,
immediately after Order 57 (`/map`)  
Products: `investwithraj.com` and `news.investwithraj.com`  
Release rule: local preview only; no push or deployment

This numbering is the direct continuation of the approved architecture
sequence. The earlier planning file did not contain a separate numbered
58–77 ledger, so this document locks the derived mapping before implementation.

## Order map

| Order | Product | Scope |
| ---: | --- | --- |
| 58 | News | `/terminal` |
| 59 | News | `/ask` |
| 60 | News | `/spatial` |
| 61 | News | `/wallet` |
| 62 | News | `/about` |
| 63 | News | `/about/editorial-standards` |
| 64 | News | `/legal/privacy` |
| 65 | News/internal | Protected `/internal/review` and `/internal/dashboard` family |
| 66 | Both | Global button hierarchy and CTA priority |
| 67 | Both | Required privacy-safe analytics and conversion events |
| 68 | Both | Link rules and complete internal/external link crawl |
| 69 | Both | Combined current-media inventory and validity audit |
| 70 | Advisory | Advisory media groups and source ledger |
| 71 | Advisory | Advisory video register; prohibited AI-style homepage background remains removed |
| 72 | News | News media groups and source ledger |
| 73 | News | News video/audio register and opt-in audio governance |
| 74 | Both | UHD delivery contract |
| 75 | Both | Zero-repetition asset-manifest contract |
| 76 | Both | Motion language, accessibility and performance contract |
| 77 | Both | Motion Array, Adobe and Higgsfield provenance/use contract |

## Non-negotiable acceptance

- The system exists to move a suitable reader toward a working call with Raj.
- Investors and ordinary home/relocation buyers remain ahead of private-family
  and developer audiences unless a route declares a narrower audience.
- Raj remains the visible accountable human.
- Luxury means modern editorial restraint, not old-fashioned styling,
  fake-live terminals, science-fiction interfaces or decorative gimmicks.
- Only real photography and official project/developer material may represent
  real places, people, projects or news events.
- No AI background video. No former-affiliation or discarded-inspiration reference. Contact:
  `office@investwithraj.com`.
- Every public route receives global navigation, footer, contextual links,
  metadata, structured data where appropriate and a conversion route.
- Internal tools remain authenticated, `noindex`, absent from public
  navigation and non-cacheable.
- Full-bleed stills must have genuine 3840×2160 sources; portrait full-bleed
  sources must be at least 2160×2880.
- No visible image source repeats within a page without a documented,
  functional reason.
- Audio is user-initiated only. Reduced-motion mode shows complete static
  content.
- Analytics never receive email addresses, phone numbers, free-form notes or
  chat content.

## Evidence required before completion

1. Targeted lint and TypeScript pass.
2. Both production builds pass.
3. Every Order 58–65 route renders with the expected index/auth state.
4. Desktop, tablet, mobile and reduced-motion browser checks pass.
5. Booking, WhatsApp, cross-domain advisory and contextual links resolve.
6. Internal tools reject unauthenticated requests and send no-store/noindex
   responses.
7. The link crawler reports no unexplained dead end or unsafe new-tab link.
8. Media dimensions, source records, video posters, audio controls and
   per-page repetition checks pass.
9. Required analytics events are emitted only after relevant consent and
   carry no prohibited personal fields.
10. Fresh local previews are restored on ports 3127 and 3130.
