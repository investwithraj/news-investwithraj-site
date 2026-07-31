import type { Metadata } from "next";
import { NEWS_ARTICLES } from "@/content/news";
import { AREAS } from "@/content/areas";
import { CLOSING_BELLS } from "@/content/closing-bell";
import { SITE } from "@/lib/constants";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export const dynamic = "force-static";

const canonical = `${SITE.url}/terminal`;

export const metadata: Metadata = {
  title: "UAE property intelligence terminal",
  description:
    "A configurable workspace for cited UAE property reporting, the official DLD pulse, current FX when available, area guides and desk shortcuts.",
  alternates: { canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title: "UAE property intelligence terminal — Invest With Raj",
    description:
      "A power-user workspace with visible sources, freshness and fallback states.",
    type: "website",
    url: canonical,
  },
};

export default function TerminalPage() {
  const reports = NEWS_ARTICLES.filter(
    (article) => article.status !== "research",
  )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
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

  const areas = AREAS.map((area) => ({
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

  return (
    <>
      <JsonLd />
      <TerminalShell reports={reports} areas={areas} bells={bells} />
    </>
  );
}

function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${canonical}#application`,
        name: "Invest With Raj Intelligence terminal",
        url: canonical,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any modern web browser",
        description:
          "A configurable workspace for sourced UAE property reporting and market reference data.",
        isAccessibleForFree: true,
        publisher: { "@id": `${SITE.url}#newsmediaorg` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Daily Market Read",
            item: SITE.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Intelligence terminal",
            item: canonical,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
