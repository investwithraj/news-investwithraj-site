// v17 · flagged immersive NEWS terminal (NOT linked from the live news site).
// The "Bloomberg-for-Dubai-RE" scroll experience, composed from the existing
// news components: Terminal → Capital Flow → Daily Brief → The Beats → Bridge.
//
// Server component on purpose: the acts are each "use client", so they SSR their
// DOM shell + hydrate (good for SEO), while the heavy R3F inside (HolographicRadial,
// CapitalFlowGlobe) lazy-mounts in-view via each act's IntersectionObserver.
// News design tokens are already cobalt (#2563EB family) — no override needed.

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
};

export default function V17News() {
  return (
    <main style={{ position: "relative", background: "var(--paper-warm, #F7F4EE)", minHeight: "100svh" }}>
      <TerminalAct />
      <CapitalFlowAct />
      <DailyAnchorAct />
      <VerticalsAct />
      <CrossLinkAct />
    </main>
  );
}
