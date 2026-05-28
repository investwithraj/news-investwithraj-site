// IN-RESEARCH STUB — UAE Golden Visa + mortgage-rule policy read.
// Stripped back per the May 2026 honesty pass: the previous body carried
// policy-specific claims and date stamps that were not properly traceable
// to primary government sources. Slug kept warm so the next real Golden
// Visa / mortgage-policy change can publish here with citable sources.

import type { NewsArticle } from "./types";
import { rootCtaUrl } from "@/lib/constants";

export const article: NewsArticle = {
  slug: "2026-05-26-golden-visa-mortgage-flex",
  status: "research",
  title: "Golden Visa + UAE mortgage rules — policy read",
  subtitle:
    "Where the property-anchored 10-year residency rules sit today, and what changes when Central Bank UAE adjusts mortgage caps.",
  publishedAt: "2026-05-26T09:00:00Z",
  modifiedAt: "2026-05-28T00:00:00Z",
  displayDate: "In research",
  author: "raj-tomar",
  tier: "news",
  category: "policy",
  market: ["UAE"],
  tldr: [
    "This piece will track the property-anchored Golden Visa eligibility rules + UAE Central Bank mortgage policy changes as they affect investor structuring.",
    "Cited sources at publication: UAE Federal Decrees, Central Bank UAE press releases, DLD eligibility guidance, ADGM / DIFC regulatory updates.",
    "First policy read publishes the next time there's a real, citable rule change to walk through.",
  ],
  body: `Currently being researched.\n\nUAE Golden Visa rules + Central Bank UAE mortgage policy intersect with every cross-border investor structuring conversation. This slug is reserved for the next real, citable rule change — when CBUAE adjusts mortgage caps, or DLD updates eligibility thresholds, or ADGM / DIFC publish new investor-residency pathways.\n\nUntil then, this slug stays warm. The real piece publishes when there's a verifiable policy event to walk through, with all primary-source citations linked at the bottom.`,
  faq: [
    {
      q: "When does the first policy read publish?",
      a: "When there's a real rule change to walk through, with primary-source citations from Federal Decrees, Central Bank UAE, DLD, ADGM, or DIFC. No fabricated policy timelines ship in the interim.",
    },
  ],
  citations: [
    {
      source: "Central Bank of the UAE",
      url: "https://www.centralbank.ae",
      accessedAt: "2026-05-28T00:00:00Z",
    },
  ],
  heroImage: {
    src: "/news/2026-05-26-golden-visa-mortgage-flex/cover.jpg",
    alt: "UAE Golden Visa + mortgage policy read — research in progress",
    credit: "Placeholder cover until first policy read publishes",
  },
  cta: {
    href: rootCtaUrl({ campaign: "news_policy_stub", content: "newsletter-cta" }),
    label: "Get notified on the first policy read",
  },
  distribution: {},
};
