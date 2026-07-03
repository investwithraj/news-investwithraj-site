// IN-RESEARCH STUB — the recurring Monday-morning DLD transaction round-up.
// Stripped back per the May 2026 honesty pass: the previous body carried
// specific weekly volume figures (AED 21B), area-level metrics, and a
// publication-date timestamp the article never actually shipped at. Slug
// kept warm so when the auto-draft + editorial pipeline (Block 15) goes
// live, the first real Monday round-up will replace this with cited content.

import type { NewsArticle } from "./types";
import { rootCtaUrl } from "@/lib/constants";

export const article: NewsArticle = {
  slug: "2026-05-26-dld-21b-week",
  status: "research",
  title: "DLD weekly transaction round-up — recurring Monday AM",
  subtitle:
    "Every Monday morning we'll publish the previous week's Dubai Land Department transaction round-up — top movers, biggest deals, week-over-week drift.",
  publishedAt: "2026-05-26T07:00:00Z",
  modifiedAt: "2026-05-28T00:00:00Z",
  displayDate: "In research",
  author: "raj-tomar",
  tier: "news",
  category: "market-pulse",
  market: ["Dubai"],
  tldr: [
    "Every Monday morning we'll publish the previous week's Dubai Land Department transaction round-up.",
    "Built from raw DLD CSV — top movers by area, biggest deals, week-over-week median PSF drift.",
    "First round-up publishes once the auto-draft + editorial-review pipeline is online.",
  ],
  body: `Currently being researched.\n\nThis slug is reserved for the recurring Monday-morning DLD transaction round-up — built from the previous week's Dubai Land Department transaction registry. The round-up will surface deal volume, top movers by area, biggest single trades, and median PSF drift week-over-week.\n\nUntil the auto-draft + editorial-review pipeline is online, this slug stays as a placeholder. The first real round-up will be cited directly from raw DLD data with the citation link visible at the bottom of the article.`,
  faq: [
    {
      q: "When does the first DLD round-up publish?",
      a: "When the auto-draft and editorial-review pipeline is online and the previous week's transaction data is in. No fabricated articles ship in the interim.",
    },
  ],
  citations: [
    {
      source: "Dubai Land Department",
      url: "https://dubailand.gov.ae",
      accessedAt: "2026-05-28T00:00:00Z",
    },
  ],
  heroImage: {
    src: "/news/2026-05-26-dld-21b-week/cover.jpg",
    alt: "Dubai Land Department transaction round-up — recurring weekly read",
    credit: "Placeholder cover until first round-up publishes",
  },
  cta: {
    href: rootCtaUrl({ campaign: "news_dld_round_up_stub", content: "newsletter-cta" }),
    label: "Get notified when this column launches",
  },
  distribution: {},
};
