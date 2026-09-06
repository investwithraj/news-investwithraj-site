"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo } from "react";

import {
  archivePageNumber,
  filterNewsArchiveItems,
  NEWS_ARCHIVE_FILTER_KEYS,
  NEWS_ARCHIVE_PAGE_SIZE,
  normaliseArchiveChoice,
  type NewsArchiveDesk,
  type NewsArchiveFreshness,
  type NewsArchiveItem,
} from "@/lib/news-archive";

import styles from "./NewsArchive.module.css";

type ArchiveQueryKey = (typeof NEWS_ARCHIVE_FILTER_KEYS)[number];

export type NewsArchiveInitialParams = Partial<
  Record<ArchiveQueryKey, string>
>;

function freshnessCopy(freshness: NewsArchiveFreshness): string {
  if (freshness.state === "empty" || freshness.ageHours === null) {
    return "No published reports are currently in the archive.";
  }
  if (freshness.ageHours <= 1) {
    return "Latest report published within the last hour.";
  }
  if (freshness.state === "fresh") {
    return `Latest report published ${freshness.ageHours} hours ago.`;
  }

  const days = Math.max(2, Math.round(freshness.ageHours / 24));
  return `Latest report published about ${days} days ago.`;
}

function freshnessHeading(freshness: NewsArchiveFreshness): string {
  if (freshness.state === "fresh") return "Current reporting";
  if (freshness.state === "stale") return "Archive mode";
  return "Archive empty";
}

export default function NewsArchive({
  items,
  desks,
  freshness,
  initialParams = {},
}: {
  items: NewsArchiveItem[];
  desks: NewsArchiveDesk[];
  freshness: NewsArchiveFreshness;
  initialParams?: NewsArchiveInitialParams;
}) {
  const router = useRouter();
  const pathname = "/news";
  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of NEWS_ARCHIVE_FILTER_KEYS) {
      const value = initialParams[key]?.trim();
      if (value) params.set(key, value);
    }
    return params;
  }, [initialParams]);

  const categories = useMemo(
    () =>
      [...new Map(items.map((item) => [item.category, item.categoryLabel]))]
        .sort((a, b) => a[1].localeCompare(b[1])),
    [items],
  );
  const markets = useMemo(
    () =>
      [...new Set(items.flatMap((item) => item.markets))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );
  const areas = useMemo(
    () =>
      [
        ...new Map(
          items.flatMap((item) =>
            item.areas.map((area) => [area.slug, area.name] as const),
          ),
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [items],
  );
  const developers = useMemo(
    () =>
      [
        ...new Map(
          items.flatMap((item) =>
            item.developers.map(
              (developer) => [developer.slug, developer.name] as const,
            ),
          ),
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [items],
  );

  const query = searchParams.get("q")?.trim() ?? "";
  const category = normaliseArchiveChoice(
    searchParams.get("category"),
    categories.map(([value]) => value),
  );
  const market = normaliseArchiveChoice(searchParams.get("market"), markets);
  const desk = normaliseArchiveChoice(
    searchParams.get("desk"),
    desks.map((item) => item.slug),
  );
  const area = normaliseArchiveChoice(
    searchParams.get("area"),
    areas.map(([slug]) => slug),
  );
  const developer = normaliseArchiveChoice(
    searchParams.get("developer"),
    developers.map(([slug]) => slug),
  );
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const selectedDesk = desks.find((item) => item.slug === desk) ?? null;
  const unsupportedCategory =
    category !== "all" && !categories.some(([value]) => value === category);
  const unsupportedMarket = market !== "all" && !markets.includes(market);
  const unsupportedDesk =
    desk !== "all" && !desks.some((item) => item.slug === desk);
  const unsupportedArea =
    area !== "all" && !areas.some(([slug]) => slug === area);
  const unsupportedDeveloper =
    developer !== "all" &&
    !developers.some(([slug]) => slug === developer);

  const filtered = useMemo(
    () =>
      filterNewsArchiveItems(items, {
        query,
        category,
        market,
        desk,
        area,
        developer,
      }),
    [area, category, desk, developer, items, market, query],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / NEWS_ARCHIVE_PAGE_SIZE),
  );
  const currentPage = archivePageNumber(requestedPage, filtered.length);
  const pageItems = filtered.slice(
    (currentPage - 1) * NEWS_ARCHIVE_PAGE_SIZE,
    currentPage * NEWS_ARCHIVE_PAGE_SIZE,
  );
  const rangeStart =
    filtered.length === 0
      ? 0
      : (currentPage - 1) * NEWS_ARCHIVE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    currentPage * NEWS_ARCHIVE_PAGE_SIZE,
    filtered.length,
  );

  function replaceParams(
    updates: Partial<Record<ArchiveQueryKey, string | null>>,
  ) {
    const params = new URLSearchParams();

    for (const key of NEWS_ARCHIVE_FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || (key === "page" && value === "1")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    replaceParams({
      q: String(data.get("q") ?? "").trim() || null,
      page: null,
    });
  }

  return (
    <main id="main" className={styles.page}>
      <header className={styles.hero}>
        <Link href="/" className={styles.back}>
          ← Front page
        </Link>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>The reporting · structured archive</p>
            <h1>
              Every <br className={styles.mobileBreak} />report,
              <br />
              in order.
            </h1>
            <p className={styles.dek}>
              Browse source-linked UAE and Gulf property reporting by market,
              report type, related area or developer, or one of five
              editorial desks.
            </p>
            <div className={styles.policyLinks}>
              <a href="/rss.xml">RSS feed ↗</a>
              <Link href="/about/editorial-standards">
                Editorial standards ↗
              </Link>
            </div>
          </div>
          <aside
            className={styles.freshness}
            data-state={freshness.state}
            aria-label="Publication freshness"
          >
            <span className={styles.freshnessDot} aria-hidden="true" />
            <div>
              <span>Publication freshness</span>
              <strong>{freshnessHeading(freshness)}</strong>
              <small>{freshnessCopy(freshness)}</small>
              <small>
                Current means published within {freshness.thresholdHours}
                hours.
              </small>
            </div>
          </aside>
        </div>
      </header>

      <section className={styles.archive} aria-labelledby="archive-title">
        <div className={styles.archiveHead}>
          <div>
            <p>Archive controls</p>
            <h2 id="archive-title">Find a report.</h2>
          </div>
          <p aria-live="polite">
            Showing {rangeStart}–{rangeEnd} of {filtered.length}
          </p>
        </div>

        <div className={styles.deskPanel}>
          <p>Editorial desks</p>
          <div className={styles.deskChoices} role="group" aria-label="Desk">
            <button
              type="button"
              aria-pressed={desk === "all"}
              onClick={() => replaceParams({ desk: null, page: null })}
            >
              All reporting
            </button>
            {unsupportedDesk ? (
              <button type="button" aria-pressed disabled>
                Unavailable desk · {desk}
              </button>
            ) : null}
            {desks.map((item) => (
              <button
                type="button"
                key={item.slug}
                aria-pressed={desk === item.slug}
                onClick={() =>
                  replaceParams({ desk: item.slug, page: null })
                }
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className={styles.deskDescription}>
            {selectedDesk?.description ??
              "All published reports, ordered from newest to oldest."}
          </p>
        </div>

        <form className={styles.controls} role="search" onSubmit={submitSearch}>
          <label className={styles.search}>
            <span>Search reports</span>
            <input
              key={query}
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Title, market or topic"
            />
          </label>
          <label>
            <span>Market</span>
            <select
              value={market}
              onChange={(event) =>
                replaceParams({ market: event.target.value, page: null })
              }
            >
              <option value="all">All markets</option>
              {unsupportedMarket ? (
                <option value={market}>Unavailable market · {market}</option>
              ) : null}
              {markets.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Report type</span>
            <select
              value={category}
              onChange={(event) =>
                replaceParams({ category: event.target.value, page: null })
              }
            >
              <option value="all">All report types</option>
              {unsupportedCategory ? (
                <option value={category}>
                  Unavailable report type · {category}
                </option>
              ) : null}
              {categories.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Area</span>
            <select
              value={area}
              onChange={(event) =>
                replaceParams({ area: event.target.value, page: null })
              }
            >
              <option value="all">All related areas</option>
              {unsupportedArea ? (
                <option value={area}>Unavailable area · {area}</option>
              ) : null}
              {areas.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Developer</span>
            <select
              value={developer}
              onChange={(event) =>
                replaceParams({ developer: event.target.value, page: null })
              }
            >
              <option value="all">All related developers</option>
              {unsupportedDeveloper ? (
                <option value={developer}>
                  Unavailable developer · {developer}
                </option>
              ) : null}
              {developers.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply search</button>
        </form>

        {pageItems.length ? (
          <ol className={styles.rows} start={rangeStart}>
            {pageItems.map((item, index) => (
              <li key={item.slug}>
                <article className={styles.row}>
                  <span className={styles.index}>
                    {String(rangeStart + index).padStart(2, "0")}
                  </span>
                  <Link
                    className={styles.rowMedia}
                    href={`/news/${item.slug}`}
                    aria-label={`Read ${item.title}`}
                  >
                    {item.media ? (
                      <>
                        <Image
                          src={item.media.src}
                          alt={item.media.alt}
                          fill
                          sizes="(max-width: 700px) 100vw, 18rem"
                        />
                        <span className={styles.imageContext}>
                          {item.media.label} · {item.media.credit}
                        </span>
                      </>
                    ) : (
                      <span className={styles.mediaFallback}>
                        <span>Source-linked report</span>
                        <strong>{item.markets.join(" / ")}</strong>
                        <small>
                          {item.categoryLabel} · {item.displayDate}
                        </small>
                      </span>
                    )}
                  </Link>
                  <div className={styles.rowCopy}>
                    <div className={styles.rowMeta}>
                      <span>{item.markets.join(" / ")}</span>
                      <span>{item.categoryLabel}</span>
                      <time dateTime={item.publishedAt}>
                        {item.displayDate}
                      </time>
                    </div>
                    {item.desks.length ? (
                      <p className={styles.rowDesks}>
                        {item.desks.map((item) => item.name).join(" · ")}
                      </p>
                    ) : null}
                    {item.areas.length || item.developers.length ? (
                      <p className={styles.rowRelations}>
                        {item.areas.length
                          ? `Area · ${item.areas
                              .map((area) => area.name)
                              .join(" / ")}`
                          : null}
                        {item.areas.length && item.developers.length
                          ? " · "
                          : null}
                        {item.developers.length
                          ? `Developer · ${item.developers
                              .map((developer) => developer.name)
                              .join(" / ")}`
                          : null}
                      </p>
                    ) : null}
                    <Link
                      className={styles.titleLink}
                      href={`/news/${item.slug}`}
                    >
                      <h3>{item.title}</h3>
                    </Link>
                    <p className={styles.subtitle}>{item.subtitle}</p>
                    <span
                      className={`${styles.evidence} ${
                        item.evidenceLimited ? styles.evidenceLimited : ""
                      }`}
                    >
                      Evidence · {item.evidenceLabel}
                    </span>
                    <div className={styles.rowLinks}>
                      <Link href={`/news/${item.slug}`}>Read report ↗</Link>
                      {item.advisoryLinks.map((link) => (
                        <a
                          href={link.href}
                          key={link.href}
                          data-cta-level="3"
                          data-cta-action="editorial"
                          data-cta-source="news-archive"
                        >
                          <span>{link.eyebrow}</span>
                          {link.label} ↗
                        </a>
                      ))}
                      <a
                        href={item.decisionCta.href}
                        data-cta-level="1"
                        data-cta-action="book-call"
                        data-cta-source="news-archive"
                      >
                        {item.decisionCta.label} ↗
                      </a>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            <strong>No reports match those filters.</strong>
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              Clear filters
            </button>
          </div>
        )}

        {filtered.length > NEWS_ARCHIVE_PAGE_SIZE ? (
          <nav className={styles.pagination} aria-label="Archive pages">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                replaceParams({ page: String(currentPage - 1) })
              }
            >
              ← Newer
            </button>
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() =>
                replaceParams({ page: String(currentPage + 1) })
              }
            >
              Older →
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
