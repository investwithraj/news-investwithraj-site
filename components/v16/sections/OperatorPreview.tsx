"use client";

import CTAPill from "@/components/v16/CTAPill";
import PortraitFrame from "@/components/v16/PortraitFrame";
import GlassCard from "@/components/v16/GlassCard";

/**
 * v16 OperatorPreview — homepage "Who is Raj" teaser.
 *
 * One-screen condensed version of the /operator page. Asymmetric grid:
 *   Left  — copy + 3 credential pills + CTA to /operator
 *   Right — portrait video frame
 *
 * Light register (Brandly-style). Dark variant exists on the full /operator page.
 */
export default function OperatorPreview() {
  return (
    <section
      style={{
        padding: "120px 24px",
        background: "var(--v16-paper-cool)",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
          gap: "80px",
          alignItems: "center",
        }}
        className="v16-operator-grid"
      >
        {/* Left — portrait */}
        <div>
          <PortraitFrame
            src="/cinema/library/portrait-operator.mp4"
            poster="/raj-hero.jpg"
            aspect="3:4"
            caption="The Operator · @rajtomar.dxb"
          />
        </div>

        {/* Right — copy */}
        <div>
          <p className="v16-mono" style={{ marginBottom: "16px" }}>
            01 · The Operator
          </p>
          <h2
            className="v16-h2"
            style={{
              marginBottom: "32px",
              fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
            }}
          >
            DLD-licensed. <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>Globally</span> sourced.
          </h2>
          <p
            className="v16-body"
            style={{
              marginBottom: "32px",
              maxWidth: "52ch",
              fontSize: "1.075rem",
              color: "var(--v16-ink-soft)",
            }}
          >
            Ten years across the full property cycle in India and the UAE.
            Serial entrepreneur. International sales — US market in particular.
            Twelve-page institutional notes, curated mandates, and cross-border
            deployment for HNW and UHNW investors.
          </p>

          {/* Credential strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px",
              marginBottom: "40px",
              maxWidth: "560px",
            }}
          >
            <GlassCard padding="md">
              <p className="v16-mono" style={{ marginBottom: "6px", color: "var(--v16-holo-deep)" }}>
                01
              </p>
              <p style={{ fontFamily: "var(--v16-font-display)", fontSize: "1rem", fontWeight: 500 }}>
                MBA Construction Management
              </p>
              <p className="v16-mono" style={{ marginTop: "4px", color: "var(--v16-ink-muted)" }}>
                Mahatma Gandhi University
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <p className="v16-mono" style={{ marginBottom: "6px", color: "var(--v16-holo-deep)" }}>
                02
              </p>
              <p style={{ fontFamily: "var(--v16-font-display)", fontSize: "1rem", fontWeight: 500 }}>
                B.Plan Urban &amp; Regional Planning
              </p>
              <p className="v16-mono" style={{ marginTop: "4px", color: "var(--v16-ink-muted)" }}>
                Manipal University Jaipur
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <p className="v16-mono" style={{ marginBottom: "6px", color: "var(--v16-holo-deep)" }}>
                03
              </p>
              <p style={{ fontFamily: "var(--v16-font-display)", fontSize: "1rem", fontWeight: 500 }}>
                AI Applications Certificate
              </p>
              <p className="v16-mono" style={{ marginTop: "4px", color: "var(--v16-ink-muted)" }}>
                The Wharton School
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <p className="v16-mono" style={{ marginBottom: "6px", color: "var(--v16-holo-deep)" }}>
                04
              </p>
              <p style={{ fontFamily: "var(--v16-font-display)", fontSize: "1rem", fontWeight: 500 }}>
                Major Group at UN-Habitat
              </p>
              <p className="v16-mono" style={{ marginTop: "4px", color: "var(--v16-ink-muted)" }}>
                Children &amp; Youth (UNMGCY)
              </p>
            </GlassCard>
          </div>

          <CTAPill variant="graphite" size="lg" href="/operator">
            Full bio + credentials
          </CTAPill>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-operator-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </section>
  );
}
