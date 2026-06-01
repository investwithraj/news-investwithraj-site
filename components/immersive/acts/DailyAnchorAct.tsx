"use client";

// ACT 03 — THE DAILY BRIEF
// ----------------------------------------------------------------------------
// A cinematic "broadcast booth" that frames the AI daily-anchor player.
//
// This act does NOT invent any headline, audio, or market figure. It composes
// the real <DailyAnchorPane/> — which self-fetches /api/anchor and falls back to
// its own Day-1 placeholder ("first Anchor generates with the morning cron")
// when nothing is live yet. All copy here is qualitative scene-setting only.
//
// The booth chrome (cobalt aurora wash, frosted-glass shell with hairline +
// 28px radius, kinetic Fraunces heading with ONE cobalt-italic accent word, an
// "ON AIR" rec light, and a stack of broadcast-status rails) assembles on
// scroll via GSAP ScrollTrigger, with IntersectionObserver as the resilient
// fallback. A subtle parallax lifts the booth as it enters the frame.
//
// Raj is a real-estate consultant + urban/regional planner + feasibility
// analyst — never a "broker". WhatsApp: +971 58 996 6085.

import { useEffect, useRef, useState } from "react";
import { AuroraBackground, AURORA_COBALT_STOPS } from "@/components/futurism/AuroraBackground";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { DailyAnchorPane } from "@/components/anchor/DailyAnchorPane";

const WHATSAPP_URL = "https://wa.me/971589966085";

// Broadcast-status rails shown beside the booth. Qualitative only — no numbers.
const SIGNAL_RAILS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Cadence", value: "Every morning · 07:00 GST" },
  { label: "Voice", value: "Raj — script to read" },
  { label: "Source", value: "The day's lead story" },
  { label: "Format", value: "~90-second open" },
];

export default function DailyAnchorAct() {
  const sectionRef = useRef<HTMLElement>(null);
  const boothRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  // ── Reveal + parallax orchestration ──────────────────────────────────────
  // Prefer GSAP ScrollTrigger; gracefully fall back to IntersectionObserver so
  // the section is never left invisible if the plugin import is unavailable.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setRevealed(true);
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const gsapMod = await import("gsap");
        const stMod = await import("gsap/ScrollTrigger");
        if (cancelled) return;

        const gsap = gsapMod.gsap ?? gsapMod.default;
        const ScrollTrigger = stMod.ScrollTrigger ?? stMod.default;
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          // Booth + rails assemble in.
          const targets = [boothRef.current, railRef.current].filter(
            Boolean
          ) as HTMLElement[];

          gsap.fromTo(
            targets,
            { autoAlpha: 0, y: 56 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 1.05,
              ease: "power3.out",
              stagger: 0.14,
              scrollTrigger: {
                trigger: section,
                start: "top 72%",
                once: true,
                onEnter: () => setRevealed(true),
              },
            }
          );

          // Subtle parallax lift on the booth as the act scrolls through.
          if (parallaxRef.current) {
            gsap.fromTo(
              parallaxRef.current,
              { yPercent: 6 },
              {
                yPercent: -6,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              }
            );
          }
        }, section);

        cleanup = () => ctx.revert();
      } catch {
        // GSAP unavailable — IntersectionObserver fallback.
        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                setRevealed(true);
                io.disconnect();
              }
            }
          },
          { threshold: 0.25 }
        );
        io.observe(section);
        cleanup = () => io.disconnect();
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      data-act="03-daily-brief"
      data-section="dark"
      className="daily-anchor-act"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: "transparent",
        color: "var(--v17-text, #EAF0FA)",
        paddingBlock: "clamp(4rem, 9vw, 7.5rem)",
      }}
    >
      {/* Cobalt aurora wash — the booth's ambient backlight. */}
      <AuroraBackground speed={0.65} opacity={0.4} stops={AURORA_COBALT_STOPS} />

      {/* Cobalt vignette + grain to seat the booth in a dark studio. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(37,99,235,0.18), transparent 55%), radial-gradient(100% 100% at 50% 120%, rgba(0,0,0,0.55), transparent 60%)",
        }}
      />

      <div
        ref={parallaxRef}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "1240px",
          marginInline: "auto",
          paddingInline: "clamp(1.25rem, 4vw, 2.5rem)",
        }}
      >
        {/* ── Masthead ───────────────────────────────────────────────────── */}
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1.5rem",
            marginBottom: "clamp(2rem, 4vw, 3.25rem)",
          }}
        >
          <div style={{ maxWidth: "62ch" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.6875rem",
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: "var(--gold-bright)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: "26px",
                  height: "1px",
                  background: "var(--gold)",
                  display: "inline-block",
                }}
              />
              03 / The Daily Brief
            </span>

            <KineticHeadline
              as="h2"
              style={{
                marginTop: "1.25rem",
                color: "var(--v17-text, #EAF0FA)",
                fontSize: "clamp(2rem, 5.4vw, 3.75rem)",
                lineHeight: 1.04,
                fontWeight: 400,
                maxWidth: "18ch",
              }}
            >
              The desk{" "}
              <em
                style={{
                  fontStyle: "italic",
                  color: "var(--gold-bright)",
                }}
              >
                opens
              </em>{" "}
              the day.
            </KineticHeadline>

            <p
              style={{
                marginTop: "1.5rem",
                maxWidth: "52ch",
                fontSize: "clamp(1rem, 1.4vw, 1.15rem)",
                lineHeight: 1.65,
                color: "rgba(240, 245, 255, 0.74)",
              }}
            >
              Step into the booth. Each morning the lead story becomes a short,
              spoken brief — read in Raj&apos;s voice, ready before the market
              does. Press play and let the day&apos;s read come to you.
            </p>
          </div>

          {/* ON-AIR rec light. */}
          <div
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.625rem",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(240, 245, 255, 0.6)",
              padding: "0.5rem 0.85rem",
              borderRadius: "999px",
              border: "1px solid rgba(91, 165, 245, 0.3)",
              background: "rgba(37, 99, 235, 0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <span
              className="daily-anchor-act__dot"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--gold)",
                boxShadow: "0 0 10px var(--gold-bright)",
                display: "inline-block",
              }}
            />
            On air · daily
          </div>
        </header>

        {/* ── Booth: rails + framed player ───────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: "clamp(1.25rem, 2.5vw, 2rem)",
            alignItems: "start",
          }}
          className="daily-anchor-act__grid"
        >
          {/* Signal rails — qualitative broadcast metadata, no figures. */}
          <div
            ref={railRef}
            className="daily-anchor-act__rails"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.75rem",
              opacity: revealed ? undefined : 0,
            }}
          >
            {SIGNAL_RAILS.map((rail) => (
              <div
                key={rail.label}
                style={{
                  borderRadius: "18px",
                  border: "1px solid rgba(91, 165, 245, 0.18)",
                  background: "rgba(240, 245, 255, 0.04)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  padding: "0.9rem 1.05rem",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.5625rem",
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: "var(--gold-bright)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {rail.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-editorial, var(--font-fraunces, Georgia))",
                    fontSize: "0.95rem",
                    lineHeight: 1.3,
                    color: "rgba(240, 245, 255, 0.9)",
                  }}
                >
                  {rail.value}
                </div>
              </div>
            ))}
          </div>

          {/* Frosted-glass booth shell wrapping the real anchor player. */}
          <div
            ref={boothRef}
            className="daily-anchor-act__booth"
            style={{
              position: "relative",
              borderRadius: "28px",
              border: "1px solid rgba(91, 165, 245, 0.28)",
              background: "rgba(12, 18, 38, 0.55)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              boxShadow:
                "0 30px 80px -40px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)",
              overflow: "hidden",
              opacity: revealed ? undefined : 0,
            }}
          >
            {/* Cobalt scanline rim — the studio glass edge. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                insetInline: 0,
                top: 0,
                height: "2px",
                background:
                  "linear-gradient(90deg, transparent, var(--gold-bright), transparent)",
                opacity: 0.7,
                zIndex: 2,
              }}
            />

            {/* Booth strap line. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.85rem clamp(1rem, 2.5vw, 1.6rem)",
                borderBottom: "1px solid rgba(91, 165, 245, 0.14)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.5625rem",
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "rgba(240, 245, 255, 0.55)",
              }}
            >
              <span>Broadcast booth</span>
              <span style={{ color: "var(--gold-bright)" }}>
                Tap to play ▶
              </span>
            </div>

            {/* The real AI daily-brief player.
                Self-contained: fetches /api/anchor, renders its own dark
                player or the Day-1 placeholder. No props to fabricate. */}
            <DailyAnchorPane />
          </div>
        </div>

        {/* ── Footer line — soft CTA, no figures ─────────────────────────── */}
        <div
          style={{
            marginTop: "clamp(1.75rem, 3vw, 2.75rem)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "1rem 1.75rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6875rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(240, 245, 255, 0.5)",
          }}
        >
          <span>Want the read in person?</span>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--gold-bright)",
              textDecoration: "none",
            }}
          >
            <span
              aria-hidden
              style={{
                width: "16px",
                height: "1px",
                background: "var(--gold)",
                display: "inline-block",
              }}
            />
            Message the desk
          </a>
        </div>
      </div>

      <style jsx>{`
        .daily-anchor-act__dot {
          animation: daily-anchor-blink 2s ease-in-out infinite;
        }
        @keyframes daily-anchor-blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.25;
          }
        }
        @media (min-width: 960px) {
          .daily-anchor-act__grid {
            grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
            align-items: stretch;
          }
          .daily-anchor-act__rails {
            grid-template-columns: minmax(0, 1fr);
            align-content: start;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .daily-anchor-act__dot {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
