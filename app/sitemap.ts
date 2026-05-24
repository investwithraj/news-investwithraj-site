import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

/**
 * Sitemap — Block 1 scaffold ships with just the homepage. When Block 2
 * content pipeline lands, this expands to enumerate every /news/[slug],
 * /insights/[slug], /areas/[slug] dynamically from the content registry.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE.url,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
