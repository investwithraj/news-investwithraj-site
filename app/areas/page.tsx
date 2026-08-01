import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { filterByEmirate, sortAreas } from "@/content/areas";
import { SITE } from "@/lib/constants";
import { formatEditorialDate } from "@/lib/news-editorial";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";
import { getVerifiedAreaMedia } from "@/lib/verified-media";
import {
  PUBLIC_AREAS,
  PUBLIC_AREA_RECORDS,
} from "@/lib/public-content";

import styles from "./AreaPages.module.css";

export const dynamic = "force-static";

const PAGE_URL = `${SITE.url}/areas`;
const DESCRIPTION =
  "Source-linked UAE property reporting organised by area across Dubai, Abu Dhabi and Ras Al Khaimah.";

export const metadata: Metadata = {
  title: "UAE property intelligence by area",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function AreasIndex() {
  const groups = [
    ["Dubai", sortAreas(filterByEmirate(PUBLIC_AREAS, "Dubai"))],
    ["Abu Dhabi", sortAreas(filterByEmirate(PUBLIC_AREAS, "Abu Dhabi"))],
    [
      "Ras Al Khaimah",
      sortAreas(filterByEmirate(PUBLIC_AREAS, "Ras Al Khaimah")),
    ],
  ] as const;
  const totalReports = new Set(
    PUBLIC_AREA_RECORDS.flatMap(({ reports }) =>
      reports.map((article) => article.slug),
    ),
  ).size;
  const latestReportingDate = PUBLIC_AREA_RECORDS.flatMap(({ reports }) =>
    reports.map((article) => article.modifiedAt),
  ).sort((a, b) => b.localeCompare(a))[0];
  const [collection, itemList] = collectionPageSchemas({
    url: PAGE_URL,
    name: "UAE property intelligence by area",
    description: DESCRIPTION,
    dateModified: latestReportingDate,
    items: PUBLIC_AREAS.map((area) => ({
      name: area.name,
      url: `${SITE.url}/areas/${area.slug}`,
      description: `Published property reporting for ${area.name}, ${area.emirate}.`,
    })),
  });
  const graph = asGraph(
    collection,
    itemList,
    breadcrumbSchema([{ name: "Areas", url: PAGE_URL }]),
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
            Area intelligence · {PUBLIC_AREAS.length} covered markets
          </p>
          <h1>Read the market, place by place.</h1>
          <p className={styles.dek}>
            Move through source-linked reporting for the UAE locations that are
            shaping current buyer and investor decisions.
          </p>
          <div className={styles.statusGrid}>
            <div>
              <span>Covered areas</span>
              <strong>{PUBLIC_AREAS.length}</strong>
            </div>
            <div>
              <span>Published reports</span>
              <strong>{totalReports}</strong>
            </div>
            <div>
              <span>Latest update</span>
              <strong>
                {latestReportingDate
                  ? formatEditorialDate(latestReportingDate)
                  : "Not recorded"}
              </strong>
            </div>
          </div>
        </header>

        <nav className={styles.doors} aria-label="Area research paths">
          <Link href="/map">
            <span>01</span>
            <strong>Map</strong>
            <p>Read the coordinate layer before opening an area record.</p>
            <i>Open map ↗</i>
          </Link>
          <Link href="/developers">
            <span>02</span>
            <strong>Developers</strong>
            <p>Move from geography to developer-linked reporting.</p>
            <i>Open directory ↗</i>
          </Link>
          <Link href="/news">
            <span>03</span>
            <strong>News</strong>
            <p>Read the full chronological, source-linked reporting archive.</p>
            <i>Open archive ↗</i>
          </Link>
        </nav>

        <div className={styles.directory}>
          {groups.map(([emirate, items]) => {
            const headingId = `areas-${emirate
              .toLowerCase()
              .replaceAll(" ", "-")}`;
            return (
              <section key={emirate} aria-labelledby={headingId}>
                <header className={styles.groupHeader}>
                  <h2 id={headingId}>{emirate}</h2>
                  <span>{items.length} covered areas</span>
                </header>
                <div className={styles.areaGrid}>
                  {items.map((area) => {
                    const media = getVerifiedAreaMedia(area.slug);
                    const areaHref = `/areas/${area.slug}`;
                    const reports = PUBLIC_AREA_RECORDS.find(
                      (record) => record.area.slug === area.slug,
                    )!.reports;

                    return (
                      <article key={area.slug} className={styles.areaCard}>
                        {media ? (
                          <figure className={styles.cardFigure}>
                            <Link
                              href={areaHref}
                              className={styles.cardImageLink}
                              aria-label={`Open ${area.name} property intelligence`}
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
                        ) : (
                          <Link
                            href={areaHref}
                            className={styles.coordinateTile}
                          >
                            <span>Area intelligence</span>
                            <strong>
                              {area.coords.lat.toFixed(4)}° N
                              <br />
                              {area.coords.lng.toFixed(4)}° E
                            </strong>
                            <small>{reports.length} published reports</small>
                          </Link>
                        )}
                        <Link href={areaHref} className={styles.cardBody}>
                          <span className={styles.cardMeta}>
                            <span>{area.kind.replaceAll("-", " ")}</span>
                            <span>{area.emirate}</span>
                          </span>
                          <h3>{area.name}</h3>
                          <small>
                            {reports.length} source-linked {reports.length === 1 ? "report" : "reports"}
                            {reports[0] ? ` · Latest ${reports[0].displayDate}` : ""}
                          </small>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <section className={styles.method}>
          <span>Editorial method</span>
          <h2>Only covered places enter this directory.</h2>
          <p>
            Every linked area has at least one published report that names it
            explicitly. Each story keeps its source links visible so the
            underlying evidence can be checked directly.
          </p>
        </section>
      </main>
    </>
  );
}
