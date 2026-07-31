import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAllAreaSlugs, getAreaBySlug } from "@/content/areas";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import {
  advisoryLinksForArea,
  generalAdvisoryUrl,
} from "@/lib/advisory-relations";
import { SITE } from "@/lib/constants";
import { DEVELOPERS } from "@/lib/developers";
import {
  articleMentionsArea,
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
  relatedDevelopersForArea,
} from "@/lib/news-editorial";
import {
  asGraph,
  BREADCRUMB_PRESETS,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";
import { getVerifiedAreaMedia } from "@/lib/verified-media";

import styles from "../AreaPages.module.css";

export const dynamicParams = false;
export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return getAllAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) return { title: "Area not found" };
  const media = getVerifiedAreaMedia(slug);

  const evidenceReady =
    Boolean(area.body.trim()) && area.citations.length > 0;
  return {
    title: `${area.name} — property research index`,
    description: `${area.name}, ${area.emirate}: a coordinate-led research index with linked reporting. Market evidence review is ${
      evidenceReady ? "complete" : "pending"
    }.`,
    alternates: { canonical: `${SITE.url}/areas/${slug}` },
    robots: {
      index: evidenceReady,
      follow: true,
    },
    openGraph: {
      type: "website",
      title: `${area.name} research index`,
      description: `Location identity and source-linked reporting for ${area.name}, ${area.emirate}.`,
      url: `${SITE.url}/areas/${slug}`,
      ...(media
        ? {
            images: [
              {
                url: `${SITE.url}${media.src}`,
                width: media.width,
                height: media.height,
                alt: media.alt,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = getAreaBySlug(slug);
  if (!area) notFound();
  const media = getVerifiedAreaMedia(area.slug);

  const evidenceReady =
    Boolean(area.body.trim()) && area.citations.length > 0;
  const relatedNews = sortNewsArticles(NEWS_ARTICLES)
    .filter((article) => article.status !== "research")
    .filter((article) => articleMentionsArea(article, area))
    .slice(0, 8);
  const developers = relatedDevelopersForArea(area, DEVELOPERS);
  const advisoryLinks = advisoryLinksForArea(area);
  const pageUrl = `${SITE.url}/areas/${area.slug}`;
  const [collection, itemList] = collectionPageSchemas({
    url: pageUrl,
    name: `${area.name} reporting index`,
    description: `Source-linked reports that explicitly mention ${area.name}.`,
    dateModified: area.modifiedAt,
    itemListOrder: "descending",
    items: relatedNews.map((article) => ({
      name: article.title,
      url: `${SITE.url}/news/${article.slug}`,
      description: article.subtitle,
    })),
  });
  const graph = asGraph(
    {
      "@context": "https://schema.org",
      "@type": "Place",
      "@id": `${pageUrl}#place`,
      name: area.name,
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
    },
    collection,
    itemList,
    breadcrumbSchema(
      BREADCRUMB_PRESETS.area({ slug: area.slug, name: area.name }),
    ),
  );
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${area.coords.lat},${area.coords.lng}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main" className={styles.page}>
        <header className={styles.detailHero}>
          <Link href="/areas" className={styles.back}>
            ← Area research index
          </Link>
          <div className={styles.detailHead}>
            <div>
              <p className={styles.eyebrow}>
                {area.emirate} · {area.kind.replaceAll("-", " ")}
              </p>
              <h1>{area.name}</h1>
              <p className={styles.dek}>
                This is a research-index entry, not a market appraisal. Numeric
                pricing, yield, supply and ownership fields remain unpublished
                while the source pack is empty.
              </p>
            </div>
            <div className={styles.coordinatePanel}>
              <span>Coordinate record</span>
              <strong>
                {area.coords.lat.toFixed(4)}° N
                <br />
                {area.coords.lng.toFixed(4)}° E
              </strong>
              <small>{area.emirate} · United Arab Emirates</small>
            </div>
          </div>
        </header>

        {media ? (
          <figure className={styles.detailFigure}>
            <Image
              src={media.src}
              width={media.width}
              height={media.height}
              alt={media.alt}
              sizes="100vw"
              quality={95}
              priority
            />
            <figcaption className={styles.detailCredit}>
              <span>{media.notice}</span>
              <span>
                {media.credit ? `${media.credit} · ` : null}
                <a
                  href={media.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {media.sourceLabel}
                </a>
                {" · "}
                {media.licenseUrl ? (
                  <a
                    href={media.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {media.licenseLabel}
                  </a>
                ) : (
                  media.licenseLabel
                )}
              </span>
            </figcaption>
          </figure>
        ) : null}

        <section className={styles.reviewStrip} aria-label="Area review status">
          <div>
            <span>Source review</span>
            <strong>{evidenceReady ? "Evidence pack present" : "Pending"}</strong>
          </div>
          <div>
            <span>Registry last touched</span>
            <strong>{formatEditorialDate(area.modifiedAt)}</strong>
          </div>
          <div>
            <span>Search status</span>
            <p>
              {evidenceReady
                ? "Eligible for indexing"
                : "Noindex until citations and reviewed body copy exist"}
            </p>
          </div>
        </section>

        <nav className={styles.mapActions} aria-label="Map this area">
          <Link href={`/map?area=${area.slug}`}>Open on the intelligence map ↗</Link>
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            Open exact coordinates ↗
          </a>
        </nav>

        <section className={styles.coverage}>
          <header className={styles.sectionHeader}>
            <h2>Explicit area mentions.</h2>
            <p>{relatedNews.length} source-linked reports</p>
          </header>
          {relatedNews.length ? (
            <div className={styles.reportList}>
              {relatedNews.map((article) => (
                <Link href={`/news/${article.slug}`} key={article.slug}>
                  <span>
                    {displayMarkets(article).join(" / ")} ·{" "}
                    {categoryLabel(article.category)} · {article.displayDate}
                  </span>
                  <strong>{article.title}</strong>
                  <i aria-hidden="true">↗</i>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No live report explicitly names this area yet. Emirate-wide
              stories are not used as substitutes.
            </p>
          )}
        </section>

        <section className={styles.relations}>
          <header className={styles.sectionHeader}>
            <h2>Connected developer records.</h2>
            <p>Registry relationship · not current inventory</p>
          </header>
          {developers.length ? (
            <div className={styles.developerList}>
              {developers.map((developer) => (
                <Link
                  href={`/developer/${developer.slug}`}
                  key={developer.slug}
                >
                  <span>Developer reporting index</span>
                  <strong>{developer.name}</strong>
                  <i aria-hidden="true">↗</i>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>
              No developer profile is connected to this area in the current
              registry.
            </p>
          )}
        </section>

        <section className={styles.advisory}>
          <header className={styles.sectionHeader}>
            <h2>Move from record to decision.</h2>
            <p>Invest With Raj · advisory site</p>
          </header>
          {advisoryLinks.length ? (
            <div className={styles.advisoryLinks}>
              {advisoryLinks.map((link) => (
                <a href={link.href} key={link.href}>
                  <span>{link.eyebrow}</span>
                  <strong>{link.label}</strong>
                  <i aria-hidden="true">↗</i>
                </a>
              ))}
            </div>
          ) : null}
          <div className={styles.cta}>
            <p>
              If this geography is part of a live brief, bring the objective,
              holding period and exit constraint. Raj can test the decision
              without presenting this unfinished index as market evidence.
            </p>
            <a href={generalAdvisoryUrl("area", area.slug)}>
              Discuss this area ↗
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
