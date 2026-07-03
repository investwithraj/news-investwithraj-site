// IN-RESEARCH STUB — Hudayriyat Golf Estates news read.
// Stripped back per the May 2026 honesty pass: the previous body carried
// the same fabricated thesis content (33% Saadiyat discount, 5× leverage,
// 151% Y3 ROI, AED 1,724/sqft entry) that was killed across the IWR root
// Notes archive. Slug kept warm so the real launch read can publish here
// when verifiable cited content is in.

import type { NewsArticle } from "./types";
import { rootCtaUrl } from "@/lib/constants";

export const article: NewsArticle = {
  slug: "2026-05-26-modon-hudayriyat-golf-estate",
  status: "research",
  title: "Hudayriyat Golf Estates — launch read",
  subtitle:
    "What Modon's first signature precinct on Hudayriyat Island means for early-phase entry into the masterplan.",
  publishedAt: "2026-05-26T08:00:00Z",
  modifiedAt: "2026-05-28T00:00:00Z",
  displayDate: "In research",
  author: "raj-tomar",
  tier: "news",
  category: "launch",
  market: ["Abu Dhabi"],
  tldr: [
    "Modon's Hudayriyat Golf Estates is among the first signature residential precincts to launch on the island.",
    "This piece will examine the masterplan staging, comparable Saadiyat product positioning, payment-plan economics, and Modon execution track once a verifiable transaction set exists.",
    "Sources to be cited at publication: Modon Properties disclosures, Abu Dhabi DLD-equivalent registry, Knight Frank / JLL Saadiyat comparables.",
  ],
  body: `Currently being researched.\n\nModon's Hudayriyat Island is in early-phase build-out, with Golf Estates among the first signature residential precincts to launch. This launch read will examine the masterplan staging, payment-plan structure, comparable Saadiyat positioning, and Modon execution track once a defensible comparable set exists.\n\nUntil then this slug stays warm as a placeholder. The real launch read publishes when each numeric claim has a citable primary source — Modon official disclosures, Abu Dhabi transaction registry, Knight Frank / JLL Saadiyat comparable pricing — not before.`,
  faq: [
    {
      q: "Why is this article not yet published?",
      a: "Every numeric claim in a launch read must trace to a citable primary source. The original draft of this article carried unverified developer-specific projections that the May 2026 honesty pass removed. The piece publishes when the cited sources are in.",
    },
  ],
  citations: [
    {
      source: "Modon Properties",
      url: "https://modonproperties.com",
      accessedAt: "2026-05-28T00:00:00Z",
    },
  ],
  heroImage: {
    src: "/news/2026-05-26-modon-hudayriyat-golf-estate/cover.jpg",
    alt: "Hudayriyat Golf Estates launch — research in progress",
    credit: "Placeholder cover until launch read publishes",
  },
  cta: {
    href: rootCtaUrl({ campaign: "news_hudayriyat_stub", content: "hudayriyat-note-cta" }),
    label: "Read the Note on Hudayriyat",
  },
  distribution: {},
};
