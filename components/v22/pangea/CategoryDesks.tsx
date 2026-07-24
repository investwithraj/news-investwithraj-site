// v22 PANGEA revamp — the category desks. Server component: every desk with
// live reporting gets a hairline-topped header row (gold mono label · count ·
// the door to /news) and a horizontal rail of up to four story cards —
// 16:10 cover, mono chip, two-line headline, dated. Desks are ordered by
// depth of coverage (article count, descending). Rails scroll sideways on
// overflow with the scrollbar hidden. CSS-keyframe entrances only — static
// under reduced motion. Real data only: research stubs are filtered out.
import Link from "next/link";
import type { NewsArticle, NewsCategory } from "@/content/news";
import { groupByCategory, sortNewsArticles } from "@/content/news";

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  "market-pulse": "Market Pulse",
  launch: "Launches",
  regulatory: "Regulatory",
  macro: "Macro",
  "developer-corporate": "Developer Desk",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

export default function CategoryDesks({ articles }: { articles: NewsArticle[] }) {
  // Live reporting only — research stubs never reach the desks.
  const live = articles.filter((a) => a.status !== "research");
  const grouped = groupByCategory(live);

  // Desks with at least one live article, deepest coverage first.
  const desks = (Object.keys(grouped) as NewsCategory[])
    .filter((c) => (grouped[c]?.length ?? 0) > 0)
    .sort((a, b) => grouped[b].length - grouped[a].length);

  if (desks.length === 0) return null;

  return (
    <section id="the-desks-report" data-register="dark" className="cdesks" aria-label="The desks">
      <div className="cdesks__inner">
        <p className="cdesks__eyebrow cdesk-rise" style={{ animationDelay: "60ms" }}>
          The desks · reporting by beat
        </p>

        {desks.map((category, i) => {
          const stories = sortNewsArticles(grouped[category]).slice(0, 4);
          const label = CATEGORY_LABEL[category] ?? category;
          return (
            <div
              key={category}
              className="cdesks__desk cdesk-rise"
              style={{ animationDelay: `${140 + i * 90}ms` }}
            >
              <div className="cdesks__head">
                <h2 className="cdesks__label">{label}</h2>
                <span className="cdesks__count">
                  · {grouped[category].length} {grouped[category].length === 1 ? "report" : "reports"}
                </span>
                <Link href="/news" className="cdesks__all">
                  All <span aria-hidden>→</span>
                </Link>
              </div>

              <div className="cdesks__rail" role="list">
                {stories.map((story) => (
                  <Link
                    key={story.slug}
                    href={`/news/${story.slug}`}
                    className="cdesks__card"
                    role="listitem"
                  >
                    <span className="cdesks__cover">
                      {story.heroImage?.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={story.heroImage.src}
                          alt={story.heroImage.alt ?? ""}
                          loading="lazy"
                          className="cdesks__img"
                        />
                      ) : null}
                    </span>
                    <span className="cdesks__chip">{label}</span>
                    <span className="cdesks__headline">{story.title}</span>
                    <span className="cdesks__date">{story.displayDate}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .cdesks { background: #141414; color: #F2EEE7; }
        .cdesks__inner {
          max-width: 1240px; margin: 0 auto;
          padding: 72px clamp(20px, 4vw, 48px) 88px;
        }
        .cdesks__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42); margin: 0 0 42px;
        }
        .cdesks__desk { margin-top: 46px; }
        .cdesks__desk:first-of-type { margin-top: 0; }
        .cdesks__head {
          display: flex; align-items: baseline; gap: 10px;
          border-top: 1px solid rgba(242, 238, 231, 0.12);
          padding-top: 16px; margin-bottom: 20px;
        }
        .cdesks__label {
          margin: 0;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961;
        }
        .cdesks__count {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42);
        }
        .cdesks__all {
          margin-left: auto; text-decoration: none;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.62);
          border-bottom: 1px solid rgba(242, 238, 231, 0.14); padding-bottom: 2px;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .cdesks__all:hover { color: #F2EEE7; border-color: #B2924F; }
        .cdesks__rail {
          display: flex; gap: 18px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding-bottom: 4px;
        }
        .cdesks__rail::-webkit-scrollbar { display: none; }
        .cdesks__card {
          flex: 0 0 clamp(232px, 23vw, 288px);
          display: flex; flex-direction: column;
          text-decoration: none; color: #F2EEE7;
          background: #181818;
          border: 1px solid rgba(242, 238, 231, 0.1);
          border-radius: 10px; overflow: hidden;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .cdesks__card:hover { border-color: rgba(178, 146, 79, 0.55); transform: translateY(-2px); }
        .cdesks__cover {
          display: block; aspect-ratio: 16 / 10;
          background: #1C1C1E; overflow: hidden;
        }
        .cdesks__img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          filter: saturate(0.85) brightness(0.92);
          transition: transform 400ms ease;
        }
        .cdesks__card:hover .cdesks__img { transform: scale(1.03); }
        .cdesks__chip {
          align-self: flex-start; margin: 16px 18px 0;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961;
          border: 1px solid rgba(178, 146, 79, 0.35);
          border-radius: 999px; padding: 4px 10px;
        }
        .cdesks__headline {
          margin: 12px 18px 0;
          font-family: var(--font-raleway), sans-serif;
          font-size: 1rem; font-weight: 300;
          line-height: 1.3; letter-spacing: -0.01em;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cdesks__date {
          margin: 10px 18px 18px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42);
        }
        @keyframes cdeskRise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cdesk-rise { opacity: 0; animation: cdeskRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .cdesk-rise { opacity: 1; animation: none; }
        }
      `}</style>
    </section>
  );
}
