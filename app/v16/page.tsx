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
// Pre-launch planned-coverage list. No fictional headlines, no fake timestamps.
// Replaced with real pieces as they ship via the pipeline at
// ~/MEDIA/_CATALOG/V16-NEWS-PIPELINE.md.
const LATEST_READS = [
  {
    eyebrow: "Weekly · DLD round-up",
    title: "Each Monday morning: previous-week DLD transaction round-up",
    publishedAt: "Upcoming",
    excerpt:
      "Aggregated DLD weekly transaction CSV → top movers by area, biggest trades, week-on-week price drift. Auto-drafted from raw data, edited by Raj before publish.",
  },
  {
    eyebrow: "Monthly · Area deep-dive",
    title: "One area, read end-to-end",
    publishedAt: "Upcoming",
    excerpt:
      "Rotating across Palm Jebel Ali, Hudayriyat, Saadiyat, MBR City, Wynn / Al Marjan. Each piece walks master plan, current pricing band, supply pipeline, and the case for / against.",
  },
  {
    eyebrow: "Monthly · Plot watchlist",
    title: "What plot owners are signalling",
    publishedAt: "Upcoming",
    excerpt:
      "Dubai's secondary land market is the most under-reported tier. Monthly notes on what plot owners are listing, what&apos;s actually trading, and where land prices are reading the cycle ahead of villas.",
  },
  {
    eyebrow: "Ad-hoc · Launch notes",
    title: "Developer launch notes when real launches happen",
    publishedAt: "Upcoming",
    excerpt:
      "When a real primary launch warrants a piece, we publish a launch note. Spec, pricing band, payment plan, comparable existing stock. Not every launch &mdash; only the ones with a defensible thesis.",
  },
  {
    eyebrow: "Quarterly · Cycle read",
    title: "Where Dubai is on the cycle — quarterly",
    publishedAt: "Upcoming",
    excerpt:
      "A quarterly long-read on cycle stage. Volume, pricing, primary-vs-secondary split, off-plan vs ready, finance availability. Built from DLD + Knight Frank + JLL + Property Finder data.",
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
                Pre-launch · 5 fixed sections per cycle
              </p>
              <h2 className="v16-h2" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                The{" "}
                <span className="v16-h1-italic">read.</span>
              </h2>
            </div>
            <CTAPill variant="paper" size="md" href="/v16/articles">
              Article archive
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
            {["DLD", "RERA", "Property Finder", "Bayut", "Knight Frank", "JLL"].map(
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
            How the publication{" "}
            <span className="v16-h1-italic">works.</span>
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
            <DataPanel eyebrow="Status" value="Pre-launch" variant="holo" />
            <DataPanel eyebrow="Sustainable cadence" value="2–3/wk" variant="light" />
            <DataPanel eyebrow="Sources" value="DLD · RERA · Reports" variant="light" />
            <DataPanel eyebrow="Pipeline" value="Brief → Edit → Publish" variant="light" />
          </div>

          <div style={{ marginTop: "48px" }}>
            <CTAPill variant="graphite" size="lg" href="/v16/articles">
              Archive
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
