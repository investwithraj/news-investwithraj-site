// news.investwithraj.com home — v22 PANGEA COMPLETE REVAMP (20 Jul 2026).
//
// The Terminal rebuilt in the same grammar as the main site's Pangea home:
// real DATA first (live articles, live DLD print), the Pangea LOOK (dark
// #141414 ground · warm-white ink · real gold), and terminal FUNCTIONALITY
// (the six desks, the live print, the reporting rail). Structure:
//
//   1 · HERO           — the day's lead story under the desk thesis + doors.
//   2 · THE PRINT      — live DLD signal band (real /api/dld-pulse).
//   3 · THE REPORTING  — spotlight + rail of the latest live stories.
//   4 · THE DESKS      — six product doors (Pulse · Bell · Power List · Map ·
//                        Areas · Developers).
//   5 · CAPITAL FLOW   — the gold globe act (retained cinematic).
//   6 · THE DAILY BRIEF— the voice-anchor act (retained cinematic).
//   7 · THE BRIDGE     — cross-link to the practice, UTM-tagged (retained).
//   8 · SIGN-OFF       — the giant INVEST WITH RAJ wordmark row.
//
// Chrome: NewsNav (Pangea top bar) replaces the corner V17EdgeNav; the root
// DldTicker/curtain stay suppressed on the home via V17BodyFlag. The retained
// acts still read the scoped .v17-dark tokens (Pangea-valued in globals.css).
import type { Metadata } from "next";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";
import NewsNav from "@/components/v22/pangea/NewsNav";
import NewsHero from "@/components/v22/pangea/NewsHero";
import SignalBand from "@/components/v22/pangea/SignalBand";
import LeadStories from "@/components/v22/pangea/LeadStories";
import DesksGrid from "@/components/v22/pangea/DesksGrid";
import CapitalFlowAct from "@/components/immersive/acts/CapitalFlowAct";
import DailyAnchorAct from "@/components/immersive/acts/DailyAnchorAct";
import CrossLinkAct from "@/components/immersive/acts/CrossLinkAct";
import GiantWordmark from "@/components/v21/GiantWordmark";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";

export const metadata: Metadata = {
  title: "The Terminal — Dubai Real Estate in Real Time | Invest With Raj",
  description:
    "The UAE property intel terminal — the day's lead story, the live DLD print, the reporting rail, and the six desks: Pulse, Closing Bell, Power List, the Map, Areas and Developers.",
  robots: { index: true, follow: true },
};

export default function Home() {
  const live = sortNewsArticles(NEWS_ARTICLES).filter((a) => a.status !== "research");
  const lead = live[0] ?? null;
  // The hero features live[0]; the reporting rail spotlights the next story
  // and rails five more — no duplication between sections.
  const rest = live.slice(1, 8);

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
        <main style={{ position: "relative", zIndex: 1, minHeight: "100svh" }}>
          <NewsHero lead={lead} />
          <SignalBand />
          <LeadStories articles={rest} />
          <DesksGrid />

          {/* Retained cinematic acts — same-register seams, no wipes. */}
          <CapitalFlowAct />
          <DailyAnchorAct />
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
