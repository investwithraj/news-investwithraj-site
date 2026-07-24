// v22 PANGEA revamp — the newspaper front-page lead package. Server
// component: a masthead strip (desk eyebrow · edition line derived from the
// newest article's displayDate, rendered server-side — never client Date),
// then a three-zone broadsheet grid: the lead story at 60% with its full
// cover, stories two and three stacked on the right rail, and a headline-only
// index of stories four to eight beneath them. Real data only — the package
// takes pre-sorted, pre-filtered articles and slices internally. CSS-keyframe
// entrances only — static under reduced motion.
import Link from "next/link";
import type { NewsArticle } from "@/content/news";

const CATEGORY_LABEL: Record<string, string> = {
  "market-pulse": "Market Pulse",
  launch: "Launches",
  regulatory: "Regulatory",
  macro: "Macro",
  "developer-corporate": "Developer Desk",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

export default function FrontPageLead({ articles }: { articles: NewsArticle[] }) {
  const lead = articles[0];
  if (!lead) return null;

  const rail = articles.slice(1, 3);
  const index = articles.slice(3, 8);

  return (
    <section id="front-lead" data-register="dark" className="fpl" aria-label="Front page">
      <div className="fpl__inner">
        {/* Masthead strip — desk name and the edition line */}
        <header className="fpl__masthead fpl-rise" style={{ animationDelay: "40ms" }}>
          <p className="fpl__desk">The Intel Desk · Dubai · Abu Dhabi · RAK</p>
          <p className="fpl__edition">Latest print · {lead.displayDate}</p>
        </header>

        <div className="fpl__grid">
          {/* Zone one — the lead story */}
          <Link
            href={`/news/${lead.slug}`}
            className="fpl__lead fpl-rise"
            style={{ animationDelay: "120ms" }}
          >
            {lead.heroImage?.src ? (
              <span className="fpl__lead-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lead.heroImage.src} alt={lead.heroImage.alt} className="fpl__lead-img" />
              </span>
            ) : null}
            <span className="fpl__chip">
              <span className="fpl__chip-cat">{CATEGORY_LABEL[lead.category] ?? lead.category}</span>
              <span className="fpl__chip-sep" aria-hidden>
                ·
              </span>
              <span className="fpl__chip-date">{lead.displayDate}</span>
            </span>
            <h1 className="fpl__lead-title">{lead.title}</h1>
            <span className="fpl__lead-sub">{lead.subtitle}</span>
            <span className="fpl__lead-cta">
              Read the report <span aria-hidden>→</span>
            </span>
          </Link>

          {/* Zones two and three — the right rail */}
          <div className="fpl__rail">
            {rail.map((a, i) => (
              <Link
                key={a.slug}
                href={`/news/${a.slug}`}
                className="fpl__rail-card fpl-rise"
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                {a.heroImage?.src ? (
                  <span className="fpl__rail-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.heroImage.src} alt={a.heroImage.alt} className="fpl__rail-img" />
                  </span>
                ) : null}
                <span className="fpl__rail-body">
                  <span className="fpl__chip">
                    <span className="fpl__chip-cat">{CATEGORY_LABEL[a.category] ?? a.category}</span>
                    <span className="fpl__chip-sep" aria-hidden>
                      ·
                    </span>
                    <span className="fpl__chip-date">{a.displayDate}</span>
                  </span>
                  <span className="fpl__rail-title">{a.title}</span>
                </span>
              </Link>
            ))}

            {index.length > 0 ? (
              <ol className="fpl__index fpl-rise" style={{ animationDelay: "400ms" }}>
                {index.map((a, i) => (
                  <li key={a.slug} className="fpl__index-row">
                    <Link href={`/news/${a.slug}`} className="fpl__index-link">
                      <span className="fpl__index-num" aria-hidden>
                        {String(i + 4).padStart(2, "0")}
                      </span>
                      <span className="fpl__index-title">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        .fpl { background: #141414; color: #F2EEE7; }
        .fpl__inner {
          max-width: 1240px; margin: 0 auto;
          padding: 56px clamp(20px, 4vw, 48px) 72px;
        }
        .fpl__masthead {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
          padding-bottom: 16px; margin-bottom: 34px;
          border-bottom: 1px solid rgba(242, 238, 231, 0.14);
        }
        .fpl__desk {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: #C9A961; margin: 0;
        }
        .fpl__edition {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.42); margin: 0;
        }
        .fpl__grid {
          display: grid; grid-template-columns: 3fr 2fr;
          gap: clamp(28px, 3.5vw, 48px);
          align-items: start;
        }

        /* Zone one — the lead story */
        .fpl__lead { display: block; text-decoration: none; }
        .fpl__lead-media {
          display: block; overflow: hidden; border-radius: 10px;
          border: 1px solid rgba(242, 238, 231, 0.1);
          aspect-ratio: 16 / 10; margin-bottom: 22px;
        }
        .fpl__lead-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          filter: saturate(0.88) brightness(0.94);
          transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fpl__lead:hover .fpl__lead-img { transform: scale(1.025); }
        .fpl__chip {
          display: inline-flex; align-items: baseline; gap: 8px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961;
        }
        .fpl__chip-sep { color: rgba(242, 238, 231, 0.42); }
        .fpl__chip-date { color: rgba(242, 238, 231, 0.62); }
        .fpl__lead-title {
          display: block; margin: 12px 0 0;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.8rem, 3.6vw, 3rem); font-weight: 500;
          line-height: 1.08; letter-spacing: -0.02em; color: #F2EEE7;
          transition: color 180ms ease;
        }
        .fpl__lead:hover .fpl__lead-title { color: #C9A961; }
        .fpl__lead-sub {
          display: block; margin-top: 14px; max-width: 56ch;
          font-family: var(--font-inter), sans-serif;
          font-size: 0.98rem; line-height: 1.6;
          color: rgba(242, 238, 231, 0.62);
        }
        .fpl__lead-cta {
          display: inline-block; margin-top: 18px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.85);
          border-bottom: 1px solid #B2924F; padding-bottom: 2px;
        }

        /* Zones two and three — the right rail */
        .fpl__rail { display: flex; flex-direction: column; }
        .fpl__rail-card {
          display: grid; grid-template-columns: 132px 1fr; gap: 16px;
          align-items: start; text-decoration: none;
          padding-bottom: 20px; margin-bottom: 20px;
          border-bottom: 1px solid rgba(242, 238, 231, 0.1);
        }
        .fpl__rail-media {
          display: block; overflow: hidden; border-radius: 8px;
          border: 1px solid rgba(242, 238, 231, 0.1);
          aspect-ratio: 3 / 2;
        }
        .fpl__rail-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          filter: saturate(0.88) brightness(0.94);
          transition: transform 500ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fpl__rail-card:hover .fpl__rail-img { transform: scale(1.04); }
        .fpl__rail-body { display: block; min-width: 0; }
        .fpl__rail-title {
          display: block; margin-top: 8px;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.02rem; font-weight: 500;
          line-height: 1.3; letter-spacing: -0.01em; color: #F2EEE7;
          transition: color 180ms ease;
        }
        .fpl__rail-card:hover .fpl__rail-title { color: #C9A961; }

        /* Zone three — the headline index, stories four to eight */
        .fpl__index { list-style: none; margin: 4px 0 0; padding: 0; }
        .fpl__index-row { border-bottom: 1px solid rgba(242, 238, 231, 0.1); }
        .fpl__index-row:last-child { border-bottom: none; }
        .fpl__index-link {
          display: grid; grid-template-columns: 30px 1fr; gap: 12px;
          align-items: baseline; text-decoration: none;
          padding: 13px 0;
        }
        .fpl__index-num {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.12em;
          color: rgba(242, 238, 231, 0.42);
          font-variant-numeric: tabular-nums;
        }
        .fpl__index-title {
          font-family: var(--font-inter), sans-serif;
          font-size: 0.9rem; line-height: 1.45;
          color: rgba(242, 238, 231, 0.85);
          transition: color 180ms ease;
        }
        .fpl__index-link:hover .fpl__index-title { color: #C9A961; }

        @media (max-width: 960px) {
          .fpl__grid { grid-template-columns: 1fr; }
          .fpl__lead { padding-bottom: 28px; border-bottom: 1px solid rgba(242, 238, 231, 0.1); }
        }
        @media (max-width: 480px) {
          .fpl__rail-card { grid-template-columns: 104px 1fr; gap: 12px; }
        }

        @keyframes fplRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fpl-rise { opacity: 0; animation: fplRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .fpl-rise { opacity: 1; animation: none; }
        }
      `}</style>
    </section>
  );
}
