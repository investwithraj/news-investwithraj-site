"use client";

import dynamic from "next/dynamic";
import StatBlock from "@/components/v16/StatBlock";
import CTAPill from "@/components/v16/CTAPill";

const Earth3D = dynamic(() => import("@/components/v16/Earth3D"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        background: "var(--v16-paper-cool)",
        borderRadius: "var(--v16-radius-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--v16-ink-faint)",
        fontFamily: "var(--v16-font-mono), monospace",
        fontSize: "0.75rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
      }}
    >
      Initializing globe…
    </div>
  ),
});

/**
 * v16 Reach — homepage room showing buyer geography.
 *
 * Three.js Earth centerpiece + diaspora stats sidebar. Auto-rotates,
 * draggable, hover-to-reveal city pin tooltips with buyer counts.
 *
 * Reference: spatial.com globe (Screenshot 2026-05-27 100642.png).
 */
export default function Reach() {
  return (
    <section
      style={{
        padding: "120px 24px",
        background: "var(--v16-paper-cool)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: "80px",
          alignItems: "center",
        }}
        className="v16-reach-grid"
      >
        {/* Left — copy + stats */}
        <div>
          <p className="v16-mono" style={{ marginBottom: "16px" }}>
            04 · The Reach
          </p>
          <h2
            className="v16-h2"
            style={{
              marginBottom: "24px",
              fontSize: "clamp(2.5rem, 5vw, 4.75rem)",
            }}
          >
            Where your{" "}
            <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>
              buyers
            </span>{" "}
            come from.
          </h2>
          <p
            className="v16-body"
            style={{
              marginBottom: "48px",
              maxWidth: "44ch",
              fontSize: "1.075rem",
              color: "var(--v16-ink-soft)",
            }}
          >
            UAE primary. India diaspora. US + UK + Singapore + Hong Kong cross-border.
            Twelve named cities, every active mandate. Hover any pin to see the count.
          </p>

          {/* Diaspora stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "32px",
              marginBottom: "40px",
            }}
          >
            <StatBlock value="UAE" unit="Primary" label="Domestic base" size="md" />
            <StatBlock value="India" unit="Diaspora" label="Mumbai · Delhi · BLR" size="md" />
            <StatBlock value="US + UK" unit="Cross-border" label="NY · SF · London" size="md" />
            <StatBlock value="Asia" unit="Family office" label="Singapore · Hong Kong" size="md" />
          </div>

          <CTAPill variant="graphite" size="lg" href="/areas">
            Explore by region
          </CTAPill>
        </div>

        {/* Right — Earth */}
        <div
          style={{
            borderRadius: "var(--v16-radius-lg)",
            padding: "24px",
            background: "var(--v16-paper-pure)",
            border: "1px solid var(--v16-chrome)",
            boxShadow: "var(--v16-shadow-portrait)",
          }}
        >
          <Earth3D autoRotate />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-reach-grid {
            grid-template-columns: 1fr !important;
            gap: 48px !important;
          }
        }
      `}</style>
    </section>
  );
}
