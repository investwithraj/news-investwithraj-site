import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CANONICAL_DEVELOPERS } from "@/content/intelligence/registry";
import { SITE } from "@/lib/constants";
import {
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
  selectDistinctArticles,
} from "@/lib/news-editorial";
import {
  PUBLIC_DEVELOPER_RECORDS,
  PUBLIC_DEVELOPERS,
} from "@/lib/public-content";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";
import { getVerifiedDeveloperMedia } from "@/lib/verified-media";

import styles from "./DeveloperPages.module.css";

export const dynamic = "force-static";

const PAGE_URL = `${SITE.url}/developers`;
const DESCRIPTION =
  "A developer-led index of source-linked UAE property reporting, with transparent entity matching and no unsupported ownership or release claims.";

export const metadata: Metadata = {
  title: "Developers — source-linked reporting index",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function DevelopersIndex() {
  const legacySlug: Record<string, string> = {
    "dubai-holding-real-estate": "dubai-holding",
  };
  const records = CANONICAL_DEVELOPERS.map((entity) => {
    const publicRecord = PUBLIC_DEVELOPER_RECORDS.find(
      ({ developer }) => developer.slug === (legacySlug[entity.slug] ?? entity.slug),
    );
    return {
      entity,
      publicRecord,
      media: publicRecord
        ? getVerifiedDeveloperMedia(publicRecord.developer.slug)
        : undefined,
    };
  });
  const latestReports = selectDistinctArticles(
    PUBLIC_DEVELOPER_RECORDS.flatMap(({ reports }) => reports),
    8,
  );
  const latestReportingDate = latestReports[0]?.publishedAt;
  const [collection, itemList] = collectionPageSchemas({
    url: PAGE_URL,
    name: "UAE developer reporting index",
    description: DESCRIPTION,
    dateModified: latestReports[0]?.modifiedAt,
    items: PUBLIC_DEVELOPERS.map((developer) => ({
      name: developer.name,
      url: `${SITE.url}/developer/${developer.slug}`,
      description: `Developer reporting index for ${developer.name}.`,
    })),
  });
  const graph = asGraph(
    collection,
    itemList,
    breadcrumbSchema([{ name: "Developers", url: PAGE_URL }]),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(graph).replace(/</g, "\\u003c"),
        }}
      />
      <main id="main" className={styles.page}>
        <header className={styles.hero}>
          <Link href="/" className={styles.back}>
            ← Intelligence desk
          </Link>
          <p className={styles.eyebrow}>
            Developer intelligence · {CANONICAL_DEVELOPERS.length} tracked entities
          </p>
          <h1>Reporting by full identity.</h1>
          <p className={styles.dek}>
            Track the developers explicitly named in published UAE property
            reporting, then open the underlying stories and source links.
          </p>
          <div className={styles.statusGrid}>
            <div>
              <span>Tracked developers</span>
              <strong>{CANONICAL_DEVELOPERS.length}</strong>
            </div>
            <div>
              <span>Latest matched report</span>
              <strong>
                {latestReportingDate
                  ? formatEditorialDate(latestReportingDate)
                  : "No report published"}
              </strong>
            </div>
            <div>
              <span>Match method</span>
              <strong>Full identity or approved alias</strong>
            </div>
          </div>
        </header>

        <nav className={styles.doors} aria-label="Developer research paths">
          <Link href="/news">
            <span>01</span>
            <strong>News</strong>
            <p>Read the full chronological reporting archive.</p>
            <i>Open archive ↗</i>
          </Link>
          <Link href="/areas">
            <span>02</span>
            <strong>Areas</strong>
            <p>Move from each entity to the markets connected to its coverage.</p>
            <i>Open atlas ↗</i>
          </Link>
          <Link href="/map">
            <span>03</span>
            <strong>Map</strong>
            <p>Read the spatial layer behind the reporting graph.</p>
            <i>Open map ↗</i>
          </Link>
        </nav>

        <section className={styles.directory}>
          <header className={styles.sectionHeader}>
            <h2>The UAE developer index.</h2>
            <p>{PUBLIC_DEVELOPERS.length} have live reporting desks</p>
          </header>
          <div className={styles.developerGrid}>
            {records.map(({ entity, publicRecord, media }) => {
              const reports = publicRecord?.reports ?? [];
              const developerHref = publicRecord
                ? `/developer/${publicRecord.developer.slug}`
                : entity.officialUrl;

              return (
                <article
                  key={entity.slug}
                  className={styles.developerCard}
                >
                  {media ? (
                    <figure className={styles.cardFigure}>
                      <Link
                        href={developerHref}
                        className={styles.cardImageLink}
                        aria-label={`Open ${entity.name} reporting index`}
                      >
                        <Image
                          src={media.src}
                          width={media.width}
                          height={media.height}
                          alt={media.alt}
                          sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 33vw"
                          quality={90}
                        />
                      </Link>
                      <figcaption className={styles.mediaCredit}>
                        <span>{media.notice}</span>
                        <span>
                          <a
                            href={media.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {media.sourceLabel}
                          </a>
                          {" · "}
                          {media.licenseLabel}
                        </span>
                      </figcaption>
                    </figure>
                  ) : (
                    <a
                      href={developerHref}
                      className={styles.identityTile}
                      {...(!publicRecord
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      <span>{publicRecord ? "Developer intelligence" : `Tier ${entity.tier} watchlist`}</span>
                      <strong>{entity.name}</strong>
                      <small>{publicRecord ? `${reports.length} published reports` : "Open developer website"}</small>
                    </a>
                  )}
                  <a
                    href={developerHref}
                    className={styles.cardBody}
                    {...(!publicRecord
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    <span className={styles.cardMeta}>
                      <span>{entity.markets.slice(0, 2).join(" / ")}</span>
                      <span>{publicRecord ? `${reports.length} reports` : "Tracked"}</span>
                    </span>
                    <h3>{entity.name}</h3>
                    <small>
                      {reports[0]
                        ? `Latest report: ${reports[0].displayDate}`
                        : "Coverage desk opens after a substantive report is published."}
                    </small>
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.latest}>
          <header className={styles.sectionHeader}>
            <h2>Latest developer reporting.</h2>
            <p>Near-identical event reports shown once</p>
          </header>
          <div className={styles.reportList}>
            {latestReports.map((article) => {
              const names = PUBLIC_DEVELOPER_RECORDS.filter(({ reports }) =>
                reports.some((report) => report.slug === article.slug),
              ).map(({ developer }) => developer.name);
              return (
                <Link href={`/news/${article.slug}`} key={article.slug}>
                  <span>
                    {names.join(" / ")} · {displayMarkets(article).join(" / ")}
                    {" · "}
                    {categoryLabel(article.category)} · {article.displayDate}
                  </span>
                  <strong>{article.title}</strong>
                  <i aria-hidden="true">↗</i>
                </Link>
              );
            })}
          </div>
        </section>

        <section className={styles.method}>
          <span>Source method</span>
          <h2>No partial-name shortcuts.</h2>
          <p>
            Developer relations require the full identity or a curated alias.
            “Dubai” cannot match Dubai Holding, and an emirate-wide report
            cannot stand in for a developer mention. Every item in this
            directory therefore leads to substantive published coverage.
          </p>
        </section>
      </main>
    </>
  );
}
