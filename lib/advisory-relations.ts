import type { AreaPage } from "@/content/areas/types";

const ADVISORY_AREA_SLUGS = new Set([
  "hudayriyat-island",
  "palm-jebel-ali",
  "downtown-dubai",
  "dubai-marina",
  "palm-jumeirah",
  "dubai-hills-estate",
  "sobha-hartland",
  "dubai-creek-harbour",
  "tilal-al-ghaf",
  "saadiyat-island",
  "yas-island",
  "al-reem-island",
  "al-marjan-island",
]);

const ADVISORY_DEVELOPER_SLUGS = new Set([
  "emaar",
  "aldar",
  "nakheel",
  "modon",
  "sobha",
]);

const ADVISORY_RESEARCH_DESTINATIONS = new Map([
  [
    "palm-jebel-ali-rerating",
    "/projects/palm-jebel-ali-private-listings",
  ],
  ["hudayriyat-golf-estates", "/projects/hudayriyat-golf-estates"],
  ["wynn-al-marjan-yield", "/projects/wynn-al-marjan"],
]);

export type AdvisoryLink = {
  href: string;
  label: string;
  eyebrow: string;
};

export function advisoryLinksForArea(area: AreaPage): AdvisoryLink[] {
  const links: AdvisoryLink[] = [];
  const areaSlug =
    area.iwrRootAreaSlug ??
    (ADVISORY_AREA_SLUGS.has(area.slug) ? area.slug : null);

  if (areaSlug) {
    links.push({
      href: withTracking(
        `https://investwithraj.com/areas/${areaSlug}`,
        "area-dossier",
        area.slug,
      ),
      label: `Open the ${area.name} advisory dossier`,
      eyebrow: "Advisory area dossier",
    });
  }

  if (area.iwrNoteSlug) {
    const destination =
      ADVISORY_RESEARCH_DESTINATIONS.get(area.iwrNoteSlug) ??
      `/notes/${area.iwrNoteSlug}`;
    links.push({
      href: withTracking(
        `https://investwithraj.com${destination}`,
        "institutional-note",
        area.slug,
      ),
      label: "Open the related advisory research",
      eyebrow: "Advisory research",
    });
  }

  return links;
}

export function advisoryLinkForDeveloper(
  slug: string,
  name: string,
): AdvisoryLink | null {
  if (!ADVISORY_DEVELOPER_SLUGS.has(slug)) return null;
  return {
    href: withTracking(
      `https://investwithraj.com/developers/${slug}`,
      "developer-dossier",
      slug,
    ),
    label: `Open the ${name} advisory dossier`,
    eyebrow: "Advisory developer dossier",
  };
}

export function generalAdvisoryUrl(
  context: "area" | "developer",
  slug: string,
): string {
  return withTracking(
    "https://investwithraj.com/engage",
    `${context}-decision`,
    slug,
  );
}

function withTracking(
  base: string,
  campaign: string,
  content: string,
): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", "news.investwithraj.com");
  url.searchParams.set("utm_medium", "editorial");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}
