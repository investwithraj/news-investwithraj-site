import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  advisoryLinksForArea,
  generalAdvisoryUrl,
} from "@/lib/advisory-relations";
import { SITE } from "@/lib/constants";
import {
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
  relatedDevelopersForArea,
} from "@/lib/news-editorial";
import {
  getAllPublicAreaSlugs,
  getPublicAreaRecord,
  PUBLIC_DEVELOPERS,
} from "@/lib/public-content";
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
  return getAllPublicAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = getPublicAreaRecord(slug);
  if (!record) return { title: "Area not found" };
  const { area, reports } = record;
  const media = getVerifiedAreaMedia(slug);

  return {
    title: `${area.name} property news and market intelligence`,
    description: `${reports.length} source-linked reports about ${area.name}, ${area.emirate}, with the latest market developments and direct source access.`,
    alternates: { canonical: `${SITE.url}/areas/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title: `${area.name} property intelligence`,
      description: `${reports.length} source-linked reports for ${area.name}, ${area.emirate}.`,
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
  const record = getPublicAreaRecord(slug);
  if (!record) notFound();
  const { area, reports: relatedNews } = record;
  const media = getVerifiedAreaMedia(area.slug);

  const developers = relatedDevelopersForArea(area, PUBLIC_DEVELOPERS);
  const advisoryLinks = advisoryLinksForArea(area);
  const sourceCount = new Set(
    relatedNews.flatMap((article) =>
      article.citations.map((citation) => citation.url),
    ),
  ).size;
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
                Follow the latest source-linked reporting connected to {area.name}.
                Each report separates the observed facts from the decision it may
                affect for buyers and investors.
              </p>
            </div>
            <div className={styles.coordinatePanel}>
              <span>Location</span>
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

        <section className={styles.reviewStrip} aria-label="Area reporting summary">
          <div>
            <span>Published coverage</span>
            <strong>{relatedNews.length} source-linked reports</strong>
          </div>
          <div>
            <span>Latest report</span>
            <strong>{formatEditorialDate(relatedNews[0].publishedAt)}</strong>
          </div>
          <div>
            <span>Sources available</span>
            <p>{sourceCount} direct links across this collection</p>
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
            <h2>Latest {area.name} reporting.</h2>
            <p>{relatedNews.length} source-linked reports</p>
          </header>
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
        </section>

        {developers.length ? <section className={styles.relations}>
          <header className={styles.sectionHeader}>
            <h2>Developers connected to this coverage.</h2>
            <p>Continue through the reporting network</p>
          </header>
          <div className={styles.developerList}>
            {developers.map((developer) => (
              <Link
                href={`/developer/${developer.slug}`}
                key={developer.slug}
              >
                <span>Developer reporting</span>
                <strong>{developer.name}</strong>
                <i aria-hidden="true">↗</i>
              </Link>
            ))}
          </div>
        </section> : null}

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
              against the published evidence and the alternatives available.
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
