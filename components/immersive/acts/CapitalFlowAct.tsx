"use client";

/**
 * CapitalFlowAct — Act 02 of the v17 immersive rebuild.
 *
 * CAPITAL FLOW. A cinematic, full-bleed section anchored by the reused
 * <CapitalFlowGlobe> (via its lazy Suspense loader) — a buyer-origin globe
 * that streams animated arcs from source nations into Dubai, orbit-drag /
 * pointer-parallax enabled. The globe ships its own R3F/Three.js Canvas and
 * its own REAL DLD nationality baseline, so this act never fabricates a single
 * share-% or volume figure — it only frames the flow qualitatively and lets
 * the globe speak the data.
 *
 * Composition:
 *   • AuroraBackground — slow cobalt/cream noise field behind everything.
 *   • KineticHeadline — Fraunces H2, "capital" rendered cobalt-italic.
 *   • Frosted-glass editorial copy panel (translucent warm-white +
 *     backdrop-blur(20px) + hairline + ~28px radius).
 *   • Lazy-mounted globe — only loads its heavy Three.js scene once the
 *     section scrolls into the viewport (IntersectionObserver gate).
 *   • GSAP ScrollTrigger reveal + subtle parallax on the copy column; falls
 *     back gracefully and respects prefers-reduced-motion.
 *
 * Self-contained, "use client", strict-TS clean for Next 16 / React 19.
 */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CapitalFlowGlobeLoader } from "@/components/futurism/CapitalFlowGlobeLoader";
import { AuroraBackground } from "@/components/futurism/AuroraBackground";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

// Register the ScrollTrigger plugin exactly once, client-side only.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function CapitalFlowAct() {
  const sectionRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);

  // Gate the heavy R3F globe behind an IntersectionObserver so its Three.js
  // scene only spins up when the act is actually near the viewport.
  const [globeVisible, setGlobeVisible] = useState(false);

  useEffect(() => {
    const wrap = globeWrapRef.current;
    if (!wrap) return;

    // SSR-safe fallback — if IO is unavailable, just mount the globe.
    if (typeof IntersectionObserver === "undefined") {
      setGlobeVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setGlobeVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px 0px", threshold: 0.05 }
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, []);

  // GSAP ScrollTrigger reveal + gentle parallax on the editorial column.
  useEffect(() => {
    const section = sectionRef.current;
    const copy = copyRef.current;
    if (!section || !copy) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      gsap.set(copy.children, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      // Staggered reveal of the eyebrow / heading / note / cue.
      gsap.from(copy.children, {
        opacity: 0,
        y: 34,
        duration: 1.05,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: section,
          start: "top 72%",
          once: true,
        },
      });

      // Subtle parallax drift on the copy column as the act scrolls through.
      gsap.to(copy, {
        yPercent: -8,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="capital-flow-heading"
      style={{
        position: "relative",
        minHeight: "100svh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background:
          "radial-gradient(120% 90% at 78% 20%, rgba(91,165,245,0.10), transparent 60%), var(--paper)",
        color: "var(--ink)",
        isolation: "isolate",
      }}
    >
      {/* Aurora field — cobalt/cream, behind all content */}
      <AuroraBackground
        speed={0.7}
        opacity={0.4}
        style={{ zIndex: 0 }}
      />

      {/* Cobalt vignette to seat the globe against the canvas */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(70% 70% at 72% 50%, rgba(29,78,216,0.14), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Full-bleed globe centerpiece ── */}
      <div
        ref={globeWrapRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          maskImage:
            "radial-gradient(80% 80% at 50% 50%, #000 55%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(80% 80% at 50% 50%, #000 55%, transparent 100%)",
        }}
      >
        {globeVisible ? (
          <div style={{ width: "100%", maxWidth: "1100px" }}>
            <CapitalFlowGlobeLoader height="min(86svh, 760px)" />
          </div>
        ) : (
          // Lightweight placeholder ring while the globe is gated off-screen.
          <div
            style={{
              width: "min(60vw, 460px)",
              height: "min(60vw, 460px)",
              borderRadius: "50%",
              border: "1px solid var(--gold-soft)",
              boxShadow: "0 0 80px var(--gold-glow) inset",
            }}
          />
        )}
      </div>

      {/* ── Editorial copy column ── */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "clamp(24px, 5vw, 80px)",
          pointerEvents: "none",
        }}
      >
        <div
          ref={copyRef}
          style={{
            maxWidth: "min(92vw, 440px)",
            pointerEvents: "auto",
            background:
              "color-mix(in srgb, var(--paper) 62%, transparent)",
            backdropFilter: "blur(20px) saturate(150%)",
            WebkitBackdropFilter: "blur(20px) saturate(150%)",
            border: "1px solid var(--chrome-deep)",
            borderRadius: "28px",
            padding: "clamp(22px, 3vw, 40px)",
            boxShadow:
              "0 24px 60px -18px rgba(15,23,42,0.35), 0 0 0 1px var(--gold-soft)",
          }}
        >
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.72rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--gold-deep)",
              margin: 0,
            }}
          >
            02 / Capital Flow
          </p>

          {/* Kinetic Fraunces heading — cobalt-italic accent on "capital" */}
          <KineticHeadline
            as="h2"
            className="capital-flow-heading"
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(2.1rem, 4.6vw, 3.5rem)",
              lineHeight: 1.04,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            <span id="capital-flow-heading">
              Where the{" "}
              <em
                style={{
                  fontStyle: "italic",
                  color: "var(--gold-deep)",
                }}
              >
                capital
              </em>{" "}
              comes from.
            </span>
          </KineticHeadline>

          {/* Two-line buyer-origin note — qualitative, NO fabricated figures */}
          <p
            style={{
              margin: "22px 0 0",
              fontFamily:
                "var(--font-editorial, var(--font-fraunces, Georgia)), Georgia, serif",
              fontSize: "clamp(1rem, 1.5vw, 1.18rem)",
              lineHeight: 1.55,
              color: "var(--ink-soft)",
              maxWidth: "38ch",
            }}
          >
            Indian, British, Russian, Chinese and Gulf buyers route private
            wealth into Dubai property month after month — a steady, multi-
            continental current.
            <br />
            Each arc traces a nationality of origin converging on a single
            destination: the emirate&rsquo;s land registry.
          </p>

          {/* Interaction cue + DLD provenance line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "26px",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.68rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--gold-bright)",
                boxShadow: "0 0 10px var(--gold-bright)",
                flexShrink: 0,
              }}
            />
            <span>Drag to orbit &middot; arcs mapped to buyer origin</span>
          </div>
        </div>
      </div>
    </section>
  );
}
