import type { Metadata } from "next";
import { CLOSING_BELLS } from "@/content/closing-bell";
import { SITE } from "@/lib/constants";
import {
  INDEXABLE_NEWS_ARTICLES,
  PUBLIC_AREAS,
} from "@/lib/public-content";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export const dynamic = "force-static";

const canonical = `${SITE.url}/terminal`;

export const metadata: Metadata = {
  title: "UAE property intelligence terminal",
  description:
    "A configurable workspace for cited UAE property reporting, the official DLD pulse, current FX when available, area guides and desk shortcuts.",
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: {
    title: "UAE property intelligence terminal — Invest With Raj",
    description:
      "A power-user workspace with visible sources, freshness and fallback states.",
    type: "website",
    url: canonical,
  },
};

export default function TerminalPage() {
  const reports = INDEXABLE_NEWS_ARTICLES
    .slice(0, 12)
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      category: article.category,
      displayDate: article.displayDate,
      publishedAt: article.publishedAt,
      modifiedAt: article.modifiedAt,
      markets: article.market,
      sourceCount: article.citations.length,
      sourceLabels: [
        ...new Set(article.citations.map((citation) => citation.source)),
      ].slice(0, 3),
    }));

  const areas = PUBLIC_AREAS.map((area) => ({
    slug: area.slug,
    name: area.name,
    emirate: area.emirate,
    modifiedAt: area.modifiedAt,
  }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20);

  const bells = CLOSING_BELLS.slice(0, 4).map((bell) => ({
    slug: bell.slug,
    title: bell.title,
    displayDate: bell.displayDate,
    highlights: bell.highlights as unknown as string[],
  }));

  return <TerminalShell reports={reports} areas={areas} bells={bells} />;
}
