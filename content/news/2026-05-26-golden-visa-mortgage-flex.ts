// Day-1 article — UAE Golden Visa mortgage rule changes.
// Cites Hudson McKenzie, Gulf News, Visa HQ, CSG Advisory.

import type { NewsArticle } from "./types";
import { rootCtaUrl } from "@/lib/constants";

export const article: NewsArticle = {
  slug: "2026-05-26-golden-visa-mortgage-flex",
  title: "Golden Visa mortgage rules: the AED 2M is now a structure, not a wire",
  subtitle:
    "Feb 2026 changes unlocked mortgage-backed visa eligibility. Here's the actual investor math.",
  publishedAt: "2026-05-26T08:00:00Z",
  modifiedAt: "2026-05-26T08:00:00Z",
  displayDate: "26 May 2026",
  author: "raj-tomar",
  tier: "news",
  category: "policy",
  market: ["UAE"],
  tldr: [
    "AED 2M threshold survives — but since February 2026, the 50% / AED 1M down-payment floor is gone. Mortgage financing is fully accepted on Golden Visa property route.",
    "Off-plan units from RERA-registered developers qualify if registered with DLD via the Oqood system. Eligible at 50% milestone (not 100%).",
    "AED 2M can be assembled as a portfolio — multiple units, mixed mortgage / cash, even across emirates. The structural read is leverage compression, not threshold compression.",
  ],
  body: `The headline change every Dubai broker has put in their May newsletter — Golden Visa mortgage rules are open — is real. But the actual investor math is more useful than the slogan.

What changed in February 2026: mortgage financing is now fully accepted on the Golden Visa property route, with the previous 50% / AED 1 million minimum down-payment floor removed. The AED 2 million threshold survived the April rule changes intact. Off-plan units from RERA-registered developers (Emaar, Damac, Aldar, Sobha, Nakheel and the priority tier) qualify provided the contract and developer confirmation show the AED 2M threshold and the property is registered with DLD through the Oqood system.

That's the regulation. Here's the investor math the regulation actually enables.

First, the leverage equation. With a typical 75-80% LTV mortgage at 5.5-6.5% on a Dubai apartment, your equity deployed against the AED 2M threshold compresses to AED 400K-500K. That's a 4x leverage on the visa entry. The DSR (debt-service ratio) becomes the binding constraint, not the cash deployed.

Second, the off-plan window. Off-plan stock qualifies once a buyer has paid in 50% of the contract value (not 100%). That means a typical Damac launch at AED 2M total contract with a 40/60 payment plan qualifies the moment you hit the 50% milestone — often 18-24 months into a 36-month construction cycle. You're under visa eligibility while still in escrow.

Third, the portfolio assembly. The AED 2M can be assembled across multiple properties, mixed-mortgage/cash, and across emirates. Two AED 1M apartments in JLT, one AED 800K in Sharjah and an AED 1.2M off-plan plot in RAK — that's AED 4M of qualifying portfolio. The structure is the trade, not the threshold.

The Beyond the Deal read: the leverage compression is the structural shift, not the rules. AED 2M still gates the visa — but the equity required to deploy it has dropped from AED 1M+ (under old rules) to AED 400K-500K (with mortgage). That's a 2-2.5x compression in the cost of the visa per the underlying threshold.

Trade-killer to watch: the RERA-approved-developer list is binding. If you're buying from a non-RERA-registered second-tier developer, the visa route is locked even if you cross the threshold. Stick to the top 10 developers and read the Oqood entry before signing.`,
  semaform: {
    theTake:
      "The mortgage rule loosening is the real structural shift — not the AED 2M threshold itself. Equity cost of the visa compressed 2-2.5x. The portfolio-assembly route opens for buyers who couldn't justify a single AED 2M apartment but can assemble across yield plus capital-appreciation positions across emirates.",
    viewsFrom: [
      {
        source: "Hudson McKenzie",
        role: "Immigration legal advisor",
        view:
          "The 2026 updates fundamentally change the leverage equation. Mortgaged and off-plan properties continue to qualify provided total purchase value hits the AED 2M mark and the lending bank issues a no-objection certificate.",
      },
      {
        source: "CSG Advisory",
        role: "Tax & residency",
        view:
          "Off-plan property qualifies for the Golden Visa when the developer is RERA-registered and the property is registered with DLD through the Oqood system. The 50% milestone is the eligibility trigger, not 100%.",
      },
      {
        source: "Gulf News — Dubai Residency by Investment Guide",
        role: "Trade press",
        view:
          "The headline number is AED 2 million in qualifying UAE real estate, but the structure of how that AED 2 million is held has become significantly more flexible in 2026.",
      },
    ],
    realityCheck:
      "Mortgage approvals are still bank-specific. ENBD, Mashreq and FAB are the standard lenders here — and each has its own DSR and post-handover refinancing terms. A 'mortgage-accepted on Golden Visa' headline doesn't mean every bank will write the loan. UHNW buyers using offshore-held funds also face a Source-of-Funds documentation step that has tightened, not loosened.",
    whatHappensNext:
      "Two follow-on regulatory moves to watch in the next 6-12 months. First, RERA may extend the off-plan eligibility milestone backward to 25% paid-in (currently 50%) — that would compress the visa-entry window further. Second, ICA may announce a portfolio-cap for multi-unit holdings to prevent assembly arbitrage. Either move shifts the math.",
    howIdTradeIt: {
      action: "Position",
      reasoning:
        "If you've been waiting to deploy AED 1M+ in cash for the visa, the new math says deploy AED 400-500K in equity across a leveraged AED 2M portfolio. The leverage compression is the trade. Pair with the off-plan 50% milestone for double the entry-window flexibility.",
      horizon: "Position now; portfolio-build over 12-18 months",
    },
  },
  faq: [
    {
      q: "Can I get the Golden Visa with just an off-plan apartment?",
      a:
        "Yes, provided (a) the developer is RERA-registered, (b) the property is registered with DLD through the Oqood system, (c) you've paid in at least 50% of the contract value, and (d) the AED 2M threshold is met. Cash or mortgage — both work.",
    },
    {
      q: "What's the actual equity required?",
      a:
        "With a 75-80% LTV mortgage on a single AED 2M property: AED 400K-500K in down-payment equity, plus the DLD 4% transfer fee (AED 80K), plus typical 2-3% closing costs. Total cash deployed: AED 540K-660K on a 2M-threshold visa.",
    },
    {
      q: "Does a RERA valuation always need to happen?",
      a:
        "No — a RERA valuation is not mandatory in every Golden Visa application. It becomes necessary in cases where the property value cannot be clearly verified through official records.",
    },
    {
      q: "Can I assemble the AED 2M across multiple emirates?",
      a:
        "Yes — including Sharjah, Ras Al Khaimah, Abu Dhabi. The portfolio just needs to total AED 2M of qualifying RERA/DLD-registered property. This is the structural opening the February changes created.",
    },
  ],
  citations: [
    {
      source: "Hudson McKenzie — UAE Golden Visa 2026 Updated Requirements",
      url: "https://www.hudsonmckenzie.com/insights/uae-golden-visa-2026-updated-requirements-salary-thresholds-and-property-rules",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "institutional-research",
    },
    {
      source: "Visa HQ — Property route to UAE Golden Visa clarified",
      url: "https://www.visahq.com/news/2026-05-12/ae/property-route-to-uae-golden-visa-clarified-as-aed-2-million-threshold-survives-april-rule-changes/",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "institutional-research",
    },
    {
      source: "CSG Advisory — Golden Visa: Mortgage Rules + Off-Plan + AED 2M Threshold",
      url: "https://csgadvisory.com/insights/uae-golden-visa-through-real-estate-mortgage-rules-off-plan-property-and-the-aed-2-million-threshold/",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "institutional-research",
    },
    {
      source: "Gulf News — Dubai Property Visa Guide 2026",
      url: "https://gulfnews.com/living-in-uae/visa-immigration/dubai-residency-by-investment-guide-1.500523250",
      accessedAt: "2026-05-26T06:55:00Z",
      tier: "regional-press",
    },
  ],
  heroImage: {
    src: "/news/2026-05-26-golden-visa-mortgage-flex-placeholder.jpg",
    alt: "UAE passport with property documents and Dubai skyline backdrop",
    credit: "Placeholder — Higgsfield-sourced hero forthcoming",
  },
  cta: {
    href: rootCtaUrl({
      campaign: "article-footer",
      content: "golden-visa-mortgage-flex",
    }),
    label: "Get the full Note on Golden Visa portfolio structures",
  },
  distribution: {
    postiz: {
      linkedin: true,
      x: true,
      threads: true,
      fb: true,
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
