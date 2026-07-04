"use client";

/**
 * v17 immersive rebuild — ACT 05 · THE BRIDGE (footer act, ~70svh).
 *
 * The closing "go deeper" handoff that bridges the two domains as ONE brand:
 * the news terminal (news.investwithraj.com) → the consultancy (investwithraj.com).
 *
 * Composition:
 *   • Eyebrow "05 / GO DEEPER" (mono caps, cobalt hairline).
 *   • Kinetic Fraunces heading with ONE cobalt-italic accent word ("mandates."),
 *     reusing <KineticHeadline> (it brings its own SOFT-axis morph + IO).
 *   • Primary CTA → https://investwithraj.com (the consultancy funnel).
 *   • WhatsApp CTA → wa.me/971589966085, label "+971 58 996 6085".
 *   • A small live currency note (AED / USD / INR / GBP) wired to the existing
 *     FxProvider (useFx + CurrencyPicker). When the live /api/fx snapshot is
 *     unavailable it falls through to the provider's own cited fallback rates —
 *     never a fabricated figure.
 *
 * Brand invariants honoured: Raj = consultant + urban & regional planner +
 * feasibility analyst (never "broker"); no fabricated market numbers; no
 * employer/company names.
 *
 * Surface: cobalt + frosted glass (translucent warm-white + backdrop-blur(20px)
 * + hairline + 28px radius). Scroll-reveal via GSAP ScrollTrigger (registered
 * here) with an IntersectionObserver fallback + prefers-reduced-motion guard,
 * and a subtle parallax on the ambient cobalt wash.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { useFx, CurrencyPicker } from "@/components/ticker/FxProvider";
import {
  CURRENCY_META,
  convertAedTo,
  formatCurrency,
  type Currency,
} from "@/lib/fx/rates";

const ROOT_URL = "https://investwithraj.com";
const WHATSAPP_E164 = "971589966085";
const WHATSAPP_DISPLAY = "+971 58 996 6085";

/**
 * Self-contained full-bleed Dubai still for this CONTENT act (hybrid conversion).
 * A night skyline suits the closing "go deeper" bridge. The card above it is
 * white frosted glass (.v17-glass-white); a lighter legibility scrim sits over
 * the photo so the header reads light-on-photo while the card stays light.
 */
const BG_IMG = "/cinema/v17/bg/dubai-night.jpg";

/** The four currencies surfaced in the bridge note, in spec order. */
const NOTE_CURRENCIES: Currency[] = ["AED", "USD", "INR", "GBP"];

/**
 * Reference benchmark used purely to ILLUSTRATE the multi-currency note.
 * 1,000,000 AED is a neutral round unit, not a market price/volume claim —
 * it simply demonstrates that the same figure reads in any of the visitor's
 * currencies. Conversion uses the live FxProvider snapshot, or its cited
 * fallback rates when the feed is unavailable.
 */
const NOTE_BASIS_AED = 1_000_000;

function ArrowGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43l-.48-.01c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export default function CrossLinkAct() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const washRef = useRef<HTMLDivElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  const { currency, snapshot } = useFx();

  // ── Scroll-reveal + subtle parallax ──────────────────────────────────────
  useEffect(() => {
    const section = sectionRef.current;
    const reveal = revealRef.current;
    if (!section || !reveal) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion → snap everything visible, no scroll machinery.
    if (prefersReduced) {
      reveal.style.opacity = "1";
      reveal.style.transform = "none";
      const kids = reveal.querySelectorAll<HTMLElement>("[data-reveal-item]");
      kids.forEach((k) => {
        k.style.opacity = "1";
        k.style.transform = "none";
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal-item]", reveal);

      gsap.fromTo(
        items,
        { opacity: 0, y: 34 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "expo.out",
          stagger: 0.09,
          scrollTrigger: {
            trigger: reveal,
            start: "top 82%",
            once: true,
          },
        }
      );

      // Subtle parallax drift on the ambient cobalt wash as the act scrolls by.
      if (washRef.current) {
        gsap.fromTo(
          washRef.current,
          { yPercent: -8 },
          {
            yPercent: 8,
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

    return () => ctx.revert();
  }, []);

  // Live multi-currency note. Falls back to the provider's cited snapshot
  // rates when the live feed is unavailable — values are never invented.
  const noteChips = NOTE_CURRENCIES.map((code) => {
    const meta = CURRENCY_META[code];
    const value = snapshot
      ? formatCurrency(convertAedTo(NOTE_BASIS_AED, code, snapshot), code, {
          compact: true,
        })
      : code === "AED"
        ? formatCurrency(NOTE_BASIS_AED, "AED", { compact: true })
        : null;
    return { code, meta, value };
  });

  return (
    <section
      ref={sectionRef}
      aria-labelledby="crosslink-heading"
      style={{
        position: "relative",
        minHeight: "70svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(4rem, 10vh, 7rem) var(--pad, clamp(1rem, 4vw, 4rem))",
        background: "transparent",
        color: "var(--ink, #EAF0FA)",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Full-bleed real Dubai still + lighter legibility scrim (self-contained).
          This CONTENT act carries its own photo background — the shell no longer
          provides a shared WebGL world behind it. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BG_IMG} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,14,28,0.62) 0%, rgba(8,14,28,0.34) 42%, rgba(8,14,28,0.62) 100%)",
          }}
        />
      </div>

      {/* Ambient cobalt grade over the photo — drifts on scroll (parallax).
          Keeps the cinematic register; decorative only. */}
      <div
        ref={washRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-18% -10%",
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(48% 42% at 78% 18%, var(--gold-glow, rgba(37,99,235,0.22)) 0%, transparent 62%)," +
            "radial-gradient(42% 38% at 14% 82%, rgba(91,165,245,0.16) 0%, transparent 65%)," +
            "radial-gradient(54% 46% at 50% 50%, rgba(37,99,235,0.14) 22%, transparent 72%)",
          filter: "blur(46px)",
          willChange: "transform",
        }}
      />

      {/* Hairline top rule — sectional separation from the act above. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background:
            "linear-gradient(to right, transparent, var(--gold-soft, rgba(37,99,235,0.10)) 18%, var(--gold, #2563EB) 50%, var(--gold-soft, rgba(37,99,235,0.10)) 82%, transparent)",
          opacity: 0.7,
          zIndex: 2,
        }}
      />

      {/* Section header — light-on-photo (sits above the white card). */}
      <div
        ref={revealRef}
        style={{
          position: "relative",
          zIndex: 2,
          width: "min(100%, 880px)",
        }}
      >
        {/* Eyebrow — light-on-photo */}
        <div
          data-reveal-item
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.7rem",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(234,240,250,0.78)",
            marginBottom: "1.25rem",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "26px",
              height: "1px",
              // bright cobalt on the dark photo
              background: "var(--gold-bright, #5BA5F5)",
              flexShrink: 0,
            }}
          />
          05 / Go Deeper
        </div>

        {/* Frosted WHITE-glass bridge card (CONTENT act) — ink text inside. */}
        <div
          className="v17-glass-white"
          style={{
            position: "relative",
            width: "100%",
            padding: "clamp(2rem, 5vw, 3.5rem)",
            borderRadius: "28px",
          }}
        >
          {/* Kinetic Fraunces heading — ONE cobalt-italic accent word. */}
          <KineticHeadline
            as="h2"
            className="editorial-h2"
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 5.2vw, 3.4rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              // INK heading on the white card
              color: "#14203a",
              maxWidth: "18ch",
            }}
          >
            <span data-reveal-item style={{ display: "inline" }}>
              For the institutional Note — and{" "}
              <em
                className="editorial-italic"
                style={{
                  fontStyle: "italic",
                  // DEEP cobalt accent on white
                  color: "#1D4ED8",
                }}
              >
                mandates.
              </em>
            </span>
          </KineticHeadline>

          {/* Sub-copy — qualitative only, no fabricated figures. */}
          <p
            data-reveal-item
            style={{
              margin: "1.25rem 0 0",
              maxWidth: "54ch",
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: "clamp(1rem, 1.4vw, 1.125rem)",
              lineHeight: 1.6,
              // INK body on white
              color: "#38445c",
            }}
          >
          This desk is the public read. The deeper work — feasibility studies,
          area analysis, and advisory mandates — lives on the main practice,
          where Raj works as a real-estate consultant, urban &amp; regional
          planner, and feasibility analyst.
        </p>

        {/* CTA row */}
        <div
          data-reveal-item
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.875rem",
            marginTop: "2rem",
          }}
        >
          {/* Primary — the consultancy funnel */}
          <a
            href={ROOT_URL}
            data-cursor-label="Visit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.95rem 1.6rem",
              borderRadius: "999px",
              background: "var(--gold, #2563EB)",
              color: "#FBF8F2",
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              border: "1px solid var(--gold-deep, #1D4ED8)",
              boxShadow: "0 10px 30px -12px var(--gold-glow, rgba(37,99,235,0.22))",
              transition:
                "transform 240ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)), box-shadow 240ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)), background 240ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.background = "var(--gold-deep, #1D4ED8)";
              e.currentTarget.style.boxShadow =
                "0 16px 38px -12px var(--gold-glow, rgba(37,99,235,0.22))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = "var(--gold, #2563EB)";
              e.currentTarget.style.boxShadow =
                "0 10px 30px -12px var(--gold-glow, rgba(37,99,235,0.22))";
            }}
          >
            <span>Enter the practice</span>
            <ArrowGlyph />
          </a>

          {/* WhatsApp — direct line (white-card ghost: ink text, cobalt hover) */}
          <a
            href={`https://wa.me/${WHATSAPP_E164}`}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor-label="Message"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.95rem 1.5rem",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.5)",
              color: "#14203a",
              fontFamily: "var(--font-body), system-ui, sans-serif",
              fontSize: "0.9375rem",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              border: "1px solid rgba(20,32,58,0.16)",
              transition:
                "border-color 280ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)), color 280ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)), transform 280ms var(--ease-out, cubic-bezier(0.16,1,0.3,1))",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563EB";
              e.currentTarget.style.color = "#1D4ED8";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(20,32,58,0.16)";
              e.currentTarget.style.color = "#14203a";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <WhatsAppGlyph />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {WHATSAPP_DISPLAY}
            </span>
          </a>
        </div>

        {/* Currency note — wired to FxProvider. AED / USD / INR / GBP. */}
        <div
          data-reveal-item
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem 1rem",
            marginTop: "2.25rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(37,99,235,0.16)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: "0.625rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              // INK faint on white
              color: "#6b7488",
            }}
          >
            Read in your currency
          </span>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {noteChips.map(({ code, meta, value }) => {
              const active = code === currency;
              return (
                <span
                  key={code}
                  title={meta.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: "0.4rem",
                    padding: "0.3rem 0.6rem",
                    borderRadius: "100px",
                    border: `1px solid ${
                      active ? "#2563EB" : "rgba(20,32,58,0.16)"
                    }`,
                    background: active
                      ? "rgba(37,99,235,0.10)"
                      : "transparent",
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.12em",
                    // INK muted (inactive) / DEEP cobalt (active) on white
                    color: active ? "#1D4ED8" : "#6b7488",
                    transition: "border-color 200ms ease, background 200ms ease, color 200ms ease",
                  }}
                >
                  <span style={{ textTransform: "uppercase" }}>{code}</span>
                  {value && (
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        // INK body on white
                        color: "#38445c",
                      }}
                    >
                      {value}
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {/* The real, persisted site-wide currency picker. */}
          <CurrencyPicker className="ml-auto" />
        </div>
        </div>
      </div>
    </section>
  );
}
