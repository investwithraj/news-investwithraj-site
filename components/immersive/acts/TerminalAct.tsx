"use client";

/**
 * TerminalAct — Act 01 of the v17 immersive rebuild of news.investwithraj.com.
 *
 * THE TERMINAL (hero / news front-door). A cinematic, frosted-glass "live
 * trading floor" that fuses:
 *   • HolographicRadial — the reused canvas radial network-node data scene
 *     (the centerpiece "3D data terminal"), lazy-mounted via IntersectionObserver
 *     and scroll-dollied/parallaxed with GSAP ScrollTrigger.
 *   • DldTicker — the REAL, cited DLD daily-pulse feed (never fabricated),
 *     wrapped under the scene. It needs FX context, so we mount FxProvider
 *     locally to keep this Act self-contained as a page front-door.
 *   • DataPanel ×4 — count-up stat cards using the SAME real/cited/default
 *     values the existing v16 HolographicTerminal hero already ships. No new
 *     numbers are invented here.
 *   • KineticHeadline — Fraunces variable-font masthead with ONE cobalt-italic
 *     accent word.
 *
 * Brand: cobalt accent tokens (--gold = #2563EB et al — already cobalt in this
 * repo, used directly). Raj is a real-estate consultant / urban & regional
 * planner / feasibility analyst — never a "broker". No employer names.
 */

import {
  CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import HolographicRadial from "@/components/v16/HolographicRadial";
import DataPanel from "@/components/v16/DataPanel";
import { DldTicker } from "@/components/ticker/DldTicker";
import { FxProvider } from "@/components/ticker/FxProvider";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const WHATSAPP_HREF = "https://wa.me/971589966085";

/* Frosted-glass surface — translucent warm-white, backdrop-blur, hairline,
 * ~28px radius. Built from cobalt tokens so it tracks the brand. */
const glassSurface: CSSProperties = {
  background: "rgba(255, 255, 255, 0.55)",
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  border: "1px solid rgba(37, 99, 235, 0.16)",
  borderRadius: "28px",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 60px -28px rgba(15, 23, 42, 0.28), 0 0 0 1px var(--gold-soft, rgba(37,99,235,0.10))",
};

export default function TerminalAct() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const mastheadRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const sceneMountRef = useRef<HTMLDivElement | null>(null);

  // Gate the heavy canvas scene behind IntersectionObserver so it only
  // mounts (and starts its RAF loop) when the hero is actually near view.
  const [sceneReady, setSceneReady] = useState(false);

  // Dubai-time clock — qualitative "live" affordance, no market figures.
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Dubai",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  // Lazy-mount the 3D/canvas centerpiece.
  useEffect(() => {
    const el = sceneMountRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSceneReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setSceneReady(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Scroll-driven dolly + parallax. Cinematic, but reduced-motion safe.
  useEffect(() => {
    const section = sectionRef.current;
    const scene = sceneRef.current;
    if (!section || !scene) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      // Entrance reveal for the masthead + panels.
      if (mastheadRef.current) {
        gsap.from(mastheadRef.current, {
          y: 36,
          autoAlpha: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: mastheadRef.current,
            start: "top 85%",
          },
        });
      }
      if (panelsRef.current) {
        gsap.from(panelsRef.current.children, {
          y: 28,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: panelsRef.current,
            start: "top 88%",
          },
        });
      }

      // The dolly: as the hero scrolls through, the data scene pushes
      // gently toward camera (scale up) and drifts up — a parallax pull.
      gsap.fromTo(
        scene,
        { scale: 0.94, yPercent: 6 },
        {
          scale: 1.06,
          yPercent: -6,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );

      // Counter-parallax on the masthead so it floats over the dolly.
      if (mastheadRef.current) {
        gsap.to(mastheadRef.current, {
          yPercent: -10,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="The Terminal — Dubai real estate in real time"
      style={{
        position: "relative",
        minHeight: "100svh",
        overflow: "hidden",
        background:
          "radial-gradient(120% 90% at 50% -10%, rgba(37,99,235,0.10), transparent 60%), var(--paper-warm, #E8DFD0)",
        color: "var(--ink, #2B2621)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Ambient cobalt glow field behind the glass */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 78% 32%, rgba(91,165,245,0.16), transparent 70%), radial-gradient(50% 40% at 18% 70%, rgba(37,99,235,0.10), transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Faint terminal grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(80% 70% at 50% 35%, #000 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(80% 70% at 50% 35%, #000 30%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content grid */}
      <div
        className="terminal-act-grid"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          width: "100%",
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "120px 24px 64px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
          gap: "56px",
          alignItems: "center",
        }}
      >
        {/* LEFT — masthead + stat panels */}
        <div ref={mastheadRef} style={{ willChange: "transform" }}>
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "24px",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.7rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--gold-deep, #1D4ED8)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--gold, #2563EB)",
                boxShadow: "0 0 10px var(--gold, #2563EB)",
                animation: "terminal-act-blink 1.6s ease-in-out infinite",
              }}
            />
            01 / THE TERMINAL
          </div>

          {/* Glass masthead card */}
          <div style={{ ...glassSurface, padding: "36px 36px 40px" }}>
            <p
              style={{
                margin: "0 0 18px",
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: "0.72rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--gold, #2563EB)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              news.investwithraj.com
              <span aria-hidden="true" style={{ opacity: 0.4 }}>·</span>
              <span style={{ color: "var(--ink-muted, #7C7268)" }}>
                Dubai {now || "—"} GST
              </span>
            </p>

            <KineticHeadline
              as="h1"
              style={{
                margin: 0,
                fontSize: "clamp(2.6rem, 6vw, 5rem)",
                lineHeight: 1.02,
                fontWeight: 500,
                color: "var(--ink, #2B2621)",
              }}
            >
              Dubai real estate,{" "}
              <em
                style={{
                  fontStyle: "italic",
                  color: "var(--gold-deep, #1D4ED8)",
                }}
              >
                in real time.
              </em>
            </KineticHeadline>

            <p
              style={{
                margin: "24px 0 0",
                maxWidth: "46ch",
                fontFamily:
                  "var(--font-editorial, var(--font-fraunces, Georgia)), serif",
                fontSize: "1.1rem",
                lineHeight: 1.55,
                color: "var(--ink-soft, #4A413A)",
              }}
            >
              A live intelligence terminal for the UAE market — the DLD pulse,
              capital flows, and verified-source reporting in one frame. Read
              and shaped by Raj Tomar, real-estate consultant and urban &amp;
              regional planner.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "28px",
              }}
            >
              <a
                href="/v16/articles"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 22px",
                  borderRadius: "999px",
                  background: "var(--gold-deep, #1D4ED8)",
                  color: "#fff",
                  textDecoration: "none",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: "0.78rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  boxShadow: "0 10px 30px -12px rgba(37,99,235,0.6)",
                }}
              >
                Today&apos;s reporting
              </a>
              <a
                href={WHATSAPP_HREF}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 22px",
                  borderRadius: "999px",
                  background: "transparent",
                  color: "var(--gold-deep, #1D4ED8)",
                  textDecoration: "none",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: "0.78rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(37,99,235,0.35)",
                }}
              >
                Talk to Raj
              </a>
            </div>
          </div>

          {/* Stat panels — real/cited/default figures inherited from the
              existing v16 HolographicTerminal hero. Not fabricated here. */}
          <div
            ref={panelsRef}
            style={{
              marginTop: "20px",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <DataPanel
              eyebrow="DLD Q1 2026"
              value="AED 11.97B"
              delta={{ value: "+12.4%", trend: "up" }}
              sparkline={[12, 18, 15, 22, 19, 26, 24, 31, 28, 34, 32, 38]}
              variant="holo"
              size="sm"
            />
            <DataPanel
              eyebrow="Median PSF"
              value="AED 1,662"
              delta={{ value: "+3.2%", trend: "up" }}
              variant="light"
              size="sm"
            />
            <DataPanel
              eyebrow="Avg ticket"
              value="AED 4M"
              variant="light"
              size="sm"
            />
            <DataPanel
              eyebrow="Verified today"
              value="11"
              delta={{ value: "5 sourced", trend: "flat" }}
              variant="light"
              size="sm"
            />
          </div>
        </div>

        {/* RIGHT — the centerpiece data scene + ticker, dollied on scroll */}
        <div
          ref={sceneMountRef}
          style={{ position: "relative", width: "100%" }}
        >
          <div ref={sceneRef} style={{ willChange: "transform" }}>
            <div
              style={{
                ...glassSurface,
                padding: "20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Screen chrome row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                  paddingInline: "6px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    fontSize: "0.62rem",
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "var(--gold-deep, #1D4ED8)",
                  }}
                >
                  Capital flow · network
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    fontSize: "0.62rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--gold, #2563EB)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--gold-bright, #5BA5F5)",
                      boxShadow: "0 0 8px var(--gold-bright, #5BA5F5)",
                      animation: "terminal-act-blink 1.4s ease-in-out infinite",
                    }}
                  />
                  Engine live
                </span>
              </div>

              {/* Curved terminal-screen shell holding the radial scene */}
              <div
                style={{
                  position: "relative",
                  borderRadius: "20px",
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(91,165,245,0.08))",
                  border: "1px solid rgba(37,99,235,0.18)",
                  padding: "14px",
                  minHeight: "360px",
                }}
              >
                {sceneReady ? (
                  <HolographicRadial density="high" variant="light" />
                ) : (
                  <ScenePlaceholder />
                )}

                {/* Corner brackets — terminal affordance */}
                <Brackets />
              </div>

              {/* The REAL cited DLD ticker, wrapped under the scene.
                  FxProvider keeps <Price/> happy when this Act is a
                  standalone front-door (graceful fallback if no backend). */}
              <div
                style={{
                  marginTop: "16px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid rgba(37,99,235,0.16)",
                }}
              >
                <FxProvider>
                  <DldTicker />
                </FxProvider>
              </div>
            </div>
          </div>

          {/* Floating caption under the screen */}
          <p
            style={{
              margin: "16px 4px 0",
              textAlign: "right",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.66rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-muted, #7C7268)",
            }}
          >
            Live DLD pulse · cited sources only
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes terminal-act-blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @media (max-width: 980px) {
          .terminal-act-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
            padding-top: 104px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .terminal-act-grid :global(*) {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

/* Lightweight skeleton shown before the canvas scene mounts. */
function ScenePlaceholder() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "2px solid rgba(37,99,235,0.25)",
          borderTopColor: "var(--gold, #2563EB)",
          animation: "terminal-act-spin 1s linear infinite",
        }}
      />
      <style jsx>{`
        @keyframes terminal-act-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

/* Four corner brackets for the terminal-screen frame. */
function Brackets() {
  const base: CSSProperties = {
    position: "absolute",
    width: "20px",
    height: "20px",
    borderColor: "var(--gold, #2563EB)",
    borderStyle: "solid",
    borderWidth: 0,
    opacity: 0.7,
    pointerEvents: "none",
  };
  return (
    <>
      <span
        aria-hidden="true"
        style={{ ...base, top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2 }}
      />
      <span
        aria-hidden="true"
        style={{ ...base, top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2 }}
      />
      <span
        aria-hidden="true"
        style={{ ...base, bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2 }}
      />
      <span
        aria-hidden="true"
        style={{ ...base, bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2 }}
      />
    </>
  );
}
