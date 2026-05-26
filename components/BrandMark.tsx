"use client";

import { useEffect, useState } from "react";

/**
 * v13 SOTY brand mark — RT monogram with Cucinelli invert system.
 *
 * Mark is rendered as a Fraunces-italic-style monogram. When it sits over
 * a dark hero, it renders in paper-cream. When the user scrolls past the
 * hero into the cream sections, it inverts to ink (warm charcoal).
 *
 * IntersectionObserver watches the hero element (#hero). Crossfade 320ms.
 *
 * Used by StickyGlassNav. Also exportable for OG images / favicons later.
 */
export default function BrandMark({
  size = 24,
  forceMode,
}: {
  size?: number;
  /** Force a specific color regardless of scroll position. Useful for
   *  pages without a dark hero (about, notes archive). */
  forceMode?: "light" | "dark";
}) {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    if (forceMode) return;
    if (typeof window === "undefined") return;

    const hero = document.getElementById("hero");
    if (!hero) {
      setOverHero(false);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // We're "over hero" when the hero is mostly visible
          setOverHero(e.intersectionRatio > 0.4);
        }
      },
      {
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
      }
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [forceMode]);

  const mode = forceMode ?? (overHero ? "light" : "dark");
  const color = mode === "light" ? "var(--paper-warm)" : "var(--ink)";

  return (
    <span
      className="inline-flex items-center gap-2.5"
      style={{ transition: "color 320ms var(--ease-out)", color }}
    >
      {/* The RT mark — italic Fraunces, hand-tuned negative letterspace */}
      <svg
        viewBox="0 0 64 32"
        width={size * 2}
        height={size}
        aria-hidden="true"
        style={{ color: "var(--gold-deep)" }}
      >
        <text
          x="2"
          y="26"
          style={{
            fontFamily: "var(--font-editorial), serif",
            fontVariationSettings: '"SOFT" 50, "opsz" 144, "WONK" 1',
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: "28px",
            letterSpacing: "-0.08em",
            fill: "currentColor",
          }}
        >
          RT
        </text>
      </svg>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.22em",
          fontWeight: 500,
        }}
      >
        Invest With Raj
      </span>
    </span>
  );
}
