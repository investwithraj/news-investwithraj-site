import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AREAS, filterByEmirate, sortAreas } from "@/content/areas";
import { SITE } from "@/lib/constants";
import { formatEditorialDate } from "@/lib/news-editorial";
import {
  asGraph,
  breadcrumbSchema,
  collectionPageSchemas,
} from "@/lib/schema";
import { getVerifiedAreaMedia } from "@/lib/verified-media";

import styles from "./AreaPages.module.css";

export const dynamic = "force-static";

const PAGE_URL = `${SITE.url}/areas`;
const DESCRIPTION =
  "A transparent research index of UAE property areas, showing registry coordinates and linked reporting while source packs are reviewed.";

export const metadata: Metadata = {
  title: "Areas — UAE property research index",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function AreasIndex() {
  const groups = [
    ["Dubai", sortAreas(filterByEmirate(AREAS, "Dubai"))],
    ["Abu Dhabi", sortAreas(filterByEmirate(AREAS, "Abu Dhabi"))],
    [
      "Ras Al Khaimah",
      sortAreas(filterByEmirate(AREAS, "Ras Al Khaimah")),
    ],
  ] as const;
  const latestRegistryDate = [...AREAS]
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0]?.modifiedAt;
  const evidenceReady = AREAS.filter(
    (area) => area.body.trim() && area.citations.length > 0,
  ).length;
  const [collection, itemList] = collectionPageSchemas({
    url: PAGE_URL,
    name: "UAE property area research index",
    description: DESCRIPTION,
    dateModified: latestRegistryDate,
    items: AREAS.map((area) => ({
      name: area.name,
      url: `${SITE.url}/areas/${area.slug}`,
      description: `${area.kind.replaceAll("-", " ")} research index entry in ${area.emirate}.`,
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
            Research atlas · {AREAS.length} coordinate records
          </p>
          <h1>Places, before the pitch.</h1>
          <p className={styles.dek}>
            This directory publishes location identity and coordinates first.
            Price, yield, ownership and supply claims remain hidden until each
            area has a cited evidence pack.
          </p>
          <div className={styles.statusGrid}>
            <div>
              <span>Evidence-ready profiles</span>
              <strong>
                {evidenceReady} of {AREAS.length}
              </strong>
            </div>
            <div>
              <span>Registry last touched</span>
              <strong>
                {latestRegistryDate
                  ? formatEditorialDate(latestRegistryDate)
                  : "Not recorded"}
              </strong>
            </div>
            <div>
              <span>Publication rule</span>
              <strong>No uncited market statistics</strong>
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
                  <span>{items.length} records</span>
                </header>
                <div className={styles.areaGrid}>
                  {items.map((area) => {
                    const media = getVerifiedAreaMedia(area.slug);
                    const areaHref = `/areas/${area.slug}`;

                    return (
                      <article key={area.slug} className={styles.areaCard}>
                        {media ? (
                          <figure className={styles.cardFigure}>
                            <Link
                              href={areaHref}
                              className={styles.cardImageLink}
                              aria-label={`Open ${area.name} research record`}
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
                            <span>Coordinate record</span>
                            <strong>
                              {area.coords.lat.toFixed(4)}° N
                              <br />
                              {area.coords.lng.toFixed(4)}° E
                            </strong>
                            <small>No verified UHD area reference</small>
                          </Link>
                        )}
                        <Link href={areaHref} className={styles.cardBody}>
                          <span className={styles.cardMeta}>
                            <span>{area.kind.replaceAll("-", " ")}</span>
                            <span>{area.emirate}</span>
                          </span>
                          <h3>{area.name}</h3>
                          <small>
                            {media
                              ? "Verified editorial context · market evidence review pending"
                              : "Coordinate-only record · market evidence review pending"}
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
          <span>Method</span>
          <h2>Evidence before market language.</h2>
          <p>
            An area record is not a market report. Until citations and reviewed
            body copy exist, detail pages remain out of search indexes and show
            only the location fields needed to navigate the reporting graph.
          </p>
        </section>
      </main>
    </>
  );
}
