import type { NewsArticle, NewsCategory } from "@/content/news/types";

export type VerticalSlug =
  | "dld-pulse"
  | "off-plan-watch"
  | "uhnw-trades"
  | "sovereign-plays"
  | "beyond-the-deal";

export interface Vertical {
  slug: VerticalSlug;
  name: string;
  tagline: string;
  description: string;
  method: string;
  categories: NewsCategory[];
  keywords: readonly string[];
  excludeKeywords?: readonly string[];
  curatedSlugs: readonly string[];
  relatedAreaSlugs: readonly string[];
  relatedDeveloperSlugs: readonly string[];
  gradient: string;
  accent: string;
  glyph: string;
  cadence: string;
}

export const VERTICALS: Vertical[] = [
  {
    slug: "dld-pulse",
    name: "DLD Pulse",
    tagline: "Verified transaction reporting, placed in market context.",
    description:
      "Dubai property sales, prices and transaction volumes — and what the figures tell buyers and owners.",
    method:
      "Reports enter this desk when the published article cites a primary or attributable market source and its central subject is Dubai transaction volume, pricing or registry activity.",
    categories: ["market-pulse"],
    keywords: [
      "dubai land department",
      "dld",
      "dubai transactions",
      "dubai property prices",
      "dubai real estate",
    ],
    curatedSlugs: [
      "2026-10-07-dubai-rental-contracts-q3-sales",
      "2026-10-02-dubai-september-property-sales",
      "2026-09-30-dubai-offplan-prices-sales-pace",
      "2026-07-25-dubai-logs-aed-419-94bn-in-h1-transactions-as-weekly-volumes",
      "2026-07-14-dubai-property-prices-fall-1-24-in-june-as-yields-hold-at-6-",
      "2026-07-02-dubai-real-estate-sets-historic-high-water-mark-with-aed-252",
      "2026-06-07-dubai-logs-dhs28-51bn-in-may-property-deals-as-off-plan-abso",
    ],
    relatedAreaSlugs: ["downtown-dubai", "palm-jumeirah", "business-bay"],
    relatedDeveloperSlugs: [],
    gradient:
      "linear-gradient(135deg, rgba(178, 146, 79, 0.16), rgba(126, 102, 54, 0.04))",
    accent: "var(--gold-deep)",
    glyph: "01",
    cadence: "Updated when a cited report meets the desk scope",
  },
  {
    slug: "off-plan-watch",
    name: "Off-Plan Watch",
    tagline: "Launches, financing and delivery signals without the sales copy.",
    description:
      "Cited reporting on launches and material changes to off-plan projects across the UAE. Coverage is selective, not a complete inventory or substitute for project due diligence.",
    method:
      "A report qualifies when a launch, financing structure, construction milestone or handover is the main subject and the underlying facts are attributable.",
    categories: ["launch", "market-pulse", "developer-corporate"],
    keywords: [
      "off-plan",
      "handover",
      "delivery",
    ],
    curatedSlugs: [
      "2026-10-08-expo-city-dib-offplan-finance",
      "2026-10-08-elemental-78-jumeirah-garden-city",
      "2026-10-07-anantara-siniya-resort-residences",
      "2026-10-02-one-only-al-maryah-residences",
      "2026-10-03-ritz-carlton-al-maryah-construction",
      "2026-10-02-burj-azizi-kone-elevators",
      "2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-",
      "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
      "2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe",
      "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
      "2026-06-29-dar-global-launches-19-fendi-casa-villas-at-oman-s-aida-clif",
      "2026-06-13-palm-jumeirah-handover-2026-two-sold-out-towers-test-the-cre",
      "2026-06-12-dubai-luxury-off-plan-sales-hit-aed4-96bn-in-may",
      "2026-06-11-emaar-unveils-dh200bn-masterplan-for-150-000-residents-in-du",
    ],
    relatedAreaSlugs: ["palm-jumeirah", "yas-island", "al-marjan-island"],
    relatedDeveloperSlugs: ["aldar", "modon", "nakheel"],
    gradient:
      "linear-gradient(135deg, rgba(10, 16, 36, 0.09), rgba(178, 146, 79, 0.04))",
    accent: "var(--ink)",
    glyph: "02",
    cadence: "Updated when a material launch or delivery report is verified",
  },
  {
    slug: "uhnw-trades",
    name: "UHNW Trades",
    tagline: "Material trophy-property moves, with the evidence visible.",
    description:
      "Ultra-prime home sales, exceptional leases and the branded-residence market across the UAE.",
    method:
      "Selection requires a material ultra-prime residential transaction or a directly relevant market report, with the amount and context supported in the article’s citations.",
    categories: ["market-pulse", "developer-corporate"],
    keywords: [
      "ultra-prime",
      "penthouse",
      "branded residences",
      "branded-home",
      "villa leased",
      "mansion",
      "trophy",
    ],
    curatedSlugs: [
      "2026-10-07-anantara-siniya-resort-residences",
      "2026-10-02-one-only-al-maryah-residences",
      "2026-10-03-ritz-carlton-al-maryah-construction",
      "2026-07-08-dubai-ultra-prime-sales-hit-5-1bn-as-296-homes-above-10m-tra",
      "2026-07-06-bugatti-residences-closes-aed-270mn-in-june-penthouse-sales",
      "2026-06-20-ahs-properties-acquires-shangri-la-dubai-for-dh1-1bn-eyes-dh",
      "2026-05-31-al-barari-villa-leased-for-aed-14-million-sets-dubai-rental-",
      "2026-06-14-branded-residences-command-64-premium-as-dubai-buyers-chase-",
    ],
    relatedAreaSlugs: ["palm-jumeirah", "downtown-dubai", "saadiyat-island"],
    relatedDeveloperSlugs: ["emaar", "damac"],
    gradient:
      "linear-gradient(135deg, rgba(126, 102, 54, 0.18), rgba(216, 192, 137, 0.04))",
    accent: "var(--gold-deep)",
    glyph: "03",
    cadence: "Updated when a cited ultra-prime report clears review",
  },
  {
    slug: "sovereign-plays",
    name: "Sovereign Plays",
    tagline: "Public-capital and state-linked development moves, read carefully.",
    description:
      "A selective archive covering attributable moves by UAE state-linked developers and investment platforms. It is not a comprehensive sovereign-capital tracker.",
    method:
      "Reports qualify only when a named state-linked entity, its disclosed development vehicle or a material public-sector decision is central to the article.",
    categories: ["developer-corporate", "infrastructure", "macro"],
    keywords: [
      "aldar",
      "modon",
      "dubai holding",
      "mubadala",
      "adq",
      "nakheel",
    ],
    excludeKeywords: ["rumour", "rumor"],
    curatedSlugs: [
      "2026-10-03-musaffah-innovation-district",
      "2026-10-05-fourth-corridor-property-pipeline",
      "2026-10-04-abu-dhabi-bus-digital-upgrade",
      "2026-10-03-mid-island-parkway-2027",
      "2026-07-24-aldar-unveils-aed-100bn-marsa-al-saadiyat-abu-dhabi-s-final-",
      "2026-07-23-aldar-activates-aed-100-bn-marsa-al-saadiyat-saadiyat-island",
      "2026-07-10-aldar-unveils-dh6bn-yas-point-1-600-residences-anchor-northe",
      "2026-07-09-modon-and-adib-launch-75-off-plan-financing-for-abu-dhabi-co",
      "2026-06-10-cbd-and-dubai-holding-real-estate-launch-aed-157-9bn-backed-",
    ],
    relatedAreaSlugs: ["saadiyat-island", "hudayriyat-island", "palm-jebel-ali"],
    relatedDeveloperSlugs: ["aldar", "modon", "nakheel"],
    gradient:
      "linear-gradient(135deg, rgba(14, 14, 14, 0.16), rgba(178, 146, 79, 0.04))",
    accent: "var(--navy)",
    glyph: "04",
    cadence: "Updated after attributable state-linked activity is reported",
  },
  {
    slug: "beyond-the-deal",
    name: "Beyond the Deal",
    tagline: "Raj Tomar’s weekly newsletter.",
    description:
      "Weekly letters on UAE real estate, urban design and long-term ownership. Read the editions and subscribe on LinkedIn.",
    method:
      "This legacy route leads to the Beyond the Deal newsletter archive; news articles are not newsletter editions.",
    categories: ["macro", "policy", "regulatory", "market-pulse"],
    keywords: [
      "buyers",
      "banks",
      "mortgage",
      "rent freeze",
      "flexi rent",
      "prices",
      "investor",
      "regulation",
      "residency",
    ],
    curatedSlugs: [
      "2026-07-19-aed-318-billion-q1-transactions-reveal-diverging-investor-ma",
      "2026-07-14-dubai-property-prices-fall-1-24-in-june-as-yields-hold-at-6-",
      "2026-07-01-uk-buyers-lead-dubai-property-demand-but-banks-tighten-the-g",
      "2026-06-05-abu-dhabi-s-rent-freeze-a-structural-intervention-in-the-cap",
    ],
    relatedAreaSlugs: ["dubai-marina", "business-bay", "al-reem-island"],
    relatedDeveloperSlugs: [],
    gradient:
      "linear-gradient(135deg, rgba(32, 32, 33, 0.12), rgba(178, 146, 79, 0.06))",
    accent: "var(--gold-deep)",
    glyph: "05",
    cadence: "Weekly",
  },
];

export function getVerticalBySlug(slug: string): Vertical | null {
  return VERTICALS.find((vertical) => vertical.slug === slug) ?? null;
}

function searchableArticleText(article: NewsArticle): string {
  // Match only the editorial headline. Standfirst and body-level keyword
  // matching over-classify incidental mentions into specialist desks.
  return [article.title]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");
}

export function articleMatchesVertical(
  vertical: Vertical,
  article: NewsArticle,
): boolean {
  // Beyond the Deal is Raj's weekly newsletter, never a keyword news bucket.
  if (vertical.slug === "beyond-the-deal") return false;
  if (article.status === "research") return false;
  if (vertical.curatedSlugs.includes(article.slug)) return true;
  if (!vertical.categories.includes(article.category)) return false;

  const text = searchableArticleText(article);
  const excluded = vertical.excludeKeywords?.some((term) =>
    text.includes(term.toLocaleLowerCase("en")),
  );
  if (excluded) return false;

  return vertical.keywords.some((term) =>
    text.includes(term.toLocaleLowerCase("en")),
  );
}

export function getVerticalArticles(
  vertical: Vertical,
  articles: readonly NewsArticle[],
): NewsArticle[] {
  return articles
    .filter((article) => articleMatchesVertical(vertical, article))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
