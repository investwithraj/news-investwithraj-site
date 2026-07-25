// news.investwithraj.com home — v22 PANGEA FRONT PAGE (24 Jul 2026).
//
// The immersive terminal home recomposed as a proper newspaper front page —
// FT/Semafor editorial hierarchy in the locked Pangea register (dark #141414
// ground · warm-white ink · real gold, sparing). Real data only: live
// articles and the live DLD print. The immersive acts stay in the repo for
// /terminal — they are simply no longer mounted here. Structure:
//
//   1 · FRONT PAGE   — masthead + broadsheet lead package (FrontPageLead).
//   2 · THE PRINT    — live DLD signal band (real /api/dld-pulse).
//   3 · THE DESKS    — reporting by beat, hairline-ruled rails (CategoryDesks).
//   4 · THE PROMISE  — one photographic interstitial line (PromiseInterstitial).
//   5 · THE GROUND   — the drift gallery of area coverage (AreasDrift).
//   6 · THE CALL     — agenda strip (retained).
//   7 · THE BRIDGE   — cross-link to the practice, UTM-tagged (retained).
//   8 · SIGN-OFF     — the giant INVEST WITH RAJ wordmark row.
//
// Chrome: NewsNav (Pangea top bar); the root DldTicker/curtain stay
// suppressed on the home via V17BodyFlag.
import type { Metadata } from "next";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";
import NewsNav from "@/components/v22/pangea/NewsNav";
import FrontPageLead from "@/components/v22/pangea/FrontPageLead";
import SignalBand from "@/components/v22/pangea/SignalBand";
import CategoryDesks from "@/components/v22/pangea/CategoryDesks";
import PromiseInterstitial from "@/components/v22/pangea/PromiseInterstitial";
import AreasDrift from "@/components/v22/pangea/AreasDrift";
import CrossLinkAct from "@/components/immersive/acts/CrossLinkAct";
import CallAgendaStrip from "@/components/v22/pangea/CallAgendaStrip";
import GiantWordmark from "@/components/v21/GiantWordmark";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";

export const metadata: Metadata = {
  title: "The Terminal — Dubai Real Estate in Real Time | Invest With Raj",
  description:
    "The UAE property front page — the day's lead reporting, the live DLD print, the desks by beat, and coverage by community across Dubai, Abu Dhabi and Ras Al Khaimah. Analysed before it's sold.",
  alternates: { canonical: "https://news.investwithraj.com/" },
  robots: { index: true, follow: true },
};

export default function Home() {
  const live = sortNewsArticles(NEWS_ARTICLES).filter((a) => a.status !== "research");
  // The newest live article's cover doubles as the promise interstitial's
  // photograph — fallback-safe: the interstitial simply doesn't mount if no
  // live article carries a cover yet.
  const lead = live[0] ?? null;

  return (
    <>
      {/* Sets data-v17-route on <body> → the scoped CSS below hides the root
          DldTicker/curtain/ambient on the home only, and cleans up on unmount. */}
      <V17BodyFlag />

      <a href="#main" className="v17-skip-link">
        Skip to content
      </a>

      <NewsNav />

      <div
        id="main"
        className="v17-dark v17-cobalt"
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #141414, #1A1A1B)",
        }}
      >
        <main
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100svh",
            // Clear the fixed NewsNav so the masthead rule reads as the
            // paper's first line, not a strip hidden under the chrome.
            paddingTop: "52px",
          }}
        >
          <FrontPageLead articles={live} />
          <SignalBand />
          <CategoryDesks articles={live} />

          {lead?.heroImage?.src ? (
            <PromiseInterstitial
              image={lead.heroImage.src}
              alt={lead.heroImage.alt}
              line={"Analysed before it’s sold."}
              tag={"25.2048° N, 55.2708° E · DUBAI"}
            />
          ) : null}

          <AreasDrift />

          {/* Retained closing acts — same-register seams, no wipes. */}
          <CallAgendaStrip />
          <CrossLinkAct />

          {/* The main-site footer's giant "INVEST WITH RAJ" sign-off. */}
          <div
            aria-hidden="true"
            className="mx-auto flex w-full max-w-[1240px] items-end justify-between px-6 pb-10 pt-4 md:px-10"
            style={{ gap: "clamp(8px, 2vw, 40px)", lineHeight: 0.72 }}
          >
            {"INVEST WITH RAJ".split(" ").map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="block overflow-hidden"
                style={{ paddingBottom: "0.06em", marginBottom: "-0.06em" }}
              >
                <GiantWordmark
                  text={word}
                  sizeClamp="clamp(2.25rem, 9.5vw, 9.5rem)"
                  trackingBreathe
                  decorative
                  style={{ color: "rgba(242, 238, 231, 0.9)" }}
                />
              </span>
            ))}
          </div>
        </main>
      </div>

      {/* Scoped chrome override — only active while this home is mounted. */}
      <style>{`
        body[data-v17-route="true"] .dld-ticker,
        body[data-v17-route="true"] [data-iwr-page-load-curtain],
        body[data-v17-route="true"] [data-iwr-ambient-audio] {
          display: none !important;
        }
        body[data-v17-route="true"] { background: #141414 !important; }
        .v17-skip-link {
          position: fixed; top: 12px; left: 12px; z-index: 100;
          padding: 10px 16px; background: #1A1A1B; color: #F2EEE7;
          border: 1px solid #B2924F; border-radius: 6px;
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 600; text-decoration: none;
          transform: translateY(-200%); transition: transform 160ms ease;
        }
        .v17-skip-link:focus, .v17-skip-link:focus-visible {
          transform: translateY(0); outline: 2px solid #C9A961; outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
