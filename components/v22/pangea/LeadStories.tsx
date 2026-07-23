// v22 PANGEA revamp — the reporting rail. Server component: the latest live
// stories (real NEWS_ARTICLES, research stubs excluded), one spotlight + a
// rail of five, every card a real cover + category chip + date → /news/[slug].
import Link from "next/link";
import type { NewsArticle } from "@/content/news";

const CATEGORY_LABEL: Record<string, string> = {
  "market-pulse": "Market Pulse",
  launch: "Launch",
  regulatory: "Regulatory",
  macro: "Macro",
  "developer-corporate": "Developer",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

export default function LeadStories({ articles }: { articles: NewsArticle[] }) {
  const [spot, ...rail] = articles;
  if (!spot) return null;

  return (
    <section id="the-reporting" data-register="dark" className="lstories" aria-label="The reporting">
      <div className="lstories__inner">
        <div className="lstories__head">
          <p className="lstories__eyebrow">The reporting · cited sources only</p>
          <h2 className="lstories__title">
            What moved <span className="lstories__it">the market.</span>
          </h2>
          <Link href="/news" className="lstories__all">
            All reporting <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="lstories__grid">
          <Link href={`/news/${spot.slug}`} className="lstories__spot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spot.heroImage.src} alt={spot.heroImage.alt} className="lstories__spot-img" loading="lazy" />
            <span className="lstories__spot-scrim" aria-hidden />
            <span className="lstories__spot-body">
              <span className="lstories__chip">
                {CATEGORY_LABEL[spot.category] ?? spot.category} · {spot.displayDate}
              </span>
              <span className="lstories__spot-title">{spot.title}</span>
              <span className="lstories__spot-sub">{spot.subtitle}</span>
            </span>
          </Link>

          <div className="lstories__rail">
            {rail.slice(0, 5).map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="lstories__row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.heroImage.src} alt="" className="lstories__row-img" loading="lazy" />
                <span className="lstories__row-body">
                  <span className="lstories__chip">
                    {CATEGORY_LABEL[a.category] ?? a.category} · {a.displayDate}
                  </span>
                  <span className="lstories__row-title">{a.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .lstories { background: #141414; color: #F2EEE7; }
        .lstories__inner { max-width: 1240px; margin: 0 auto; padding: 88px clamp(20px, 4vw, 48px); }
        .lstories__head { display: flex; flex-wrap: wrap; align-items: end; gap: 18px; margin-bottom: 44px; }
        .lstories__eyebrow {
          flex-basis: 100%;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
          color: #C9A961; margin: 0;
        }
        .lstories__title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.9rem, 4vw, 3.2rem); font-weight: 500;
          letter-spacing: -0.02em; line-height: 1.05; margin: 0;
        }
        .lstories__it { font-family: var(--font-fraunces), serif; font-style: italic; font-weight: 400; color: #C9A961; }
        .lstories__all {
          margin-left: auto;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.7); text-decoration: none;
          border-bottom: 1px solid #B2924F; padding-bottom: 3px;
        }
        .lstories__all:hover { color: #F2EEE7; }
        .lstories__grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 28px; }
        .lstories__spot {
          position: relative; display: block; min-height: 460px;
          border-radius: 12px; overflow: hidden; text-decoration: none;
          border: 1px solid rgba(242, 238, 231, 0.1);
        }
        .lstories__spot-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; filter: saturate(0.9);
          transition: transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lstories__spot:hover .lstories__spot-img { transform: scale(1.035); }
        .lstories__spot-scrim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(20,20,20,0.05) 30%, rgba(20,20,20,0.9) 100%);
        }
        .lstories__spot-body { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px; }
        .lstories__chip {
          display: inline-block;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961;
        }
        .lstories__spot-title {
          display: block; margin-top: 10px;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.25rem, 2.2vw, 1.75rem); font-weight: 500;
          line-height: 1.2; letter-spacing: -0.015em; color: #F2EEE7;
        }
        .lstories__spot-sub {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          margin-top: 8px; font-size: 0.88rem; line-height: 1.55;
          color: rgba(242, 238, 231, 0.66);
        }
        .lstories__rail { display: flex; flex-direction: column; gap: 1px; background: rgba(242,238,231,0.08); border: 1px solid rgba(242,238,231,0.08); border-radius: 12px; overflow: hidden; }
        .lstories__row {
          display: grid; grid-template-columns: 108px 1fr; gap: 16px;
          padding: 16px; text-decoration: none; background: #181818;
          transition: background 200ms ease;
          flex: 1;
        }
        .lstories__row:hover { background: #1F1F1E; }
        .lstories__row-img {
          width: 108px; height: 72px; object-fit: cover;
          border-radius: 6px; filter: saturate(0.85);
        }
        .lstories__row-title {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          margin-top: 6px;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.95rem; font-weight: 500; line-height: 1.3;
          letter-spacing: -0.01em; color: #F2EEE7;
        }
        @media (max-width: 900px) {
          .lstories__grid { grid-template-columns: 1fr; }
          .lstories__spot { min-height: 320px; }
        }
      `}</style>
    </section>
  );
}
