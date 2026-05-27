import { notFound } from "next/navigation";
import Link from "next/link";
import GlassCard from "@/components/v16/GlassCard";
import CTAPill from "@/components/v16/CTAPill";
import { getArticleBySlug, getAllArticles } from "@/content/articles";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article not found", robots: { index: false, follow: false } };
  return {
    title: `${article.title} · v16`,
    description: article.dek,
    robots: { index: false, follow: false },
  };
}

/** /v16/articles/[slug] — individual article. */
export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

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
      <article style={{ maxWidth: "780px", margin: "0 auto", padding: "0 24px" }}>
        {/* Breadcrumb */}
        <Link
          href="/v16/articles"
          style={{
            display: "inline-flex",
            gap: "8px",
            marginBottom: "32px",
            color: "var(--v16-ink-muted)",
            textDecoration: "none",
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          ← All articles
        </Link>

        {/* Header */}
        <header style={{ marginBottom: "48px" }}>
          <p
            className="v16-mono"
            style={{ color: "var(--v16-electric)", marginBottom: "16px" }}
          >
            {article.section}
          </p>
          <h1
            className="v16-h1"
            style={{
              marginBottom: "24px",
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              textTransform: "none",
              lineHeight: 1.1,
            }}
          >
            {article.title}
          </h1>
          <p
            style={{
              fontFamily: "var(--v16-font-display), Georgia, serif",
              fontSize: "clamp(1.05rem, 1.8vw, 1.35rem)",
              lineHeight: 1.45,
              color: "var(--v16-ink-soft)",
              maxWidth: "62ch",
              fontWeight: 400,
              marginBottom: "24px",
            }}
          >
            {article.dek}
          </p>
          <p
            className="v16-mono"
            style={{
              color: "var(--v16-ink-muted)",
              fontSize: "0.6875rem",
            }}
          >
            {article.publishedAt}
            {article.readTimeMin > 0 && ` · ${article.readTimeMin} min read`}
            {article.author && ` · ${article.author}`}
          </p>
        </header>

        {/* Body — plain text paragraphs; upgrade to MDX later */}
        <div
          style={{
            fontFamily: "var(--v16-font-body), system-ui, sans-serif",
            fontSize: "1.075rem",
            lineHeight: 1.7,
            color: "var(--v16-ink)",
            marginBottom: "64px",
          }}
        >
          {article.body.split(/\n\n+/).map((para, i) => (
            <p key={i} style={{ marginBottom: "24px" }}>
              {para}
            </p>
          ))}
        </div>

        {/* Sources cited */}
        {article.sourcesCited.length > 0 && (
          <GlassCard padding="lg" style={{ marginBottom: "48px" }}>
            <p
              className="v16-mono"
              style={{ color: "var(--v16-electric)", marginBottom: "16px" }}
            >
              Sources cited
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {article.sourcesCited.map((src, i) => (
                <li
                  key={i}
                  style={{
                    paddingTop: "8px",
                    paddingBottom: "8px",
                    borderBottom:
                      i < article.sourcesCited.length - 1
                        ? "1px solid var(--v16-chrome)"
                        : "none",
                  }}
                >
                  <a
                    href={src.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{
                      color: "var(--v16-ink)",
                      textDecoration: "none",
                      fontSize: "0.95rem",
                    }}
                  >
                    {src.label} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "64px" }}>
          <CTAPill
            variant="graphite"
            size="lg"
            href="https://investwithraj.com/v16/newsletter"
          >
            Get next pieces by email
          </CTAPill>
        </div>
      </article>
    </div>
  );
}
