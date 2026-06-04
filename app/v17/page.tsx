// v17 · flagged immersive NEWS terminal (NOT linked from the live news site).
// The "Bloomberg-for-Dubai-RE" scroll experience, composed from the existing
// news components: Terminal → Capital Flow → Daily Brief → The Beats → Bridge.
//
// DARK-CINEMATIC register (A7): the whole subtree wears .v17-dark .v17-cobalt
// (see app/globals.css §10), flipping the warm-cream news palette to the MAIN
// repo's true-black void + cobalt accent. A single persistent <ImmersiveWorld/>
// (fixed · z-0 · dark dust + cobalt glow) sits BEHIND the acts; each act renders
// as translucent dark glass so the WebGL world bleeds through.
//
// Server component on purpose: the acts are each "use client", so they SSR their
// DOM shell + hydrate (good for SEO), while the heavy R3F inside (HolographicRadial,
// CapitalFlowGlobe) lazy-mounts in-view via each act's IntersectionObserver.

import type { Metadata } from "next";
import TerminalAct from "@/components/immersive/acts/TerminalAct";
import CapitalFlowAct from "@/components/immersive/acts/CapitalFlowAct";
import DailyAnchorAct from "@/components/immersive/acts/DailyAnchorAct";
import VerticalsAct from "@/components/immersive/acts/VerticalsAct";
import CrossLinkAct from "@/components/immersive/acts/CrossLinkAct";

export const metadata: Metadata = {
  title: "The Terminal — Dubai Real Estate in Real Time | Invest With Raj",
  description:
    "An immersive market-intelligence terminal for Dubai real estate — live DLD pulse, capital-flow globe, the daily brief, and the five beats that move the market.",
  robots: { index: false, follow: false },
};

export default function V17News() {
  return (
    <div
      className="v17-dark v17-cobalt"
      style={{
        position: "relative",
        // Hybrid conversion: the persistent dark WebGL world is removed; the
        // shell base is a soft dark gradient. DATA-VIZ acts (Terminal, Capital
        // Flow) carry their own Dubai photo + STRONG dark scrim so the luminous
        // viz stays readable; CONTENT acts carry their own photo + lighter scrim
        // and white frosted-glass cards (matching the main site).
        background: "linear-gradient(180deg, #0a0f1a, #0e1422)",
      }}
    >
      {/* Acts are self-contained: each renders its own full-bleed Dubai still +
          scrim, so the shell no longer needs a shared WebGL world behind them. */}
      <main style={{ position: "relative", zIndex: 1, minHeight: "100svh" }}>
        <TerminalAct />
        <CapitalFlowAct />
        <DailyAnchorAct />
        <VerticalsAct />
        <CrossLinkAct />
      </main>
    </div>
  );
}
