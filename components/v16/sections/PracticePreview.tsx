"use client";

import CTAPill from "@/components/v16/CTAPill";
import PresetRow from "@/components/v16/PresetRow";

/**
 * v16 PracticePreview — homepage Practice teaser.
 *
 * Single-screen "what's on offer" — a tight 6-tile PresetRow followed by
 * a single CTA to /practice for the full breakdown. Light register.
 */
export default function PracticePreview() {
  return (
    <section
      style={{
        padding: "120px 24px",
        background: "var(--v16-paper)",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <p className="v16-mono" style={{ marginBottom: "16px", display: "inline-flex", justifyContent: "center" }}>
          03 · The Practice
        </p>
        <h2
          className="v16-h2"
          style={{
            margin: "0 auto 32px",
            maxWidth: "18ch",
            fontSize: "clamp(2.5rem, 5vw, 5rem)",
          }}
        >
          Six lines.{" "}
          <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>
            One operator.
          </span>
        </h2>
        <p
          className="v16-body"
          style={{
            maxWidth: "60ch",
            margin: "0 auto 56px",
            fontSize: "1.075rem",
            color: "var(--v16-ink-soft)",
          }}
        >
          Each service line corresponds to a moment in the cycle. Mandates open
          when Raj can take them — five active mandates is the ceiling.
        </p>

        <PresetRow
          items={[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="4" width="18" height="20" rx="2" />
                  <path d="M9 9h10M9 13h10M9 17h6" />
                </svg>
              ),
              label: "Investor Notes",
              href: "/notes",
              description: "Twelve-page institutional analysis per development",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="14" cy="14" r="9" />
                  <circle cx="14" cy="14" r="3" />
                </svg>
              ),
              label: "Sourcing",
              href: "/practice#sourcing",
              description: "Off-market deal flow + pre-launch allocation",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 18l5-7 4 5 4-9 5 11" />
                  <path d="M5 23h18" />
                </svg>
              ),
              label: "Portfolio",
              href: "/practice#portfolio",
              description: "Multi-asset strategy across UAE submarkets",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 14l9-9 9 9-9 9z" />
                </svg>
              ),
              label: "Resale",
              href: "/practice#resale",
              description: "Exit timing + buyer matching on the secondary market",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="14" cy="14" r="9" />
                  <path d="M5 14h18M14 5c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" />
                </svg>
              ),
              label: "Cross-border",
              href: "/practice#cross-border",
              description: "Structuring for US, India, UK, Singapore investors",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="5" y="9" width="18" height="14" rx="2" />
                  <path d="M9 9V6a5 5 0 0110 0v3" />
                </svg>
              ),
              label: "Mandates",
              href: "/practice#mandates",
              description: "Exclusive retainer engagements (5 active maximum)",
            },
          ]}
        />

        <div style={{ marginTop: "56px" }}>
          <CTAPill variant="graphite" size="lg" href="/practice">
            See every line in detail
          </CTAPill>
        </div>
      </div>
    </section>
  );
}
