import type { Metadata } from "next";

import NewsHome from "@/components/redesign/NewsHome";
import { getPublicDiscoveryNewsArticles } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "UAE Real Estate Intelligence | Invest With Raj",
  description:
    "Source-cited UAE property reporting: what moved, what it changes, and what serious buyers, sellers and developers should do next.",
  alternates: { canonical: "https://news.investwithraj.com/" },
  robots: { index: true, follow: true },
};

export default function Home() {
  return <NewsHome articles={getPublicDiscoveryNewsArticles()} />;
}
