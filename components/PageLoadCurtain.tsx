"use client";

import { useEffect, useState } from "react";

/**
 * v13 SOTY page-load orchestration — Lando Norris / Cartier pattern.
 *
 * On first paint:
 *   1. Charcoal curtain covers the viewport (translateY 0)
 *   2. "RT" monogram in Fraunces italic, strokes draw on via stroke-dasharray
 *      over 900ms ease-out
 *   3. 200ms pause at full draw
 *   4. Curtain wipes UP over 800ms (var(--ease-curtain), already in globals.css)
 *   5. Hero composition animates in beneath
 *
 * Total boot ~ 1.9s — fast enough not to annoy, slow enough to feel deliberate.
 *
 * Skips on subsequent navigation (sessionStorage flag). Honors
 * prefers-reduced-motion. Renders nothing server-side.
 */
export default function PageLoadCurtain() {
  const [phase, setPhase] = useState<"down" | "up" | "gone">("down");
  const [shouldRun, setShouldRun] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const alreadyBooted = sessionStorage.getItem("iwr-booted") === "1";

    if (reducedMotion || alreadyBooted) {
      setShouldRun(false);
      return;
    }

    sessionStorage.setItem("iwr-booted", "1");

    const t1 = setTimeout(() => setPhase("up"), 1100);
    const t2 = setTimeout(() => setPhase("gone"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!shouldRun || phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9700] flex items-center justify-center pointer-events-none"
      style={{
        background: "var(--ink)",
        transform: phase === "up" ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 800ms var(--ease-curtain)",
      }}
    >
      <svg
        viewBox="0 0 200 120"
        className="w-32 md:w-44 h-auto"
        style={{
          color: "var(--gold-bright)",
          opacity: phase === "down" ? 1 : 0,
          transition: "opacity 320ms var(--ease-out)",
        }}
      >
        {/* "RT" monogram in Fraunces-italic style, drawn as SVG paths
            so we can animate stroke-dashoffset for the draw-on effect. */}
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 400,
            strokeDashoffset: phase === "down" ? 0 : 400,
            animation: "rt-draw 900ms cubic-bezier(0.25, 1, 0.5, 1) 100ms both",
          }}
        >
          {/* R */}
          <path d="M 32 90 L 32 30 L 64 30 Q 80 30 80 48 Q 80 62 64 64 L 38 64 M 60 64 L 84 90" />
          {/* T */}
          <path d="M 110 30 L 168 30 M 138 30 L 138 90" />
        </g>
        {/* Tagline below */}
        <text
          x="100"
          y="112"
          textAnchor="middle"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "5.5px",
            letterSpacing: "2.5px",
            fill: "var(--gold-bright)",
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          INVEST · WITH · RAJ
        </text>
      </svg>

      <style jsx>{`
        @keyframes rt-draw {
          from { stroke-dashoffset: 400; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
