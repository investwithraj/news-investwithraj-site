# Social Syndication Plan — news.investwithraj.com → the channels

*Drafted 24 Jul 2026 · PLAN ONLY (per Raj: "all of that has to be planned") — nothing here is built yet.*

## The goal

Every article the news desk publishes becomes a set of channel-native posts —
image card + caption + link — pushed to Raj's social channels on a fixed
cadence, with Raj approving before anything goes out. The desk already
publishes daily to `main` via the pipeline; syndication bolts onto that
event, it does not change it.

## The channels (phase order)

| Phase | Channel | Handle / surface | Why this order |
|---|---|---|---|
| 1 | Instagram | @rajtomar.dxb | Existing audience; card-first format matches our covers |
| 1 | LinkedIn | Raj's profile → later a company page | Where UAE property capital actually reads |
| 2 | X / Twitter | TBC handle | Headline + link culture fits the desk voice |
| 2 | WhatsApp Channel | broadcast channel | Direct line to the lead pool; zero-algorithm |
| 3 | Telegram channel + YouTube Community | TBC | Cheap once the pipeline exists |

## The pipeline (architecture)

```
article merged to main
        │
        ▼
GitHub Action: syndicate.yml (on push to main, path news/**)
        │
        ├─ 1. CARD — compose the social image
        │      cover.jpg + headline (Raleway 300 upper) + boxed-IWR tile
        │      → 1080×1350 (IG/LI) + 1600×900 (X) via sharp — same
        │      compositor pattern as the site's OG images, NO AI needed
        │      per-post (deterministic, brand-locked)
        │
        ├─ 2. CAPTION — Claude API (claude-sonnet-5) writes 3 variants
        │      per channel from the article body. Voice contract enforced
        │      in the system prompt: advisor never broker, no "underwrite",
        │      British English, no invented numbers, UTM-tagged link
        │      (utm_source=<channel>&utm_medium=social&utm_campaign=<slug>)
        │
        ├─ 3. APPROVAL GATE — nothing posts itself
        │      Draft lands in a WhatsApp message to Raj (Twilio/Meta API)
        │      OR a Notion database row with card preview + caption.
        │      Raj replies 1/2/3 to pick a variant, SKIP to drop.
        │      No reply in 20h = expires unposted. HARD RULE.
        │
        └─ 4. POST — on approval
               IG: Meta Graph API (Business account + FB app review)
               LinkedIn: Community Management API (w/ w_member_social)
               X: API v2 (Basic tier, $200/mo — decide at phase 2)
               WhatsApp Channel: manual-first (no public API yet)
```

## Cadence & selection

- **Daily digest, not firehose**: max 1 post/channel/day. The Action picks
  the highest-ranked article of the day (launch > market-pulse > macro),
  skips days with nothing genuinely new (no filler — brand invariant).
- **Weekly wrap** (phase 2): Sunday carousel — the week's 5 headlines as
  card slides, caption links to the front page.

## What this needs from Raj (the unlock list)

1. Instagram: convert @rajtomar.dxb to a Business account + link a Facebook
   Page (required by the Graph API). ~15 min.
2. Meta developer app + review for `instagram_content_publish` (1–2 weeks
   of Meta review — start early).
3. LinkedIn: developer app + Community Management API access request.
4. Decision: approval surface — WhatsApp (fastest for Raj) or Notion
   (better archive). Recommendation: WhatsApp.
5. Phase 2 decision: pay X API Basic or skip X.

## Costs (monthly, steady state)

- Claude API captions: ~$3–8 (30 articles × 3 channels × short prompts)
- Meta/LinkedIn APIs: free at this volume
- X API Basic: $200 (only if phase 2 approved)
- Twilio WhatsApp approval flow: ~$5

## Explicitly out of scope (for now)

- Auto-posting without the approval gate — never.
- Reels/video syndication — the /reel pipeline exists separately; wiring
  it here is a later phase once static posts prove out.
- Comment/DM handling — manual until a separate decision.

## Build estimate

Phase 1 (IG + LinkedIn, WhatsApp approval): ~2 sessions of build + the
Meta review wait. The card compositor and caption writer are one session;
the Action wiring and approval loop the second.
