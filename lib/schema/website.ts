import { SITE } from "@/lib/constants";
import { newsOrgRef } from "./organization";

export const NEWS_WEBSITE_ID = `${SITE.url}#website`;

export const newsWebsiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": NEWS_WEBSITE_ID,
  url: SITE.url,
  name: SITE.name,
  alternateName: "Invest With Raj Intelligence",
  description: SITE.description,
  inLanguage: "en-AE",
  publisher: newsOrgRef,
};

export const newsWebsiteRef = { "@id": NEWS_WEBSITE_ID };
