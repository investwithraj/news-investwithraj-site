import HolographicTerminal from "@/components/v16/sections/HolographicTerminal";
import GlassCard from "@/components/v16/GlassCard";
import CTAPill from "@/components/v16/CTAPill";
import DataPanel from "@/components/v16/DataPanel";

/**
 * /v16 news homepage — HolographicTerminal hero + DLD ticker + latest reads.
 *
 * Mirrors the v16 design system from investwithraj.com but uses a different
 * primary hero (terminal instead of Brandly portrait) reflecting the news
 * subdomain's role: daily UAE real-estate intelligence feed.
 */
const LATEST_READS = [
  {
    eyebrow: "Hudayriyat · Modon",
    title: "Phase 2 launch dated September 2026 — pricing leak suggests 8% above phase 1",
    publishedAt: "2h ago",
    excerpt:
      "A Modon internal deck circulated last week shows phase 2 indicative pricing at AED 3,020-4,535/sqft, an 8% step above the phase 1 ladder.",
  },
  {
    eyebrow: "Palm Jebel Ali · Nakheel",
    title: "Frond G-K opening Q3 2026 — investor allocation guidance tightens",
    publishedAt: "5h ago",
    excerpt:
      "Nakheel has communicated to broker partners that frond G-K will require investor pre-qualification this cycle.",
  },
  {
    eyebrow: "Saadiyat Reserve",
    title: "First secondary trade since Q4 2024 — AED 6,120/sqft, +5.5% over last comp",
    publishedAt: "1d ago",
    excerpt:
      "TDIC-listed villa traded last week at AED 6,120/sqft, the first comparable secondary trade in 18 months.",
  },
  {
    eyebrow: "Wynn Al Marjan",
    title: "Pre-opening occupancy projections revised upward by JLL — 71% Y1",
    publishedAt: "1d ago",
    excerpt:
      "JLL's updated projection raises Wynn Al Marjan's year-one stabilized occupancy from 64% to 71% based on regional demand data.",
  },
  {
    eyebrow: "Dubai 2040",
    title: "RTA confirms Blue Line metro alignment — three new station boundaries published",
    publishedAt: "2d ago",
    excerpt:
      "The RTA has published final station boundary maps for the Blue Line metro extension, opening September 2029.",
  },
];

export default function NewsV16Home() {
  return (
    <>
      <HolographicTerminal />

      {/* Today's reads */}
      <section
        style={{
          padding: "96px 24px",
          background: "var(--v16-paper-cool)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "32px",
              marginBottom: "48px",
            }}
          >
            <div>
              <p className="v16-mono" style={{ marginBottom: "16px", color: "var(--v16-electric)" }}>
                Today · 5 verified-source reads
              </p>
              <h2 className="v16-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                The{" "}
                <span className="v16-h1-italic">read.</span>
              </h2>
            </div>
            <CTAPill variant="paper" size="md" href="/v16/articles">
              All articles
            </CTAPill>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            {LATEST_READS.map((read, i) => (
              <GlassCard key={i} padding="lg" interactive>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 1fr 100px",
                    gap: "32px",
                    alignItems: "center",
                  }}
                  className="v16-read-row"
                >
                  <p className="v16-mono" style={{ color: "var(--v16-electric)" }}>
                    {read.eyebrow}
                  </p>
                  <div>
                    <h3 className="v16-h3" style={{ marginBottom: "8px", fontSize: "1.25rem" }}>
                      {read.title}
                    </h3>
                    <p
                      className="v16-body"
                      style={{ fontSize: "0.95rem", color: "var(--v16-ink-muted)" }}
                    >
                      {read.excerpt}
                    </p>
                  </div>
                  <p
                    className="v16-mono"
                    style={{ color: "var(--v16-ink-muted)", textAlign: "right" }}
                  >
                    {read.publishedAt}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-read-row {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>

      {/* Sources strip */}
      <section
        style={{
          padding: "64px 24px",
          background: "var(--v16-paper)",
          borderTop: "1px solid var(--v16-chrome)",
          borderBottom: "1px solid var(--v16-chrome)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <p
            className="v16-mono"
            style={{
              marginBottom: "32px",
              color: "var(--v16-ink-muted)",
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
            }}
          >
            Cited primary sources
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "12px",
            }}
            className="v16-sources-grid"
          >
            {["DLD", "RERA", "Khaleej Times", "Arabian Business", "Knight Frank", "JLL"].map(
              (s) => (
                <div
                  key={s}
                  style={{
                    aspectRatio: "16 / 5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--v16-paper-pure)",
                    border: "1px solid var(--v16-chrome)",
                    borderRadius: "var(--v16-radius-md)",
                    fontFamily: "var(--v16-font-mono), monospace",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--v16-ink-muted)",
                    textAlign: "center",
                    padding: "0 8px",
                  }}
                >
                  {s}
                </div>
              )
            )}
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-sources-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }
          }
        `}</style>
      </section>

      {/* Engine stats */}
      <section style={{ padding: "96px 24px", background: "var(--v16-paper-cool)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p
            className="v16-mono"
            style={{
              marginBottom: "16px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            The Engine · /v16
          </p>
          <h2 className="v16-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: "48px" }}>
            The numbers behind{" "}
            <span className="v16-h1-italic">the read.</span>
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "16px",
              maxWidth: "1080px",
              margin: "0 auto",
            }}
            className="v16-engine-grid"
          >
            <DataPanel eyebrow="Articles to date" value="2,400+" delta={{ value: "+11 today", trend: "up" }} variant="holo" />
            <DataPanel eyebrow="Primary sources" value="34" delta={{ value: "Verified", trend: "flat" }} variant="light" />
            <DataPanel eyebrow="Daily readers" value="8K+" delta={{ value: "+22% MoM", trend: "up" }} variant="light" />
            <DataPanel eyebrow="Avg time on site" value="6:42" delta={{ value: "Industry: 1:48", trend: "up" }} variant="light" />
          </div>

          <div style={{ marginTop: "48px" }}>
            <CTAPill variant="graphite" size="lg" href="/v16/articles">
              Read today&apos;s edition
            </CTAPill>
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            .v16-engine-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
        `}</style>
      </section>
    </>
  );
}
