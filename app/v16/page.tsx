"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import CTAPill from "@/components/v16/CTAPill";
import { SOURCE_WHITELIST } from "@/lib/sources/registry";

/**
 * /v16 news homepage — REWRITTEN (May 28 2026 design pass).
 *
 * Previous design: HolographicTerminal hero (v13-era Bloomberg-style
 * aerospace component) + 5 grid cards of upcoming sections + sources
 * strip + 4 DataPanels of engine stats. Felt "still living in the past"
 * per user feedback — too gimmicky / cluttered for a research publication
 * front page.
 *
 * NEW design follows the main site's restructure (May 28 2026):
 *   - Full-bleed Dubai aerial video, no scrim across the whole hero,
 *     left-aligned frosted glass panel holds the position statement.
 *   - Editorial publication list (NOT card grid) for the 5 planned
 *     sections. Each row = eyebrow + headline + 1-line dek + cadence
 *     label, separated by hairlines.
 *   - Cited primary sources rendered as elegant typography (not aspect-
 *     ratio'd boxes).
 *   - Editorial principle band — 3 commitments in a calm horizontal row.
 *   - Single CTA close.
 *
 * The HolographicTerminal component stays in the codebase (could land at
 * /v16/terminal as a dedicated route in a follow-up) — just not on the
 * homepage anymore.
 */

const HERO_BACKDROP = "/cinema/library/hero-dubai-coast.mp4";

const PLANNED_SECTIONS = [
  {
    cadence: "Weekly · Monday AM",
    section: "DLD transaction round-up",
    dek: "Previous-week Dubai Land Department transaction CSV → top movers by area, biggest trades, week-on-week median PSF drift.",
  },
  {
    cadence: "Monthly",
    section: "Area deep-dive",
    dek: "One area, end-to-end. Rotating across Palm Jebel Ali, Hudayriyat, Saadiyat, MBR City, Wynn / Al Marjan.",
  },
  {
    cadence: "Monthly",
    section: "Plot-owner watchlist",
    dek: "What plot owners are listing, what's actually trading, where land prices are reading the cycle ahead of villas. The secondary land tier most brokers skip.",
  },
  {
    cadence: "Ad-hoc",
    section: "Developer launch notes",
    dek: "When a real primary launch warrants a piece — spec, pricing band, payment plan, comparable existing stock. Only the ones with a defensible thesis.",
  },
  {
    cadence: "Quarterly",
    section: "Cycle read",
    dek: "Where Dubai is on the cycle. Volume, pricing, primary-vs-secondary split, off-plan vs ready, finance availability. Built from DLD + Knight Frank + JLL + Property Finder data.",
  },
];

export default function NewsV16Home() {
  const backdropRef = useRef<HTMLVideoElement | null>(null);

  // Autoplay-policy fallback on first user gesture.
  useEffect(() => {
    const v = backdropRef.current;
    if (!v) return;
    const retry = () => {
      v.play().catch(() => undefined);
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("scroll", retry);
    };
    v.play().catch(() => {
      window.addEventListener("pointerdown", retry, { once: true, passive: true });
      window.addEventListener("keydown", retry, { once: true });
      window.addEventListener("scroll", retry, { once: true, passive: true });
    });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      window.removeEventListener("scroll", retry);
    };
  }, []);

  return (
    <>
      {/* ─── HERO — full-bleed video + left-aligned glass panel ──────── */}
      <section
        style={{
          minHeight: "100svh",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          padding: "120px 24px 80px",
          background: "var(--v16-ink-deep)",
        }}
      >
        <video
          ref={backdropRef}
          src={HERO_BACKDROP}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
            opacity: 1,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, " +
              "rgba(10, 14, 20, 0.28) 0%, " +
              "rgba(10, 14, 20, 0.00) 18%, " +
              "rgba(10, 14, 20, 0.00) 75%, " +
              "rgba(10, 14, 20, 0.32) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: "1440px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="v16-news-hero-panel"
            style={{
              maxWidth: "620px",
              padding: "44px 48px",
              borderRadius: "var(--v16-radius-lg)",
              background: "rgba(255, 255, 255, 0.78)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(255, 255, 255, 0.45)",
              boxShadow:
                "0 24px 72px -16px rgba(10, 14, 20, 0.32), " +
                "0 1px 0 rgba(255, 255, 255, 0.55) inset",
              color: "var(--v16-ink)",
            }}
          >
            <p
              className="v16-mono"
              style={{
                marginBottom: "20px",
                color: "var(--v16-ink-muted)",
              }}
            >
              NEWS · INVEST WITH RAJ
            </p>
            <h1
              className="v16-h1"
              style={{
                marginBottom: "24px",
                maxWidth: "16ch",
                fontSize: "clamp(2.5rem, 5vw, 4.25rem)",
                color: "var(--v16-ink)",
              }}
            >
              Dubai property. Read like{" "}
              <span
                className="v16-h1-italic"
                style={{ color: "var(--v16-brass)" }}
              >
                an analyst.
              </span>
            </h1>
            <p
              className="v16-body"
              style={{
                marginBottom: "32px",
                maxWidth: "52ch",
                fontSize: "1.05rem",
                lineHeight: 1.55,
                color: "var(--v16-ink-soft)",
              }}
            >
              A research publication on UAE real estate. Every piece cites
              primary sources. Every piece passes a voice-profile gate.
              Every piece is edited by Raj before publication.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              <CTAPill variant="graphite" size="lg" href="https://investwithraj.com/v16/newsletter">
                Subscribe
              </CTAPill>
              <Link
                href="/v16/articles"
                className="v16-mono"
                style={{
                  color: "var(--v16-ink-muted)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--v16-ink-faint)",
                  paddingBottom: "2px",
                }}
              >
                Article archive ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Coming in 2026 — editorial publication list ─────────────── */}
      <section
        style={{
          padding: "120px 24px",
          background: "var(--v16-paper)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "32px",
              marginBottom: "56px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="v16-mono" style={{ marginBottom: "16px" }}>
                01 · The lineup
              </p>
              <h2
                className="v16-h2"
                style={{
                  fontSize: "clamp(2.25rem, 4vw, 3.5rem)",
                  maxWidth: "18ch",
                  lineHeight: 1.05,
                }}
              >
                Five sections.{" "}
                <span className="v16-h1-italic">One discipline.</span>
              </h2>
            </div>
            <p
              className="v16-body"
              style={{
                maxWidth: "32ch",
                fontSize: "0.95rem",
                color: "var(--v16-ink-muted)",
              }}
            >
              First piece publishes 2026, once the auto-draft + editorial
              review pipeline is online.
            </p>
          </div>

          {/* Editorial list — hairline-separated rows, not card grid */}
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              borderTop: "1px solid var(--v16-chrome)",
            }}
          >
            {PLANNED_SECTIONS.map((s, i) => (
              <li
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px minmax(0, 1fr)",
                  gap: "32px",
                  padding: "32px 0",
                  borderBottom: "1px solid var(--v16-chrome)",
                }}
                className="v16-news-list-row"
              >
                <p
                  className="v16-mono"
                  style={{
                    color: "var(--v16-electric)",
                    fontSize: "0.6875rem",
                  }}
                >
                  {s.cadence}
                </p>
                <div>
                  <h3
                    className="v16-h3"
                    style={{
                      marginBottom: "10px",
                      fontSize: "clamp(1.25rem, 2vw, 1.75rem)",
                    }}
                  >
                    {s.section}
                  </h3>
                  <p
                    className="v16-body"
                    style={{
                      fontSize: "1rem",
                      color: "var(--v16-ink-soft)",
                      maxWidth: "62ch",
                      lineHeight: 1.55,
                    }}
                  >
                    {s.dek}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-news-list-row {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }
        `}</style>
      </section>

      {/* ─── Cited sources — elegant typography ──────────────────────── */}
      <section
        style={{
          padding: "96px 24px",
          background: "var(--v16-paper-cool)",
          borderTop: "1px solid var(--v16-chrome)",
          borderBottom: "1px solid var(--v16-chrome)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p
            className="v16-mono"
            style={{ marginBottom: "16px" }}
          >
            02 · Primary sources cited
          </p>
          <h2
            className="v16-h2"
            style={{
              fontSize: "clamp(2rem, 3.5vw, 3rem)",
              maxWidth: "22ch",
              lineHeight: 1.05,
              marginBottom: "48px",
            }}
          >
            Every claim traces back to{" "}
            <span className="v16-h1-italic">one of these.</span>
          </h2>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px 32px",
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.8125rem",
              letterSpacing: "0.12em",
              color: "var(--v16-ink-soft)",
            }}
            className="v16-sources-list"
          >
            {SOURCE_WHITELIST.map((src) => (
              <li
                key={src.url}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px dashed var(--v16-chrome)",
                }}
              >
                {src.name}
              </li>
            ))}
          </ul>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-sources-list {
              grid-template-columns: 1fr !important;
            }
          }
          @media (min-width: 769px) and (max-width: 1024px) {
            .v16-sources-list {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
        `}</style>
      </section>

      {/* ─── Editorial principle ─────────────────────────────────────── */}
      <section
        style={{
          padding: "120px 24px",
          background: "var(--v16-paper)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
          <p className="v16-mono" style={{ marginBottom: "20px" }}>
            03 · The principle
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "48px",
            }}
            className="v16-principle-grid"
          >
            <PrincipleBlock
              n="01"
              title="Cited"
              body="Every numeric claim traces to a citable primary source. No anonymous insiders. No fabricated transaction figures."
            />
            <PrincipleBlock
              n="02"
              title="Voice-gated"
              body="Every draft passes a machine-readable voice profile (0 banned-lexicon hits, ≥3 approved phrases, headline ≤90 chars, paragraph 1 contains a number)."
            />
            <PrincipleBlock
              n="03"
              title="Editor-approved"
              body="Every piece is reviewed and approved by Raj before it publishes. The single byline. No ghost-authoring, no syndicated filler."
            />
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-principle-grid {
              grid-template-columns: 1fr !important;
              gap: 32px !important;
            }
          }
        `}</style>
      </section>

      {/* ─── Close CTA ──────────────────────────────────────────────── */}
      <section
        style={{
          padding: "96px 24px 120px",
          background: "var(--v16-paper-cool)",
          textAlign: "center",
        }}
      >
        <p className="v16-mono" style={{ marginBottom: "20px", display: "inline-flex", justifyContent: "center" }}>
          04 · Stay close
        </p>
        <h2
          className="v16-h2"
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            maxWidth: "20ch",
            margin: "0 auto 24px",
            lineHeight: 1.05,
          }}
        >
          Get the first piece in your{" "}
          <span className="v16-h1-italic">inbox.</span>
        </h2>
        <p
          className="v16-body"
          style={{ maxWidth: "48ch", margin: "0 auto 40px" }}
        >
          One-click unsubscribe. No partner shares. No tracking pixels.
        </p>
        <CTAPill variant="graphite" size="lg" href="https://investwithraj.com/v16/newsletter">
          Subscribe to Beyond the Deal
        </CTAPill>
      </section>
    </>
  );
}

function PrincipleBlock({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p
        className="v16-mono"
        style={{ color: "var(--v16-holo-deep)", marginBottom: "12px" }}
      >
        {n}
      </p>
      <h3
        className="v16-h3"
        style={{ fontSize: "1.5rem", marginBottom: "12px" }}
      >
        {title}
      </h3>
      <p
        className="v16-body"
        style={{
          fontSize: "0.95rem",
          color: "var(--v16-ink-soft)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
    </div>
  );
}
