// JSON-LD generators for area pages — RealEstateAgent + Place + LocalBusiness.

import { SITE } from "@/lib/constants";
import type { AreaPage } from "@/content/areas/types";
import { rajPersonRef } from "./person";

/** Place schema — the geographic anchor for an area page. */
export function placeSchema(area: AreaPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${SITE.url}/areas/${area.slug}#place`,
    name: area.name,
    description: area.excerpt,
    geo: {
      "@type": "GeoCoordinates",
      latitude: area.coords.lat,
      longitude: area.coords.lng,
    },
    address: {
      "@type": "PostalAddress",
      addressRegion: area.emirate,
      addressCountry: "AE",
    },
    containedInPlace: {
      "@type": "Place",
      name: area.emirate,
      containedInPlace: { "@type": "Country", name: "United Arab Emirates" },
    },
  };
}

/**
 * Advisory context for the area page.
 *
 * The exported function name is retained for existing callers, but the schema
 * deliberately describes a professional advisory service—not a brokerage,
 * agent licence or credential that the public record does not support.
 */
export function realEstateAgentSchema(area: AreaPage): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${SITE.url}/areas/${area.slug}#advisory`,
    name: "Invest With Raj advisory",
    url: SITE.rootUrl,
    image: `${SITE.rootUrl}/media/real-uhd/raj-tomar-portrait.webp`,
    provider: rajPersonRef,
    areaServed: {
      "@id": `${SITE.url}/areas/${area.slug}#place`,
    },
    knowsAbout: [
      `${area.name} real estate`,
      `${area.emirate} property market`,
      area.kind === "island" ? "Island development" : "Master-planned community",
      ...(area.developers.length > 0
        ? area.developers.map((d) => `${d} developments`)
        : []),
    ],
  };
}
