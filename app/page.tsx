import type { Metadata } from "next";

import NewsHome from "@/components/redesign/NewsHome";
import { SITE } from "@/lib/constants";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";

const PAGE_URL = SITE.url;
const DESCRIPTION =
  "Source-cited UAE real estate reporting: what moved, what it changes, and what serious buyers, sellers and developers should do next.";

export const metadata: Metadata = {
  title: "UAE Real Estate Intelligence",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_AE",
    siteName: SITE.name,
    url: PAGE_URL,
    title: "UAE Real Estate Intelligence",
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE.url}/api/og`,
        width: 1200,
        height: 630,
        alt: `UAE real estate intelligence — ${SITE.name}`,
      },
    ],
  },
};

export default function Home() {
  return <NewsHome articles={getPublicDiscoveryNewsArticles()} />;
}
