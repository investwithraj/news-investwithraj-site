"use client";

/**
 * VerticalsAct — v17 immersive "Act 04 / THE BEATS".
 *
 * The five news verticals of news.investwithraj.com presented as
 * 3D-tilt frosted-glass bento panels (reusing the v16 GlassCard surface):
 *   DLD Pulse · Off-Plan Watch · UHNW Trades · Sovereign Plays · Beyond the Deal
 *
 * Each beat is a minimal inline-SVG icon + title + one qualitative line
 * (NO fabricated market numbers — copy is descriptive only). Hover ignites
 * a cobalt glow + lift + pointer-driven parallax tilt.
 *
 * Below, a "Latest reads" row of three placeholder glass article-cards
 * (title + date placeholder). Real articles are wired at integration —
 * these are intentionally inert shells.
 *
 * Motion: GSAP ScrollTrigger staggered reveal of the eyebrow, heading,
 * bento panels, and article cards, plus a gentle parallax drift on the
 * heading block. Honours prefers-reduced-motion. Cobalt + Fraunces only.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlassCard from "@/components/v16/GlassCard";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ── content ─────────────────────────────────────────────────────────────
   Qualitative beat lines only. No prices, no volumes, no percentages —
   the cited figures live in the real DLD ticker, never here. */

interface Beat {
  id: string;
  index: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
}

const ICON_PROPS = {
  width: 30,
  height: 30,
  viewBox: "0 0 30 30",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const BEATS: Beat[] = [
  {
    id: "dld-pulse",
    index: "B1",
    title: "DLD Pulse",
    blurb:
      "The official transaction feed, read in plain language — what the registry is actually recording, the moment it lands.",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M3 16h5l2.5-7 4 13 3-9 2 3h7.5" />
      </svg>
    ),
  },
  {
    id: "off-plan-watch",
    index: "B2",
    title: "Off-Plan Watch",
    blurb:
      "New launches and payment-plan structures decoded — which releases reward early conviction and which simply look the part.",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M5 26V11l7-5 7 5v15" />
        <path d="M19 26V14l6 4v8" />
        <path d="M9 26v-6h6v6" />
      </svg>
    ),
  },
  {
    id: "uhnw-trades",
    index: "B3",
    title: "UHNW Trades",
    blurb:
      "The trophy-asset register — villas, full floors and penthouses changing hands at the top of the market, and what each signals.",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M5 24l3.5-12 6.5 5 6.5-5L25 24z" />
        <circle cx="15" cy="6" r="2" />
        <path d="M4 27h22" />
      </svg>
    ),
  },
  {
    id: "sovereign-plays",
    index: "B4",
    title: "Sovereign Plays",
    blurb:
      "Master-developer and sovereign-fund moves — the infrastructure, districts and mandates reshaping the map a cycle ahead.",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <circle cx="15" cy="15" r="11" />
        <path d="M4 15h22M15 4c3 3 4.5 6.8 4.5 11s-1.5 8-4.5 11c-3-3-4.5-6.8-4.5-11S12 7 15 4z" />
      </svg>
    ),
  },
  {
    id: "beyond-the-deal",
    index: "B5",
    title: "Beyond the Deal",
    blurb:
      "Planning, feasibility and the long view — regulation, urban strategy and the structural forces underneath the headline numbers.",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M15 3l3.6 7.4L26 11l-5.5 5.2L22 24l-7-3.8L8 24l1.5-7.8L4 11l7.4-.6z" />
      </svg>
    ),
  },
];

/* Placeholder "Latest reads" — inert shells until the feed is wired. */
interface ReadCard {
  id: string;
  kicker: string;
  title: string;
}

const LATEST_READS: ReadCard[] = [
  {
    id: "read-1",
    kicker: "DLD Pulse",
    title: "The registry signal, read the day it prints",
  },
  {
    id: "read-2",
    kicker: "Off-Plan Watch",
    title: "Reading a launch beyond the render",
  },
  {
    id: "read-3",
    kicker: "Sovereign Plays",
    title: "Where the master-developers move next",
  },
];

export default function VerticalsAct() {
  const rootRef = useRef<HTMLElement>(null);

  /* ── pointer-driven 3D tilt (per-card, no React re-renders) ─────────────── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return;

    const cards = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tilt]")
    );

    const cleanups = cards.map((card) => {
      const setX = gsap.quickTo(card, "rotationY", {
        duration: 0.5,
        ease: "power3.out",
      });
      const setY = gsap.quickTo(card, "rotationX", {
        duration: 0.5,
        ease: "power3.out",
      });

      const onMove = (e: PointerEvent) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setX(px * 9);
        setY(py * -9);
      };
      const onLeave = () => {
        setX(0);
        setY(0);
      };

      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      return () => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      };
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  /* ── scroll-reveal stagger + heading parallax ──────────────────────────── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(root.querySelectorAll("[data-reveal]"), {
        opacity: 1,
        y: 0,
      });
      return;
    }

    const ctx = gsap.context(() => {
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      gsap.set(reveals, { opacity: 0, y: 34 });

      ScrollTrigger.batch(reveals, {
        start: "top 86%",
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.09,
            overwrite: true,
          }),
      });

      const heading = root.querySelector<HTMLElement>("[data-parallax]");
      if (heading) {
        gsap.to(heading, {
          yPercent: -14,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      ScrollTrigger.refresh();
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-label="The Beats — the five news verticals"
      style={{
        position: "relative",
        minHeight: "100svh",
        padding: "clamp(96px, 12vh, 168px) clamp(20px, 5vw, 64px)",
        background:
          "radial-gradient(120% 90% at 50% -10%, var(--gold-soft) 0%, transparent 55%), var(--paper)",
        color: "var(--ink)",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* faint cobalt grid texture */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.4,
          backgroundImage:
            "linear-gradient(var(--gold-soft) 1px, transparent 1px), linear-gradient(90deg, var(--gold-soft) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(120% 80% at 50% 30%, #000 0%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(120% 80% at 50% 30%, #000 0%, transparent 80%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1280px",
          margin: "0 auto",
        }}
      >
        {/* ── header ─────────────────────────────────────────────────────── */}
        <header data-parallax style={{ marginBottom: "clamp(48px, 6vw, 88px)" }}>
          <p
            data-reveal
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.72rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "var(--gold-deep)",
              margin: "0 0 22px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "34px",
                height: "1px",
                background: "var(--gold)",
                display: "inline-block",
              }}
            />
            04 / The Beats
          </p>

          <div data-reveal>
            <KineticHeadline
              as="h2"
              className="beats-headline"
              style={{
                margin: 0,
                maxWidth: "20ch",
                fontWeight: 600,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                fontSize: "clamp(2.4rem, 6vw, 5rem)",
                color: "var(--ink)",
              }}
            >
              Five beats the market{" "}
              <span
                style={{
                  fontStyle: "italic",
                  color: "var(--gold)",
                }}
              >
                actually
              </span>{" "}
              moves on.
            </KineticHeadline>
          </div>

          <p
            data-reveal
            style={{
              margin: "26px 0 0",
              maxWidth: "58ch",
              fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              fontFamily: "var(--font-body), system-ui, sans-serif",
            }}
          >
            Every story files under one of five recurring beats — the lenses a
            consultant, urban planner and feasibility analyst keeps trained on
            Dubai real estate, all year.
          </p>
        </header>

        {/* ── bento of beats ─────────────────────────────────────────────── */}
        <div className="beats-grid">
          {BEATS.map((beat, i) => (
            <div
              key={beat.id}
              data-reveal
              className={`beat-cell beat-cell--${i}`}
              style={{ perspective: "1100px" }}
            >
              <div
                data-tilt
                className="beat-tilt"
                style={{
                  height: "100%",
                  transformStyle: "preserve-3d",
                }}
              >
              <GlassCard
                padding="lg"
                interactive
                className="beat-card"
                style={{
                  height: "100%",
                  transformStyle: "preserve-3d",
                  borderRadius: "28px",
                  background: "var(--paper-glass, rgba(16, 24, 44, 0.55))",
                  border: "1px solid var(--chrome-deep)",
                  backdropFilter: "blur(20px) saturate(170%)",
                  WebkitBackdropFilter: "blur(20px) saturate(170%)",
                }}
              >
                {/* ignite glow layer */}
                <span aria-hidden="true" className="beat-ignite" />

                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    gap: "18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      className="beat-icon"
                      aria-hidden="true"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "54px",
                        height: "54px",
                        borderRadius: "16px",
                        color: "var(--gold-deep)",
                        background: "var(--gold-soft)",
                        border: "1px solid var(--gold-soft)",
                        transition:
                          "color 0.4s var(--ease-out), box-shadow 0.4s var(--ease-out)",
                      }}
                    >
                      {beat.icon}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.7rem",
                        letterSpacing: "0.2em",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {beat.index}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "4px 0 0",
                      fontFamily: "var(--font-editorial, var(--font-fraunces), Georgia, serif)",
                      fontSize: "clamp(1.4rem, 2.2vw, 1.85rem)",
                      fontWeight: 600,
                      letterSpacing: "-0.015em",
                      color: "var(--ink)",
                    }}
                  >
                    {beat.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.97rem",
                      lineHeight: 1.58,
                      color: "var(--ink-soft)",
                      fontFamily: "var(--font-body), system-ui, sans-serif",
                    }}
                  >
                    {beat.blurb}
                  </p>
                </div>
              </GlassCard>
              </div>
            </div>
          ))}
        </div>

        {/* ── latest reads ───────────────────────────────────────────────── */}
        <div
          data-reveal
          style={{
            margin: "clamp(64px, 8vw, 104px) 0 18px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-editorial, var(--font-fraunces), Georgia, serif)",
              fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            Latest{" "}
            <span style={{ fontStyle: "italic", color: "var(--gold)" }}>
              reads
            </span>
          </h3>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.72rem",
              letterSpacing: "0.26em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Wiring at launch
          </span>
        </div>

        <div className="reads-grid">
          {LATEST_READS.map((read) => (
            <article
              key={read.id}
              data-reveal
              aria-label={`${read.title} — article coming soon`}
              style={{ display: "block" }}
            >
            <GlassCard
              padding="lg"
              interactive
              className="read-card"
              style={{
                height: "100%",
                borderRadius: "28px",
                background: "var(--paper-glass, rgba(16, 24, 44, 0.55))",
                border: "1px solid var(--chrome-deep)",
                backdropFilter: "blur(18px) saturate(160%)",
                WebkitBackdropFilter: "blur(18px) saturate(160%)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.66rem",
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--gold-deep)",
                }}
              >
                {read.kicker}
              </span>

              <h4
                style={{
                  margin: "14px 0 28px",
                  fontFamily: "var(--font-editorial, var(--font-fraunces), Georgia, serif)",
                  fontSize: "clamp(1.2rem, 1.8vw, 1.45rem)",
                  fontWeight: 600,
                  lineHeight: 1.22,
                  letterSpacing: "-0.015em",
                  color: "var(--ink)",
                  minHeight: "2.4em",
                }}
              >
                {read.title}
              </h4>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--chrome-deep)",
                }}
              >
                {/* date placeholder — real publish date wired at integration */}
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "84px",
                    height: "9px",
                    borderRadius: "999px",
                    background:
                      "linear-gradient(90deg, var(--gold-soft), transparent)",
                  }}
                />
                <span
                  className="read-arrow"
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    color: "var(--gold)",
                    transition: "transform 0.4s var(--ease-out)",
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10h12M11 5l5 5-5 5" />
                  </svg>
                </span>
              </div>
            </GlassCard>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .beats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: clamp(16px, 1.6vw, 22px);
        }
        /* 5-up editorial bento: first two cells span 3 cols, last three span 2 */
        .beat-cell--0,
        .beat-cell--1 {
          grid-column: span 3;
        }
        .beat-cell--2,
        .beat-cell--3,
        .beat-cell--4 {
          grid-column: span 2;
        }
        .beat-card {
          position: relative;
          transition: transform 0.5s var(--ease-out),
            border-color 0.4s var(--ease-out), box-shadow 0.4s var(--ease-out);
        }
        .beat-ignite {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.45s var(--ease-out);
          background: radial-gradient(
            80% 60% at 50% 0%,
            var(--gold-glow) 0%,
            transparent 70%
          );
        }
        .beat-cell:hover .beat-card {
          border-color: var(--gold) !important;
          box-shadow: 0 18px 48px -24px var(--gold-glow),
            0 0 0 1px var(--gold-soft);
        }
        .beat-cell:hover .beat-ignite {
          opacity: 1;
        }
        .beat-cell:hover .beat-icon {
          color: var(--gold) !important;
          box-shadow: 0 0 0 4px var(--gold-soft);
        }

        .reads-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(16px, 1.8vw, 24px);
        }
        .read-card:hover .read-arrow {
          transform: translateX(5px);
        }

        @media (max-width: 960px) {
          .beats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .beat-cell--0,
          .beat-cell--1,
          .beat-cell--2,
          .beat-cell--3,
          .beat-cell--4 {
            grid-column: span 1;
          }
          .beat-cell--0 {
            grid-column: span 2;
          }
          .reads-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .beats-grid {
            grid-template-columns: 1fr;
          }
          .beat-cell--0 {
            grid-column: span 1;
          }
        }
      `}</style>
    </section>
  );
}
