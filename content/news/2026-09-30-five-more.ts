import type { NewsArticle, HeroImage } from "./types";

const publishedAt = "2026-09-30T19:42:00.000Z";
const commons = (file: string, alt: string, credit: string, width: number, height: number): Omit<HeroImage, "src"> => ({
  alt, credit, width, height, approval: "approved-editorial",
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${file}`,
  rightsStatus: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
});
const stock = (file: string, alt: string, width: number, height: number): Omit<HeroImage, "src"> => ({
  alt, credit: "Dubai · IWR licensed image archive", width, height,
  sourceUrl: `https://www.investwithraj.com/media/licensed-real/${file}`,
  rightsStatus: "Owner-approved stock-account archive; reuse receipt in 2026-09-10-daily-news-image-catalogue.md",
  approval: "approved-editorial",
});

type BriefInput = Pick<NewsArticle, "slug" | "title" | "subtitle" | "market" | "category" | "tldr" | "body" | "citations" | "brief"> & { image: Omit<HeroImage, "src"> };
function brief({ image, ...input }: BriefInput): NewsArticle {
  return { ...input, status: "live", publishedAt, modifiedAt: publishedAt, displayDate: "30 September 2026", author: "raj-tomar", tier: "news", format: "short-update", faq: [], distribution: {}, metaDescription: input.subtitle,
    heroImage: { ...image, src: `/news/${input.slug}/${input.slug === "2026-09-30-dubai-offplan-prices-sales-pace" ? "cover.v2.webp" : "cover.webp"}` },
    cta: { href: `https://www.investwithraj.com/engage?intent=investment&source=news&subject=${input.slug}`, label: "Discuss your real estate plans" },
  };
}

export const FIVE_MORE_NEWS_20260930: NewsArticle[] = [
  brief({
    slug: "2026-09-30-dubai-offplan-prices-sales-pace",
    title: "Dubai off-plan prices hold, but sales pace tells a different story",
    subtitle: "New research shows a gap between developers’ headline prices and how quickly homes are selling.",
    market: ["Dubai"], category: "market-pulse",
    tldr: ["44 of 717 projects reduced prices by at least 5% since February’s end.", "Only 28 projects were below their original launch price.", "Pricing against nearby alternatives is shaping sales absorption."],
    body: "Broad discounts have yet to emerge across Dubai’s off-plan market, according to fäm Properties research reported by Khaleej Times on 30 September. Of 717 projects launched since July 2023, 44 had cut prices by at least 5% since the end of February. Just 28 were selling below their initial launch price.\n\nThe more revealing difference was sales pace. Among 574 projects launched since 2025, those priced at least 20% above their area’s median had sold a median 60% of units, against 73.8% for the median project in the sample.\n\nFor a buyer, that makes nearby competition worth examining closely. Compare the total price, layout and instalments with similar homes before treating an unchanged developer price as proof of demand. Slower sales can leave more choice available even when the advertised price stays put.",
    citations: [{ source: "Khaleej Times reporting on fäm Properties research, 30 September 2026", url: "https://www.khaleejtimes.com/business/dubai-developers-hold-off-plan-pricing-as-only-6-projects-cut-prices-by-5-or-more-since-february", accessedAt: "2026-09-30T19:35:00.000Z" }],
    image: stock("440311297.jpg", "Dubai Marina residential towers in daylight — archive neighbourhood photograph", 6506, 6506),
    brief: { headings: [{ beforeParagraph: 2, title: "Price the alternatives" }], note: "How does the asking price compare with similar homes in the same area?", related: { href: "https://www.investwithraj.com/explore", title: "Compare places and projects across Dubai.", label: "Explore real estate" } },
  }),
  brief({
    slug: "2026-09-30-dubai-branded-residences-pipeline",
    title: "Dubai’s branded-home market reaches 175 schemes",
    subtitle: "Knight Frank’s latest study shows an established Dubai market alongside a much newer pipeline in Abu Dhabi and Ras Al Khaimah.",
    market: ["Dubai", "Ras Al Khaimah", "Abu Dhabi"], category: "market-pulse",
    tldr: ["Dubai has 68 live schemes and 107 in development.", "Abu Dhabi has 24 schemes, with 19 still in the pipeline.", "Al Marjan Island’s 23 schemes are all awaiting delivery."],
    body: "Dubai leads Knight Frank’s latest global comparison of branded residences, with 175 schemes across completed developments and the pipeline. Its 28 September research puts Miami second with 73.\n\nThe UAE markets are at different stages. Dubai has 68 live schemes and 107 in the pipeline. Abu Dhabi has 24 in total, including 19 planned schemes; all 23 recorded on Al Marjan Island in Ras Al Khaimah are still to be delivered.\n\nThat difference matters when choosing between an operating residence and a future resort address. In an established building, buyers can examine the service, upkeep and running costs already in place. For a new scheme, the comparison rests on the proposed service agreement, delivery programme and the surrounding development.\n\nOur reading: start with how the home will be used. A full-time city residence and a holiday apartment ask different things of the location and operator, even when both carry a familiar brand.",
    citations: [{ source: "Knight Frank, The Residence Report 2026/27 commentary, 28 September 2026", url: "https://www.knightfrank.ae/newsroom/article/2026/9/why-middle-east-branded-residence-markets-are-developing-differently", accessedAt: "2026-09-30T19:38:00.000Z" }],
    image: stock("dubai-stock.jpg", "Downtown Dubai towers and Burj Khalifa at night", 7952, 5304),
    brief: { headings: [{ beforeParagraph: 2, title: "Buying a service as well as a home" }], note: "Will the service and annual running costs suit the way you plan to use the home?" },
  }),
  brief({
    slug: "2026-09-30-dubai-abu-dhabi-passenger-rail-opens",
    title: "Dubai–Abu Dhabi passenger rail opens a new commuting option",
    subtitle: "The first services from Al Yalayis put station access and onward travel into the conversation about where to live.",
    market: ["Dubai", "UAE"], category: "infrastructure",
    tldr: ["Passenger services from Dubai began on 30 September.", "Al Yalayis connects with Mohammed Bin Zayed City in Abu Dhabi.", "The Dubai station links into the Metro network at Jumeirah Golf Estates."],
    body: "Etihad Rail’s Dubai–Abu Dhabi passenger service began on 30 September, adding a rail option for people travelling between the two cities. Gulf News reported the first departure from Dubai’s Al Yalayis Station at 6.14am and the subsequent return journey.\n\nThe service connects Al Yalayis with Mohammed Bin Zayed City Station in Abu Dhabi. The Dubai station’s connection to the Metro at Jumeirah Golf Estates gives passengers an alternative to driving to the terminal.\n\nFor households splitting work and home between the emirates, the useful comparison is the complete journey: getting to the station, waiting, the train ride and the final connection to work.\n\nOur reading: try that journey at the times you would actually travel before making it part of a home search. A station can broaden the locations worth considering, but its practical value depends on the address at each end of the trip.",
    citations: [{ source: "Gulf News reporting from the inaugural services, 30 September 2026", url: "https://gulfnews.com/uae/dubai/etihad-rail-dubaiabu-dhabi-service-begins-excitement-builds-at-al-yalayis-station-1.500692875", accessedAt: "2026-09-30T19:36:00.000Z" }],
    image: commons("Jumeirah_Golf_Estates_sign_on_metro_line_train.jpg", "Jumeirah Golf Estates destination sign inside a Dubai Metro train in 2022", "Jpbowen, 2022 · Dubai Metro connection; archive photograph, not an Etihad Rail train.", 4896, 3672),
    brief: { headings: [{ beforeParagraph: 2, title: "Think door to door" }], note: "What would your complete home-to-work journey look like using the new service?", related: { href: "https://www.investwithraj.com/areas/jumeirah-golf-estates", title: "Get to know Jumeirah Golf Estates.", label: "Read the area guide" } },
  }),
  brief({
    slug: "2026-09-30-sharjah-residential-inspections-committee",
    title: "Sharjah brings housing inspections under a joint committee",
    subtitle: "Municipal, utility and enforcement bodies will coordinate their work on residential violations across the emirate.",
    market: ["UAE"], category: "regulatory",
    tldr: ["The Executive Council formed the committee on 29 September.", "Its remit includes monitoring homes and coordinating inspections.", "Landlords and tenants both fall within its compliance work."],
    body: "Sharjah has established a committee to coordinate action on residential violations, bringing several public bodies into a shared inspection and monitoring programme.\n\nThe Executive Council’s decision, reported by WAM on 29 September, places the committee under the Chairman of the Department of Municipal Affairs. Members include Sharjah Municipality, police, public prosecution, Civil Defence, SEWA and the Economic Development Department.\n\nIts work will cover housing units across the emirate’s cities, with a focus on consistent monitoring procedures and compliance by landlords and tenants.\n\nFor an owner buying a tenanted building or apartment, the practical issue is whether its present use matches its approvals. Occupancy arrangements, alterations and the records held by the property manager deserve attention alongside the rent roll. A strong rental figure is only one part of understanding how a building is being operated.",
    citations: [{ source: "WAM / Sharjah Executive Council, 29 September 2026", url: "https://www.wam.ae/en/article/c2holh2-sharjah-executive-council-forms-committee-combat", accessedAt: "2026-09-30T19:40:00.000Z", tier: "government" }],
    image: commons("Sharjah_city_skyline_in_2015.jpg", "Sharjah residential towers reflected in the waterfront in 2015", "Mueed Ahmed, 2015 · Sharjah waterfront. Archive city photograph.", 5920, 3776),
    brief: { headings: [{ beforeParagraph: 3, title: "Look beyond the rent roll" }], note: "Do the building’s occupancy, alterations and management records match its approved use?" },
  }),
  brief({
    slug: "2026-09-30-alabbar-community-design-liveability",
    title: "Alabbar puts everyday community life at the centre of development",
    subtitle: "The Emaar founder’s latest comments focus on the public spaces, activities and upkeep that make a neighbourhood work.",
    market: ["Dubai", "UAE"], category: "developer-corporate",
    tldr: ["Alabbar’s comments were reported on 29 September.", "He highlighted public spaces, local identity and community activity.", "Technology should improve how places function, he argued."],
    body: "Mohamed Alabbar has argued that successful real estate development depends on the life around buildings as much as the architecture itself. In comments reported by Khaleej Times on 29 September, the Emaar founder highlighted public space, shops, entertainment and community facilities.\n\nHe described opening places for walking, food and activities before major development is finished, giving people a reason to spend time there early. When discussing established cities such as Al Ain, he emphasised listening to residents and respecting local character.\n\nFor buyers, the discussion points to a useful way of comparing master-planned communities. Visit the streets and shared spaces as well as the show home. Notice which shops are open, how people move around and whether the maintenance matches the presentation.\n\nA generous amenity list is easy to put in a brochure. A neighbourhood that works on an ordinary weekday is something you can experience for yourself.",
    citations: [{ source: "Khaleej Times interview coverage, 29 September 2026", url: "https://www.khaleejtimes.com/business/property/real-estate-success-creating-life-communities-al-ain-alabbar", accessedAt: "2026-09-30T19:48:00.000Z" }],
    image: commons("Dubai_Fountain.jpg", "People gathering beside the Dubai Fountain for an evening show", "GinaD · Dubai Fountain public space, archive photograph.", 4928, 3264),
    brief: { headings: [{ beforeParagraph: 2, title: "Visit the neighbourhood, not just the show home" }], note: "What is already open and being used in the community you are considering?", related: { href: "https://www.investwithraj.com/developers/emaar", title: "Explore Emaar’s communities and projects.", label: "View the developer profile" } },
  }),
];
