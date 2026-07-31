"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo } from "react";

import styles from "./NewsArchive.module.css";

export type NewsArchiveItem = {
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  displayDate: string;
  category: string;
  categoryLabel: string;
  markets: string[];
  evidenceLabel: string;
  evidenceLimited: boolean;
};

const PAGE_SIZE = 12;

export default function NewsArchive({
  items,
}: {
  items: NewsArchiveItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category") ?? "all";
  const market = searchParams.get("market") ?? "all";
  const requestedPage = Number(searchParams.get("page") ?? "1");

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
  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !needle ||
        `${item.title} ${item.subtitle} ${item.markets.join(" ")} ${item.categoryLabel}`
          .toLowerCase()
          .includes(needle);
      const matchesCategory =
        category === "all" || item.category === category;
      const matchesMarket =
        market === "all" || item.markets.includes(market);
      return matchesQuery && matchesCategory && matchesMarket;
    });
  }, [category, items, market, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.floor(requestedPage)), pageCount)
    : 1;
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const rangeStart =
    filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function replaceParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
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
        <p className={styles.eyebrow}>The reporting · chronological archive</p>
        <h1>
          Every report,
          <br />
          in order.
        </h1>
        <p className={styles.dek}>
          Search and filter the live archive. Every row shows its market,
          desk, publication date and current evidence cue.
        </p>
        <div className={styles.policyLinks}>
          <a href="/rss.xml">RSS feed ↗</a>
          <Link href="/about/editorial-standards">
            Editorial standards ↗
          </Link>
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
              {markets.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Desk</span>
            <select
              value={category}
              onChange={(event) =>
                replaceParams({ category: event.target.value, page: null })
              }
            >
              <option value="all">All desks</option>
              {categories.map(([value, label]) => (
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
                <Link href={`/news/${item.slug}`}>
                  <span className={styles.index}>
                    {String(rangeStart + index).padStart(2, "0")}
                  </span>
                  <span className={styles.rowCopy}>
                    <span className={styles.rowMeta}>
                      <span>{item.markets.join(" / ")}</span>
                      <span>{item.categoryLabel}</span>
                      <time dateTime={item.publishedAt}>
                        {item.displayDate}
                      </time>
                    </span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                    <span
                      className={`${styles.evidence} ${
                        item.evidenceLimited ? styles.evidenceLimited : ""
                      }`}
                    >
                      Evidence · {item.evidenceLabel}
                    </span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            <strong>No reports match those filters.</strong>
            <button
              type="button"
              onClick={() =>
                router.replace(pathname, {
                  scroll: false,
                })
              }
            >
              Clear filters
            </button>
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
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
