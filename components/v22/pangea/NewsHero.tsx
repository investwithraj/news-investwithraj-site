// v22 PANGEA revamp — the terminal's front-page hero. Server component:
// full-bleed cover of the day's lead story under a warm scrim, the desk's
// thesis in the Pangea type grammar (mono eyebrow · Space Grotesk display ·
// Fraunces italic), the lead-story card, and the two doors (today's
// reporting · the 15-minute call). CSS-keyframe entrances only — static
// under reduced motion. Real data only: the lead article is passed in.
import Link from "next/link";
import type { NewsArticle } from "@/content/news";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL ?? "https://investwithraj.com";
const CALL_HREF = `${MAIN_URL}/start?utm_source=news.investwithraj.com&utm_medium=hero&utm_content=book-the-call#begin`;

const CATEGORY_LABEL: Record<string, string> = {
  "market-pulse": "Market Pulse",
  launch: "Launch",
  regulatory: "Regulatory",
  macro: "Macro",
  "developer-corporate": "Developer",
  infrastructure: "Infrastructure",
  policy: "Policy",
};

export default function NewsHero({ lead }: { lead: NewsArticle | null }) {
  return (
    <section id="terminal-hero" data-register="dark" className="nhero" aria-label="The Terminal">
      {/* Backdrop — the lead story's real cover under a warm dark scrim */}
      <div className="nhero__bg" aria-hidden="true">
        {lead?.heroImage?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.heroImage.src} alt="" className="nhero__bg-img" />
        ) : null}
        <div className="nhero__scrim" />
      </div>

      <div className="nhero__inner">
        <p className="nhero__eyebrow nh-rise" style={{ animationDelay: "60ms" }}>
          The intel terminal · Dubai · Abu Dhabi · Ras Al Khaimah
        </p>

        <h1 className="nhero__title nh-rise" style={{ animationDelay: "140ms" }}>
          The market, read
          <br />
          before it moves.
        </h1>

        <p className="nhero__dek nh-rise" style={{ animationDelay: "230ms" }}>
          Cited, scored, and on the record.
        </p>

        <div className="nhero__doors nh-rise" style={{ animationDelay: "320ms" }}>
          <Link href="/news" className="nhero__door-primary" data-magnetic>
            Today&rsquo;s reporting
          </Link>
          <a href={CALL_HREF} className="nhero__door-ghost" target="_blank" rel="noopener">
            Book the 15-minute call <span aria-hidden>→</span>
          </a>
        </div>

        {lead ? (
          <Link
            href={`/news/${lead.slug}`}
            className="nhero__lead nh-rise"
            style={{ animationDelay: "420ms" }}
          >
            <span className="nhero__lead-tag">
              <span className="nhero__lead-dot" aria-hidden /> Lead ·{" "}
              {CATEGORY_LABEL[lead.category] ?? lead.category} · {lead.displayDate}
            </span>
            <span className="nhero__lead-title">{lead.title}</span>
            <span className="nhero__lead-sub">{lead.subtitle}</span>
            <span className="nhero__lead-cta">
              Read the report <span aria-hidden>→</span>
            </span>
          </Link>
        ) : null}
      </div>

      <style>{`
        .nhero {
          position: relative; min-height: 100svh;
          display: flex; align-items: flex-end;
          background: #141414; color: #F2EEE7; overflow: hidden;
        }
        .nhero__bg { position: absolute; inset: 0; }
        .nhero__bg-img {
          width: 100%; height: 100%; object-fit: cover;
          filter: saturate(0.85) brightness(0.9);
        }
        .nhero__scrim {
          position: absolute; inset: 0;
          background:
            linear-gradient(180deg, rgba(20,20,20,0.82) 0%, rgba(20,20,20,0.55) 40%, rgba(20,20,20,0.92) 100%),
            linear-gradient(70deg, rgba(20,20,20,0.85) 0%, rgba(20,20,20,0.25) 70%);
        }
        .nhero__inner {
          position: relative; width: 100%; max-width: 1240px;
          margin: 0 auto; padding: 140px clamp(20px, 4vw, 48px) 72px;
        }
        .nhero__eyebrow {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: #C9A961; margin: 0 0 22px;
        }
        .nhero__title {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(2.6rem, 6.4vw, 5.4rem); font-weight: 500;
          line-height: 1.02; letter-spacing: -0.025em; margin: 0;
        }
        .nhero__dek {
          font-family: var(--font-fraunces), serif; font-style: italic;
          font-size: clamp(1.05rem, 1.8vw, 1.45rem);
          color: rgba(242, 238, 231, 0.78); margin: 18px 0 0;
        }
        .nhero__doors { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 34px; }
        .nhero__door-primary {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
          text-transform: uppercase; text-decoration: none;
          color: #141414; background: #C9A961;
          padding: 14px 26px; border-radius: 999px;
          transition: background 180ms ease, transform 180ms ease;
        }
        .nhero__door-primary:hover { background: #D8C089; transform: translateY(-1px); }
        .nhero__door-ghost {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          text-decoration: none; color: rgba(242, 238, 231, 0.85);
          padding: 14px 22px; border-radius: 999px;
          border: 1px solid rgba(242, 238, 231, 0.25);
          transition: border-color 180ms ease, color 180ms ease;
        }
        .nhero__door-ghost:hover { border-color: #B2924F; color: #F2EEE7; }
        .nhero__lead {
          display: block; max-width: 620px; margin-top: 52px;
          padding: 22px 24px; text-decoration: none;
          background: rgba(26, 26, 24, 0.66);
          backdrop-filter: blur(18px) saturate(120%);
          -webkit-backdrop-filter: blur(18px) saturate(120%);
          border: 1px solid rgba(242, 238, 231, 0.12);
          border-radius: 10px;
          transition: border-color 200ms ease, transform 200ms ease;
        }
        .nhero__lead:hover { border-color: rgba(178, 146, 79, 0.55); transform: translateY(-2px); }
        .nhero__lead-tag {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #C9A961;
        }
        .nhero__lead-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #86C255; box-shadow: 0 0 8px rgba(134, 194, 85, 0.7);
        }
        .nhero__lead-title {
          display: block; margin-top: 10px;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(1.1rem, 1.9vw, 1.45rem); font-weight: 500;
          line-height: 1.25; letter-spacing: -0.01em; color: #F2EEE7;
        }
        .nhero__lead-sub {
          display: block; margin-top: 8px;
          font-size: 0.86rem; line-height: 1.55;
          color: rgba(242, 238, 231, 0.62);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .nhero__lead-cta {
          display: inline-block; margin-top: 14px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(242, 238, 231, 0.85);
          border-bottom: 1px solid #B2924F; padding-bottom: 2px;
        }
        @keyframes nhRise {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nh-rise { opacity: 0; animation: nhRise 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .nh-rise { opacity: 1; animation: none; }
        }
      `}</style>
    </section>
  );
}
