// news.investwithraj.com home — the immersive "Terminal" (promoted from /v17 in
// the v1.1 cutover). The REST of the news site (articles, verticals, /terminal,
// /pulse, /areas, …) keeps the cream chrome + DldTicker from the root layout;
// this home wears the dark v17 register and suppresses the root ticker/curtain
// via <V17BodyFlag/> (sets body[data-v17-route] → the scoped CSS below). This is
// the same chrome the old app/v17/layout.tsx applied — folded onto the root home
// so the Terminal serves at "/" directly (no redirect hop).
import type { Metadata } from "next";
import V17EdgeNav from "@/components/v17/chrome/V17EdgeNav";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";
import TerminalAct from "@/components/immersive/acts/TerminalAct";
import CapitalFlowAct from "@/components/immersive/acts/CapitalFlowAct";
import DailyAnchorAct from "@/components/immersive/acts/DailyAnchorAct";
import VerticalsAct from "@/components/immersive/acts/VerticalsAct";
import CrossLinkAct from "@/components/immersive/acts/CrossLinkAct";
import SectionWipe from "@/components/v21/SectionWipe";
import GiantWordmark from "@/components/v21/GiantWordmark";

export const metadata: Metadata = {
  title: "The Terminal — Dubai Real Estate in Real Time | Invest With Raj",
  description:
    "An immersive market-intelligence terminal for Dubai real estate — live DLD pulse, capital-flow globe, the daily brief, and the five beats that move the market.",
  robots: { index: true, follow: true },
};

export default function Home() {
  return (
    <>
      {/* Sets data-v17-route on <body> → the scoped CSS below hides the root
          DldTicker/curtain/ambient on the home only, and cleans up on unmount. */}
      <V17BodyFlag />

      <a href="#main" className="v17-skip-link">
        Skip to content
      </a>

      {/* Corner-only dark chrome (replaces the cream ticker nav on the home) */}
      <V17EdgeNav />

      <div
        id="main"
        className="v17-dark v17-cobalt"
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #0a0f1a, #0e1422)",
        }}
      >
        <main style={{ position: "relative", zIndex: 1, minHeight: "100svh" }}>
          <TerminalAct />
          {/* V21 brand-motion unification — the main site's SectionWipe
              (B&C page-change wipe, gold leading edge) on the three content
              rooms below the fold. The Terminal hero and the Daily Anchor
              stay untouched (terminal identity preserved). */}
          <SectionWipe>
            <CapitalFlowAct />
          </SectionWipe>
          <DailyAnchorAct />
          <SectionWipe>
            <VerticalsAct />
          </SectionWipe>
          <SectionWipe>
            <CrossLinkAct />
          </SectionWipe>

          {/* V21 — the main-site footer's giant "INVEST WITH RAJ" sign-off
              (GiantWordmark, B&C edge-spanning bottom wordmark). Words spread
              across the full width; each keeps the tracking-breathe scroll-in
              inside its own clip mask. Decorative — the accessible brand name
              lives in the acts above. Light ink for the dark v17 register. */}
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
                  style={{ color: "rgba(234, 240, 250, 0.9)" }}
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
        body[data-v17-route="true"] { background: #05070d !important; }
        .v17-skip-link {
          position: fixed; top: 12px; left: 12px; z-index: 100;
          padding: 10px 16px; background: #05070d; color: #EAF0FA;
          border: 1px solid #2563EB; border-radius: 6px;
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px; font-weight: 600; text-decoration: none;
          transform: translateY(-200%); transition: transform 160ms ease;
        }
        .v17-skip-link:focus, .v17-skip-link:focus-visible {
          transform: translateY(0); outline: 2px solid #5BA5F5; outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
