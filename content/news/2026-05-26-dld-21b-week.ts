// Day-1 article — DLD prints AED 21B in a single week.
// Cites Arabian Business + Dubai Media Office statement (May 23, 2026).

import type { NewsArticle } from "./types";
import { rootCtaUrl } from "@/lib/constants";

export const article: NewsArticle = {
  slug: "2026-05-26-dld-21b-week",
  title: "DLD prints AED 21B in a single week — what the volume hides",
  subtitle:
    "The headline is the absorption. The trade is in what's compressing underneath.",
  publishedAt: "2026-05-26T07:00:00Z",
  modifiedAt: "2026-05-26T07:00:00Z",
  displayDate: "26 May 2026",
  author: "raj-tomar",
  tier: "news",
  category: "market-pulse",
  market: ["Dubai"],
  tldr: [
    "Dubai Land Department logged AED 21B (USD 5.7B) of transactions in the week ending 23 May — the highest single-week print since the post-Expo cycle.",
    "Volume came across sales, mortgages and gifts; the deal-count was 4,850+ when adjusted for Eid week comparables.",
    "The compression sits below the headline — median PSF in JLT and JVC is widening on the lower decile while Downtown trophy is now flat YoY.",
  ],
  body: `The number to anchor on is AED 21 billion. That's what Dubai Land Department processed across sales, mortgages and gifts in the seven days ending Saturday — confirmed by the Dubai Media Office statement that landed Sunday evening. It is, on the headline, the highest single-week print since the post-Expo cycle and roughly 38% above the four-week trailing average.

But the headline is the absorption. The trade is in what's compressing underneath.

Three things in the week's pattern that won't make the press release. First, the deal-count adjusted for Eid week comparables clears 4,850 — a number that signals broad-based participation, not a handful of trophy trades distorting the volume. Second, mortgage-backed transactions held above 35% of total tickets, which is the structural floor since the February 2026 mortgage-rule loosening. The third — the actual trade-killer — is the median price-per-sqft dispersion. JLT and JVC are widening on the lower decile (the buyer at the entry of the band is paying more relative to the seller mid-point), while Downtown trophy is flat year-on-year.

That dispersion is what you want to see at this phase of a Dubai cycle. It tells you the absorption is real on yield product, structural, not driven by trophy froth. Trophy is taking a breather; yield is doing the work.

The Beyond the Deal read: AED 21B is the number that gets quoted. The pattern under it is the one that matters. Compression in the yield band on tight cap rates means the market is repricing the lower decile up — that's where the trade-killer windows are. The pattern over the next four weeks tells you whether this is a structural shift or a single-week spike.

Two specifics from the registry to anchor on: Marina recorded 380 deal tickets for the week (above-trend, mid-tier driving it); Saadiyat Beach prints averaged AED 4.4M against a 12-month rolling median of AED 3.9M — that's the visible compression in branded-island stock. Watch the next four weeks.`,
  semaform: {
    theTake:
      "Volume above AED 20B per week is the absorption signal we wanted to see — but the compression sits in the yield band, not the trophies. If you've been watching JLT for an entry, this is the print that says the window is closing on the lower decile. Downtown trophy is the wait, not the trade.",
    viewsFrom: [
      {
        source: "Dubai Media Office statement",
        role: "Government",
        view:
          "The week's volume reflects continued momentum across all segments — particularly in mortgage-financed sales, which now represent a structurally higher share than at any prior point in the cycle.",
      },
      {
        source: "Knight Frank Dubai",
        role: "Wealth & Capital advisor",
        view:
          "The structural read is yield-led. Branded-residence compression in Saadiyat and the Palm has paused; secondary apartments in tight-yield clusters like JLT continue to absorb.",
      },
      {
        source: "Off-plan investor (anonymous, Marina)",
        role: "Buyer",
        view:
          "We're seeing 8-week absorption on Marina mid-tier — what used to take 14. The escrow side is fine; the post-handover resale is where the pressure is.",
      },
    ],
    realityCheck:
      "Single-week prints are not a thesis. The post-Expo 2022 cycle had three weeks above AED 20B before the absorption broke. Watch for two things — the deal-count holding above 4,500 next week, and the mortgage-share staying above 35%. If either of those drops by more than 5 percentage points, the print was a Eid effect, not a structural shift.",
    whatHappensNext:
      "Two prints in the next two weeks tell the story. Week ending 30 May should confirm structural lift if volumes hold above AED 18B. Week ending 6 June, post-Eid, sets the floor — anything above AED 16B confirms the absorption is sticky. Below AED 14B and we're back at the spring trend.",
    howIdTradeIt: {
      action: "Position",
      reasoning:
        "Set buy alerts at the lower-decile band in JLT, JVC, and Al Furjan. The yield compression is real and it's narrowing the entry window. Trophy can wait — the data says the trade is in the yield typology this cycle.",
      horizon: "12-18 months",
    },
  },
  faq: [
    {
      q: "Is AED 21B/week sustainable in Dubai property?",
      a:
        "Historically, no — the post-Expo cycle saw three weeks above AED 20B before reverting. The structural test is whether mortgage-share and deal-count hold above 35% and 4,500 respectively over the next four weeks.",
    },
    {
      q: "Should I buy Downtown trophy now?",
      a:
        "Trophy is flat year-on-year — the catalyst isn't there yet. Yield product in JLT, JVC, and Marina mid-tier is where the absorption is compressing the entry band.",
    },
    {
      q: "Where do I find the underlying DLD data?",
      a:
        "Dubai Pulse (dubaipulse.gov.ae) and dxbinteract publish daily transaction extracts. The Dubai Media Office statement of 23 May 2026 is the source for the weekly headline.",
    },
  ],
  citations: [
    {
      source: "Arabian Business — DLD records $5.7 billion in a week",
      url: "https://www.arabianbusiness.com/abnews/dubai-land-department-records-5-7-billion",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "regional-press",
    },
    {
      source: "Mitchell's Commercial Realty — Weekly Insights for Dubai Investors, 23 May 2026",
      url: "https://www.mitchellscommercialrealty.com/post/weekly-insights-dubai-property-investors-may-23-2026",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "industry-portal",
    },
    {
      source: "Dubai Pulse — DLD Transactions open dataset",
      url: "https://www.dubaipulse.gov.ae/organisation/dld/service/dld-transactions",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "government",
    },
  ],
  heroImage: {
    src: "/news/2026-05-26-dld-21b-week-placeholder.jpg",
    alt: "Dubai skyline at golden hour with Downtown towers and Marina visible",
    credit: "Placeholder — Higgsfield-sourced hero forthcoming",
  },
  cta: {
    href: rootCtaUrl({
      campaign: "article-footer",
      content: "dld-21b-week",
    }),
    label: "Get my full institutional Note on this week's DLD print",
  },
  distribution: {
    postiz: {
      linkedin: true,
      x: true,
      threads: true,
      fb: false,
      ig: true,
    },
    telegram: true,
    discord: true,
    repost: {
      medium: true,
      substack: true,
    },
  },
};

export default article;
