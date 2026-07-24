// /news — the full index of the reporting. v22 PANGEA: every live article,
// grouped by desk (category), rendered as dense hairline rows — date · title
// · one-line subtitle — in the locked register (dark #141414 ground ·
// warm-white ink · real gold, sparing). Research stubs never list. Server
// component, self-contained scoped styles, real data only.

import type { Metadata } from "next";
import Link from "next/link";
import { NEWS_ARTICLES, sortNewsArticles, groupByCategory } from "@/content/news";
import type { NewsCategory } from "@/content/news";
import { SITE } from "@/lib/constants";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "News — Daily UAE real-estate intelligence",
  description:
    "Every news.investwithraj.com article — 5–15 verified-source pieces a day on Dubai, Abu Dhabi, and Ras Al Khaimah real estate. Curated by Raj Tomar, real-estate consultant.",
  alternates: {
    canonical: `${SITE.url}/news`,
    types: { "application/rss+xml": `${SITE.url}/rss.xml` },
  },
};

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  "market-pulse": "Market Pulse",
  launch: "Launches",
  regulatory: "Regulatory",
  macro: "Macro",
  "developer-corporate": "Developer Desk",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

export default function NewsIndex() {
  // Live reporting only — research stubs never reach the index.
  const live = sortNewsArticles(NEWS_ARTICLES).filter((a) => a.status !== "research");
  const grouped = groupByCategory(live);

  // Desks with at least one live article, deepest coverage first — the same
  // ordering the front page's CategoryDesks uses.
  const desks = (Object.keys(grouped) as NewsCategory[])
    .filter((c) => (grouped[c]?.length ?? 0) > 0)
    .sort((a, b) => grouped[b].length - grouped[a].length);

  return (
    <main id="news-index" data-register="dark" className="nidx">
      <div className="nidx__inner">
        {/* Header */}
        <header className="nidx__head">
          <Link href="/" className="nidx__back">
            <span aria-hidden>←</span> Front page
          </Link>

          <p className="nidx__eyebrow">
            The reporting · {live.length} {live.length === 1 ? "report" : "reports"} ·{" "}
            {desks.length} {desks.length === 1 ? "desk" : "desks"}
          </p>
          <h1 className="nidx__title">
            Every piece, <em className="nidx__it">cited.</em>
          </h1>
          <p className="nidx__dek">
            Verified-source reporting on UAE real estate — Dubai, Abu Dhabi and Ras Al
            Khaimah. Every piece cites DLD / RERA / Knight Frank / JLL / Khaleej Times /
            Arabian Business. Written for serious investors.
          </p>
        </header>

        {live.length === 0 ? (
          <div className="nidx__empty">
            <span className="nidx__empty-tag">Status</span>
            <p className="nidx__empty-line">
              First articles drop with the 07:00 GST morning cron.
            </p>
          </div>
        ) : (
          desks.map((category) => {
            const stories = sortNewsArticles(grouped[category]);
            return (
              <section
                key={category}
                id={`desk-${category}`}
                className="nidx__desk"
                aria-label={CATEGORY_LABEL[category] ?? category}
              >
                <div className="nidx__desk-head">
                  <h2 className="nidx__desk-label">{CATEGORY_LABEL[category] ?? category}</h2>
                  <span className="nidx__desk-count">
                    · {stories.length} {stories.length === 1 ? "report" : "reports"}
                  </span>
                </div>

                <ol className="nidx__rows">
                  {stories.map((a) => (
                    <li key={a.slug} className="nidx__row">
                      <Link href={`/news/${a.slug}`} className="nidx__row-link">
                        <time className="nidx__row-date" dateTime={a.publishedAt}>
                          {a.displayDate}
                        </time>
                        <span className="nidx__row-body">
                          <span className="nidx__row-title">{a.title}</span>
                          <span className="nidx__row-sub">{a.subtitle}</span>
                        </span>
                        <span className="nidx__row-arrow" aria-hidden>
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        )}
      </div>

      <style>{`
        .nidx { min-height: 100svh; background: #141414; color: #F2EEE7; }
        .nidx__inner {
          max-width: 1080px; margin: 0 auto;
          padding: 128px clamp(20px, 4vw, 48px) 112px;
        }

        /* Header */
        .nidx__head { margin-bottom: 64px; }
        .nidx__back {
          display: inline-flex; align-items: baseline; gap: 8px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.62); text-decoration: none;
          margin-bottom: 34px;
          border-bottom: 1px solid rgba(242, 238, 231, 0.14); padding-bottom: 2px;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .nidx__back:hover { color: #F2EEE7; border-color: #B2924F; }
        .nidx__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: #C9A961; margin: 0 0 14px;
        }
        .nidx__title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(2.25rem, 5vw, 4rem); font-weight: 500;
          line-height: 1.02; letter-spacing: -0.02em; margin: 0; color: #F2EEE7;
        }
        .nidx__it {
          font-family: var(--font-fraunces), serif; font-style: italic;
          font-weight: 400; color: #C9A961;
        }
        .nidx__dek {
          margin: 22px 0 0; max-width: 60ch;
          font-family: var(--font-inter), sans-serif;
          font-size: 1rem; line-height: 1.65;
          color: rgba(242, 238, 231, 0.62);
        }

        /* Empty state */
        .nidx__empty {
          border: 1px solid rgba(242, 238, 231, 0.14); border-radius: 10px;
          padding: 56px clamp(24px, 4vw, 56px); text-align: center;
          background: #181818;
        }
        .nidx__empty-tag {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #C9A961;
        }
        .nidx__empty-line {
          margin: 16px auto 0; max-width: 40ch;
          color: rgba(242, 238, 231, 0.62); font-size: 1.05rem; line-height: 1.6;
        }

        /* Desk groups */
        .nidx__desk { margin-top: 56px; }
        .nidx__desk:first-of-type { margin-top: 0; }
        .nidx__desk-head {
          display: flex; align-items: baseline; gap: 10px;
          border-top: 1px solid rgba(242, 238, 231, 0.14);
          padding-top: 16px; margin-bottom: 6px;
        }
        .nidx__desk-label {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961; margin: 0;
        }
        .nidx__desk-count {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42);
        }

        /* Hairline rows */
        .nidx__rows { list-style: none; margin: 0; padding: 0; }
        .nidx__row { border-bottom: 1px solid rgba(242, 238, 231, 0.1); }
        .nidx__row:last-child { border-bottom: none; }
        .nidx__row-link {
          display: grid; grid-template-columns: 118px 1fr 20px;
          gap: 18px; align-items: baseline;
          padding: 15px 0; text-decoration: none;
        }
        .nidx__row-date {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42);
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .nidx__row-body { min-width: 0; }
        .nidx__row-title {
          display: block;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.05rem; font-weight: 500;
          line-height: 1.3; letter-spacing: -0.01em; color: #F2EEE7;
          transition: color 180ms ease;
        }
        .nidx__row-link:hover .nidx__row-title { color: #C9A961; }
        .nidx__row-sub {
          display: block; margin-top: 4px;
          font-family: var(--font-inter), sans-serif;
          font-size: 0.85rem; line-height: 1.5;
          color: rgba(242, 238, 231, 0.62);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nidx__row-arrow {
          color: rgba(242, 238, 231, 0.42);
          transition: color 180ms ease, transform 180ms ease;
        }
        .nidx__row-link:hover .nidx__row-arrow { color: #C9A961; transform: translateX(3px); }

        @media (max-width: 700px) {
          .nidx__inner { padding-top: 108px; }
          .nidx__row-link { grid-template-columns: 1fr 16px; gap: 12px; }
          .nidx__row-date { grid-column: 1 / -1; margin-bottom: 2px; }
          .nidx__row-sub { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nidx__back, .nidx__row-title, .nidx__row-arrow { transition: none; }
        }
      `}</style>
    </main>
  );
}
