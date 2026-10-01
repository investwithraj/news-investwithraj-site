import type { NewsArticle } from "./types";

// Daily chat publication; factual and media record in docs/editorial/2026-10-01-morning.md.
export const MANUAL_NEWS_20261001: NewsArticle[] = [
  {
    slug: "2026-10-01-dubai-loop-preparation-difc-dubai-mall",
    status: "live",
    title: "Dubai Loop preparations advance for the DIFC–Dubai Mall route",
    subtitle: "Tunnel equipment assembly and concrete casting mark progress towards the planned four-station pilot.",
    publishedAt: "2026-10-01T04:15:00.000Z",
    modifiedAt: "2026-10-01T04:15:00.000Z",
    displayDate: "1 October 2026",
    author: "raj-tomar", tier: "news", format: "short-update",
    category: "infrastructure", market: ["Dubai"],
    tldr: [
      "Tunnel-boring equipment is being assembled and concrete segments cast.",
      "The pilot is planned to link DIFC and Dubai Mall across 6.4km.",
      "The wider proposed route would extend towards Business Bay."
    ],
    body: "Preparatory work for Dubai Loop has advanced to tunnel-boring machine assembly and the production of concrete tunnel segments, Gulf News reported on 30 September. The update follows a 29 September meeting between Sheikh Hamdan bin Mohammed and The Boring Company’s president, Steve Davis.\n\nThe contractor describes a 6.4km pilot connecting Dubai International Financial Centre with Dubai Mall through four stations. Its broader plan covers 22.5km and 19 stations, linking the World Trade Centre and financial district with Business Bay. These are planned connections, not operating services.\n\nFor people comparing homes and offices around these districts, the proposed link adds another transport project to follow. The practical question will be where station entrances sit and how they connect to buildings and existing public transport. A district appearing on an alignment does not establish walking access from a particular property.\n\nThe Boring Company’s published programme makes the pilot’s roughly one-year delivery period conditional on completion of design and preparations. It also lists permits and no-objection certificates among the next steps. The latest update therefore records preparation, rather than confirming passenger opening or completion of tunnelling.",
    faq: [],
    citations: [
      { source: "Gulf News, 30 September 2026", url: "https://gulfnews.com/business/dubai-loop-project-advances-as-tunnelling-work-moves-ahead-1.500693726", accessedAt: "2026-10-01T04:10:00.000Z" },
      { source: "The Boring Company — Dubai Loop project details", url: "https://www.boringcompany.com/projects/dubai-loop", accessedAt: "2026-10-01T04:10:00.000Z" }
    ],
    heroImage: {
      src: "/news/2026-10-01-dubai-loop-preparation-difc-dubai-mall/cover.webp",
      alt: "Dubai Mall entrance and surrounding Downtown buildings",
      credit: "Dubai Mall, November 2023. Location context, not the planned Loop station. Photo: EditQ / Wikimedia Commons (CC0).",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Dubai_Mall_12.jpg",
      licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      rightsStatus: "CC0; resized from the 4000 × 3000 original without altering its framing",
      width: 4000, height: 3000, approval: "approved-editorial"
    },
    cta: { href: "https://www.investwithraj.com/engage?intent=investment&source=news&subject=2026-10-01-dubai-loop-preparation-difc-dubai-mall", label: "Discuss your real estate plans" },
    distribution: {},
    metaDescription: "Dubai Loop preparations advance. The planned DIFC–Dubai Mall pilot remains subject to design, permits and delivery milestones.",
    brief: { note: "Station access matters more than a district name on a route map.", headings: [{ beforeParagraph: 2, title: "The property connection" }, { beforeParagraph: 3, title: "What comes next" }] }
  },
  {
    slug: "2026-10-01-aldar-arada-yas-seih-sdeirah",
    status: "live",
    title: "Aldar–Arada partnership adds Yas Island and border-community plans",
    subtitle: "The agreement marks Arada’s entry into Abu Dhabi development.",
    publishedAt: "2026-10-01T04:14:00.000Z",
    modifiedAt: "2026-10-01T04:14:00.000Z",
    displayDate: "1 October 2026",
    author: "raj-tomar", tier: "news", format: "short-update",
    category: "developer-corporate", market: ["Abu Dhabi"],
    tldr: ["Approximately AED15bn in development opportunities.", "A joint community at Seih Sdeirah.", "Three residential plots acquired on Yas Island."],
    body: "Aldar and Arada announced a partnership on 30 September covering approximately AED15 billion of development opportunities in Abu Dhabi. The figure describes the opportunities involved, rather than completed home sales.\n\nAt Seih Sdeirah, on the Abu Dhabi–Dubai border, the partners plan a villa and townhouse community on up to 1.5 million sqm. Arada will lead development and construction management; both companies will brand and sell it.\n\nSeparately, Arada has bought three Yas Island plots from Aldar, including two facing canals. Together they allow almost 130,000 sqm of gross floor area.\n\nThe agreement brings Arada into Abu Dhabi with two different residential settings: an island destination and a border community. Buyers now have an additional developer to follow in the emirate. Home prices and handover dates were not announced.",
    faq: [],
    citations: [{ source: "Arada announcement, 30 September 2026", url: "https://www.arada.com/en/latest-news/aldar-and-arada-form-landmark-aed15-billion-strategic-partnership-to-deliver-major-new-developments-in-abu-dhabi/", accessedAt: "2026-10-01T04:10:00.000Z" }],
    heroImage: {
      src: "/news/2026-10-01-aldar-arada-yas-seih-sdeirah/cover.webp",
      alt: "Yas Marina waterfront and circuit buildings on Yas Island",
      credit: "Yas Island waterfront. Archive location photograph, not the acquired plots. Photo: Pexels.",
      sourceUrl: "https://www.pexels.com/photo/7058845/",
      licenceUrl: "https://www.pexels.com/license/",
      rightsStatus: "Pexels licence; existing verified-provider asset 7058845, native original reacquired and inspected",
      width: 5472, height: 3648, approval: "approved-editorial"
    },
    cta: { href: "https://www.investwithraj.com/engage?intent=investment&source=news&subject=2026-10-01-aldar-arada-yas-seih-sdeirah", label: "Discuss your real estate plans" },
    distribution: {},
    metaDescription: "Arada enters Abu Dhabi through an Aldar partnership covering Yas Island and Seih Sdeirah.",
    brief: { note: "Two locations to compare as project details emerge.", headings: [{ beforeParagraph: 1, title: "Two residential settings" }] }
  }
];
