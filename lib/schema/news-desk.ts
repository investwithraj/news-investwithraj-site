// Public entity for the collective byline shown on every News Desk report.
// It is an editorial team within the publication, not an individual author.

import { EDITORIAL, SITE } from "@/lib/constants";
import { NEWS_ORG_ID } from "./organization";

export const NEWS_DESK_ID = `${SITE.url}#newsdesk`;

export const newsDeskAuthor = {
  "@type": "Organization",
  "@id": NEWS_DESK_ID,
  name: EDITORIAL.articleByline,
  url: EDITORIAL.bylineUrl,
  description: EDITORIAL.articleRole,
  parentOrganization: { "@id": NEWS_ORG_ID },
} as const;

export const newsDeskSchema = {
  "@context": "https://schema.org",
  ...newsDeskAuthor,
};

export const newsDeskRef = { "@id": NEWS_DESK_ID };
