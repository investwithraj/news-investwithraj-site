import Link from "next/link";
import GlassCard from "@/components/v16/GlassCard";
import CTAPill from "@/components/v16/CTAPill";
import { getAllArticles } from "@/content/articles";

export const metadata = {
  title: "Articles · v16",
  description:
    "Investor-grade reads on UAE real estate — weekly DLD round-ups, monthly area deep-dives, plot watchlists, and quarterly cycle reads.",
  robots: { index: false, follow: false },
};

/** /v16/articles — index. Lists published articles; pre-launch empty state. */
export default function ArticlesIndexPage() {
  const articles = getAllArticles();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--v16-paper)",
        color: "var(--v16-ink)",
        paddingTop: "120px",
        paddingBottom: "120px",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px" }}>
        {/* Hero */}
        <header style={{ marginBottom: "64px" }}>
          <p className="v16-mono" style={{ marginBottom: "20px" }}>
            Articles · /v16/articles
          </p>
          <h1
            className="v16-h1"
            style={{
              marginBottom: "32px",
              fontSize: "clamp(2.75rem, 7vw, 6rem)",
            }}
          >
            The{" "}
            <span className="v16-h1-italic">archive.</span>
          </h1>
          <p
            className="v16-body"
            style={{ maxWidth: "60ch", fontSize: "1.15rem", color: "var(--v16-ink-soft)" }}
          >
            Reads on UAE real estate &mdash; weekly DLD transaction round-ups,
            monthly area deep-dives, plot watchlists, ad-hoc launch notes, and
            quarterly cycle reads. Every piece cites primary sources.
          </p>
        </header>

        {/* Empty state OR article list */}
        {articles.length === 0 ? (
          <GlassCard padding="lg" variant="holo">
            <p
              style={{
                fontFamily: "var(--v16-font-display), Georgia, serif",
                fontSize: "1.5rem",
                fontWeight: 500,
                lineHeight: 1.3,
                marginBottom: "16px",
              }}
            >
              First piece ships{" "}
              <span style={{ fontStyle: "italic", color: "var(--v16-brass)" }}>
                2026.
              </span>
            </p>
            <p className="v16-body" style={{ marginBottom: "16px" }}>
              The article pipeline is set up and the cadence is locked at 2&ndash;3
              pieces per week sustainable. Sources, topics, and the brief &rarr;
              draft &rarr; edit &rarr; publish flow are documented at{" "}
              <code style={{ fontFamily: "var(--v16-font-mono), monospace" }}>
                ~/MEDIA/_CATALOG/V16-NEWS-PIPELINE.md
              </code>
              .
            </p>
            <p className="v16-body">
              Articles will appear here in published order &mdash; never before.
              No fabricated headlines, no anonymous insider quotes, no
              filler.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/v16/articles/${a.slug}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <GlassCard padding="lg" interactive>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 1fr 100px",
                      gap: "24px",
                      alignItems: "center",
                    }}
                    className="v16-article-row"
                  >
                    <p
                      className="v16-mono"
                      style={{ color: "var(--v16-electric)" }}
                    >
                      {a.section}
                    </p>
                    <div>
                      <h2
                        className="v16-h3"
                        style={{ marginBottom: "8px", fontSize: "1.5rem" }}
                      >
                        {a.title}
                      </h2>
                      <p
                        className="v16-body"
                        style={{
                          fontSize: "0.95rem",
                          color: "var(--v16-ink-muted)",
                        }}
                      >
                        {a.dek}
                      </p>
                    </div>
                    <p
                      className="v16-mono"
                      style={{
                        color: "var(--v16-ink-muted)",
                        textAlign: "right",
                      }}
                    >
                      {a.publishedAt}
                    </p>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}

        {/* Pipeline explainer + CTA */}
        <section style={{ marginTop: "64px" }}>
          <h2
            className="v16-h2"
            style={{
              marginBottom: "24px",
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
            }}
          >
            How the{" "}
            <span className="v16-h1-italic">pipeline</span> works.
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "16px",
              marginBottom: "32px",
            }}
            className="v16-articles-pipeline-grid"
          >
            <GlassCard padding="md">
              <h3
                className="v16-h3"
                style={{ fontSize: "1.1rem", marginBottom: "8px" }}
              >
                Weekly &mdash; DLD round-up
              </h3>
              <p
                className="v16-body"
                style={{ fontSize: "0.9rem", color: "var(--v16-ink-muted)" }}
              >
                Every Monday AM. Previous-week DLD transaction CSV &rarr; top
                movers, biggest trades, drift.
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <h3
                className="v16-h3"
                style={{ fontSize: "1.1rem", marginBottom: "8px" }}
              >
                Monthly &mdash; Area deep-dive
              </h3>
              <p
                className="v16-body"
                style={{ fontSize: "0.9rem", color: "var(--v16-ink-muted)" }}
              >
                One area, end-to-end. Rotates across Palm Jebel Ali, Hudayriyat,
                Saadiyat, MBR City, Wynn / Al Marjan.
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <h3
                className="v16-h3"
                style={{ fontSize: "1.1rem", marginBottom: "8px" }}
              >
                Monthly &mdash; Plot watchlist
              </h3>
              <p
                className="v16-body"
                style={{ fontSize: "0.9rem", color: "var(--v16-ink-muted)" }}
              >
                What plot owners are signalling. The secondary land market read
                most brokers skip.
              </p>
            </GlassCard>
            <GlassCard padding="md">
              <h3
                className="v16-h3"
                style={{ fontSize: "1.1rem", marginBottom: "8px" }}
              >
                Quarterly &mdash; Cycle read
              </h3>
              <p
                className="v16-body"
                style={{ fontSize: "0.9rem", color: "var(--v16-ink-muted)" }}
              >
                Long-read on cycle stage. Volume, pricing, primary-vs-secondary,
                finance availability.
              </p>
            </GlassCard>
          </div>
          <CTAPill variant="paper" size="md" href="https://investwithraj.com/v16/newsletter">
            Get pieces in your inbox
          </CTAPill>
        </section>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .v16-article-row,
          .v16-articles-pipeline-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
