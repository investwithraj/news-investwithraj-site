// F17 — Vision Pro / spatial-browser optimised landing.
//
// When a Vision Pro / spatial-browser visitor hits the site, this route is
// the destination they get from Apple's spatial metadata. Renders a glass-
// panel layout designed for floating + depth, plus deep-links into the 5
// verticals and the area map.
//
// Detection on the regular homepage is done client-side via UA sniffing +
// `window.matchMedia("(any-pointer: spatial)")` (when available) and an
// automatic redirect can be added later — for now this is a dedicated URL.

import type { Metadata } from "next";
import Link from "next/link";
import { VERTICALS } from "@/lib/verticals";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Invest With Raj — Spatial edition",
  description:
    "Vision Pro / spatial-browser optimised entry point to news.investwithraj.com. Designed for floating window-modes, hand-gesture navigation, and depth-tagged hero composition.",
  alternates: { canonical: `${SITE.url}/spatial` },
  other: {
    // Apple Vision Pro spatial-web hints — picked up by Safari on visionOS
    "apple-spatial-content": "true",
    "apple-spatial-default-content-mode": "spatial",
    "apple-spatial-floating-windows": "yes",
    "apple-spatial-window-min-width": "640",
    "apple-spatial-window-min-height": "920",
  },
};

export default function SpatialPage() {
  return (
    <main
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, var(--paper-warm), var(--paper) 60%)",
      }}
    >
      {/* Depth-tagged ambient layer (only renders meaningfully on spatial browsers) */}
      <div
        aria-hidden
        style={
          {
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 30%, rgba(201, 169, 97, 0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(10, 16, 36, 0.08), transparent 60%)",
            // Custom CSS property for spatial depth — ignored on flat browsers
            "--apple-spatial-depth": "0.6rem",
          } as React.CSSProperties
        }
      />

      <section className="relative max-w-[1080px] mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-16">
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em]"
          style={{
            background: "rgba(255, 255, 255, 0.55)",
            color: "var(--gold-deep)",
            border: "1px solid var(--gold-soft)",
            backdropFilter: "blur(12px) saturate(180%)",
          }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--gold-deep)" }} />
          Spatial edition · visionOS / WebXR
        </span>

        <KineticHeadline
          className="mt-7 leading-[1.02] tracking-[-0.025em]"
          style={{
            color: "var(--ink)",
            fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            fontWeight: 500,
            maxWidth: "16ch",
          }}
        >
          The UAE real-estate desk,{" "}
          <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
            in your room.
          </span>
        </KineticHeadline>

        <p
          className="mt-8 text-lg md:text-xl leading-[1.55] max-w-[58ch]"
          style={{ color: "var(--ink-soft)" }}
        >
          Pinch to drag windows. Look at any vertical to expand. Each panel
          floats at its own depth — DLD Pulse closest, Beyond the Deal furthest.
          Hand-gesture navigation, spatial audio coming with the next release.
        </p>

        {/* Floating-panel grid — 5 verticals as glass cards designed to render
            with depth on visionOS Safari */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {VERTICALS.map((v, i) => (
            <Link
              key={v.slug}
              href={`/v/${v.slug}`}
              data-magnetic
              className="group relative rounded-3xl p-7 transition-all hover:-translate-y-1"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.32))",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.45)",
                boxShadow: `0 ${12 + i * 4}px ${36 + i * 6}px -${18 - i * 2}px rgba(10, 16, 36, ${0.14 + i * 0.02}), inset 0 1px 0 rgba(255,255,255,0.6)`,
                // Spatial depth-tier — closer panels feel nearer in visionOS
                ["--apple-spatial-depth" as string]: `${0.4 + i * 0.2}rem`,
              } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  aria-hidden
                  className="leading-none"
                  style={{
                    color: v.accent,
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    fontSize: "2.5rem",
                    opacity: 0.8,
                  }}
                >
                  {v.glyph}
                </span>
                <span
                  className="text-[9px] font-mono uppercase tracking-[0.22em]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  z · {(0.4 + i * 0.2).toFixed(1)}rem
                </span>
              </div>
              <h3
                className="text-xl md:text-2xl leading-tight tracking-[-0.02em] mb-2"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontWeight: 500,
                  fontVariationSettings: '"SOFT" 70, "opsz" 144',
                }}
              >
                {v.name}
              </h3>
              <p className="text-sm leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
                {v.tagline}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/"
            className="btn-ghost group inline-flex"
            data-magnetic
          >
            <span>Open the flat-web desk</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
