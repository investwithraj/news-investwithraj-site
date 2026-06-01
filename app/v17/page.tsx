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
import ImmersiveWorld from "@/components/immersive/ImmersiveWorld";
import TerminalAct from "@/components/immersive/acts/TerminalAct";
import CapitalFlowAct from "@/components/immersive/acts/CapitalFlowAct";
import DailyAnchorAct from "@/components/immersive/acts/DailyAnchorAct";
import VerticalsAct from "@/components/immersive/acts/VerticalsAct";
import CrossLinkAct from "@/components/immersive/acts/CrossLinkAct";

export const metadata: Metadata = {
  title: "The Terminal — Dubai Real Estate in Real Time | Invest With Raj",
  description:
    "An immersive market-intelligence terminal for Dubai real estate — live DLD pulse, capital-flow globe, the daily brief, and the five beats that move the market.",
};

export default function V17News() {
  return (
    <div className="v17-dark v17-cobalt" style={{ position: "relative", background: "var(--v17-bg, #05070d)" }}>
      {/* The ONE persistent dark WebGL world — fixed, z-0, behind all acts. */}
      <ImmersiveWorld />

      {/* Acts sit above the world (z-1); each is translucent dark glass so the
          dust + cobalt glow shows through. */}
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
