import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import { SITE } from "@/lib/constants";
import { DEVELOPERS } from "@/lib/developers";
import {
  articleMentionsDeveloper,
  categoryLabel,
  displayMarkets,
  formatEditorialDate,
  selectDistinctArticles,
} from "@/lib/news-editorial";
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
  const live = sortNewsArticles(NEWS_ARTICLES).filter(
    (article) => article.status !== "research",
  );
  const records = DEVELOPERS.map((developer) => {
    const reports = live.filter((article) =>
      articleMentionsDeveloper(article, developer),
    );
    return {
      developer,
      reports,
      media: getVerifiedDeveloperMedia(developer.slug),
    };
  });
  const reportingRecords = records.filter(({ reports }) => reports.length > 0);
  const latestReports = selectDistinctArticles(
    live.filter((article) =>
      DEVELOPERS.some((developer) =>
        articleMentionsDeveloper(article, developer),
      ),
    ),
    8,
  );
  const latestReportingDate = latestReports[0]?.publishedAt;
  const [collection, itemList] = collectionPageSchemas({
    url: PAGE_URL,
    name: "UAE developer reporting index",
    description: DESCRIPTION,
    dateModified: latestReports[0]?.modifiedAt,
    items: DEVELOPERS.map((developer) => ({
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
            Developer desk · {DEVELOPERS.length} entity records
          </p>
          <h1>Reporting by full identity.</h1>
          <p className={styles.dek}>
            This directory organises source-linked reporting by developer. It
            does not publish uncited ownership, delivery, financial or
            current-release claims from the profile registry.
          </p>
          <div className={styles.statusGrid}>
            <div>
              <span>Entities with live reporting</span>
              <strong>
                {reportingRecords.length} of {DEVELOPERS.length}
              </strong>
            </div>
            <div>
              <span>Latest matched report</span>
              <strong>
                {latestReportingDate
                  ? formatEditorialDate(latestReportingDate)
                  : "No matched report"}
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
            <p>Move from the entity to its internal coverage geography.</p>
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
            <h2>Entity records.</h2>
            <p>Identity fields · evidence state visible</p>
          </header>
          <div className={styles.developerGrid}>
            {records.map(({ developer, reports, media }) => {
              const developerHref = `/developer/${developer.slug}`;

              return (
                <article
                  key={developer.slug}
                  className={styles.developerCard}
                >
                  {media ? (
                    <figure className={styles.cardFigure}>
                      <Link
                        href={developerHref}
                        className={styles.cardImageLink}
                        aria-label={`Open ${developer.name} reporting index`}
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
                    <Link
                      href={developerHref}
                      className={styles.identityTile}
                    >
                      <span>Entity record</span>
                      <strong>{developer.name}</strong>
                      <small>No verified UHD developer reference</small>
                    </Link>
                  )}
                  <Link
                    href={developerHref}
                    className={styles.cardBody}
                  >
                    <span className={styles.cardMeta}>
                      <span>{developer.hq}</span>
                      <span>{reports.length} reports</span>
                    </span>
                    <h3>{developer.name}</h3>
                    <small>
                      {reports[0]
                        ? `Latest explicit mention: ${reports[0].displayDate}`
                        : "No live report explicitly matches this identity yet"}
                      . Profile-source review remains pending.
                    </small>
                  </Link>
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
              const names = DEVELOPERS.filter((developer) =>
                articleMentionsDeveloper(article, developer),
              ).map((developer) => developer.name);
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
            cannot stand in for a developer mention. Profile facts stay
            unpublished until they have their own evidence pack.
          </p>
        </section>
      </main>
    </>
  );
}
