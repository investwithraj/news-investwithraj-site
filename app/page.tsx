import type { Metadata } from "next";

import NewsHome from "@/components/redesign/NewsHome";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";

export const metadata: Metadata = {
  title: "UAE Real Estate Intelligence | Invest With Raj",
  description:
    "Source-cited UAE property reporting: what moved, what it changes, and what serious buyers, sellers and developers should do next.",
  alternates: { canonical: "https://news.investwithraj.com/" },
  robots: { index: true, follow: true },
};

export default function Home() {
  const live = sortNewsArticles(NEWS_ARTICLES).filter(
    (article) => article.status !== "research",
  );

  return <NewsHome articles={live} />;
}
