"use client";

import CTAPill from "@/components/v16/CTAPill";
import GlassCard from "@/components/v16/GlassCard";
import PortraitFrame from "@/components/v16/PortraitFrame";
import StatBlock from "@/components/v16/StatBlock";

/**
 * v16 HeroBrandly — homepage hero following the Brandly grammar.
 *
 * Layout (locked):
 *   1. Eyebrow tag top-left
 *   2. Massive uppercase serif H1 (60% width, left column)
 *   3. Centered portrait card (40% width, right column)
 *   4. Stat cards stacked top-right of portrait (50+ / 5+ pattern)
 *   5. Subhead paragraph below H1
 *   6. Primary + secondary CTA pills below subhead
 *   7. Optional bottom strip with mono "AS OF · DATE" + scroll cue
 *
 * Reference: Brandly preset screenshot. White-on-white aesthetic.
 *
 * Asset slots for user generation (Higgsfield + ElevenLabs):
 *   • Hero portrait video — W11 wardrobe, SETTING-V2 office, 4:5 aspect, 5s loop
 *     Path: /cinema/v16/hero-portrait.mp4 + hero-portrait-poster.jpg
 *
 * Until those land, the component uses the v15 Bay Villas portrait as placeholder.
 */
interface Props {
  /** override default portrait video src */
  portraitSrc?: string;
  portraitPoster?: string;
}

const DEFAULT_PORTRAIT = "/cinema/library/portrait-hero.mp4";
const DEFAULT_PORTRAIT_POSTER = "/cinema/library/portrait-hero-poster.jpg";

export default function HeroBrandly({
  portraitSrc = DEFAULT_PORTRAIT,
  portraitPoster = DEFAULT_PORTRAIT_POSTER,
}: Props) {
  return (
    <section
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        padding: "120px 24px 80px",
        background: "var(--v16-paper)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "64px",
          alignItems: "center",
        }}
        className="v16-hero-grid"
      >
        {/* ─── LEFT — copy column ─────────────────────────────────────── */}
        <div>
          <p className="v16-mono" style={{ marginBottom: "20px" }}>
            INVEST WITH RAJ · DUBAI 2026
          </p>

          <h1
            className="v16-h1"
            style={{
              marginBottom: "32px",
              maxWidth: "14ch",
            }}
          >
            Building{" "}
            <span
              className="v16-h1-italic"
              style={{ color: "var(--v16-brass)" }}
            >
              wealth
            </span>
            <br />
            across borders.
          </h1>

          <p
            className="v16-body"
            style={{
              marginBottom: "40px",
              maxWidth: "52ch",
              fontSize: "1.15rem",
              color: "var(--v16-ink-soft)",
            }}
          >
            Twelve-page institutional notes, curated mandates, and cross-border
            deployment for serious investors across the UAE — written from a
            corner office on the 47<sup>th</sup> floor.
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: "64px",
            }}
          >
            <CTAPill variant="graphite" size="lg" href="#engage">
              Request the current Note
            </CTAPill>
            <CTAPill variant="paper" size="lg" href="/newsletter">
              Beyond the Deal newsletter
            </CTAPill>
          </div>

          {/* Mono bottom strip — Brandly "Work with us" pattern */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.6875rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--v16-ink-faint)",
            }}
          >
            <span>Engage</span>
            <span aria-hidden="true">→</span>
            <a
              href="https://www.linkedin.com/in/raj-tomar-1470a7242"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--v16-ink-muted)", textDecoration: "none" }}
            >
              LinkedIn
            </a>
            <span aria-hidden="true" style={{ color: "var(--v16-chrome-deep)" }}>·</span>
            <a
              href="https://instagram.com/rajtomar.dxb"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--v16-ink-muted)", textDecoration: "none" }}
            >
              Instagram
            </a>
            <span aria-hidden="true" style={{ color: "var(--v16-chrome-deep)" }}>·</span>
            <a
              href="https://www.youtube.com/@rajtomar"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--v16-ink-muted)", textDecoration: "none" }}
            >
              YouTube
            </a>
          </div>
        </div>

        {/* ─── RIGHT — portrait + stat cards ──────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Stat cards stacked top-right */}
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "-32px",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: "flex-end",
            }}
            className="v16-hero-stats"
          >
            <GlassCard padding="md" interactive>
              <StatBlock value="10+" label="Years across full cycle" size="md" align="right" />
            </GlassCard>
            <GlassCard padding="md" interactive>
              <StatBlock value="474" label="Active mandates 2026" size="md" align="right" />
            </GlassCard>
          </div>

          {/* Portrait */}
          <PortraitFrame
            src={portraitSrc}
            poster={portraitPoster}
            aspect="4:5"
            caption="Raj Tomar · Dubai · 2026"
          />
        </div>
      </div>

      {/* Responsive grid → single column on tablet/mobile */}
      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
          .v16-hero-stats {
            position: static !important;
            flex-direction: row !important;
            justify-content: flex-end !important;
          }
        }
      `}</style>
    </section>
  );
}
