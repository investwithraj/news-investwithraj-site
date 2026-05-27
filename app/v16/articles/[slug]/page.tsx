import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

        {/* Body — GitHub-flavoured markdown rendered by react-markdown.
            Supports headings, paragraphs, lists, links, blockquotes,
            tables, code, and emphasis. Inline images use plain <img>. */}
        <div
          className="v16-article-body"
          style={{
            fontFamily: "var(--v16-font-body), system-ui, sans-serif",
            fontSize: "1.075rem",
            lineHeight: 1.7,
            color: "var(--v16-ink)",
            marginBottom: "64px",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2
                  style={{
                    fontFamily: "var(--v16-font-display), Georgia, serif",
                    fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                    fontWeight: 500,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    margin: "48px 0 16px",
                  }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  style={{
                    fontFamily: "var(--v16-font-display), Georgia, serif",
                    fontSize: "clamp(1.25rem, 2vw, 1.625rem)",
                    fontWeight: 500,
                    lineHeight: 1.2,
                    margin: "32px 0 12px",
                  }}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p style={{ marginBottom: "20px" }}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul
                  style={{
                    margin: "0 0 24px",
                    paddingLeft: "1.25rem",
                    listStyle: "disc",
                  }}
                >
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol
                  style={{
                    margin: "0 0 24px",
                    paddingLeft: "1.25rem",
                    listStyle: "decimal",
                  }}
                >
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li style={{ marginBottom: "6px" }}>{children}</li>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target={href?.startsWith("http") ? "_blank" : undefined}
                  rel={href?.startsWith("http") ? "noreferrer noopener" : undefined}
                  style={{
                    color: "var(--v16-electric)",
                    textDecoration: "underline",
                    textDecorationThickness: "1px",
                    textUnderlineOffset: "3px",
                  }}
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote
                  style={{
                    borderLeft: "3px solid var(--v16-electric)",
                    paddingLeft: "20px",
                    margin: "24px 0",
                    fontFamily: "var(--v16-font-display), Georgia, serif",
                    fontSize: "1.2rem",
                    fontStyle: "italic",
                    color: "var(--v16-ink-soft)",
                  }}
                >
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code
                  style={{
                    fontFamily: "var(--v16-font-mono), monospace",
                    background: "var(--v16-paper-cool)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "0.9em",
                  }}
                >
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre
                  style={{
                    background: "var(--v16-paper-cool)",
                    border: "1px solid var(--v16-chrome)",
                    borderRadius: "var(--v16-radius-md)",
                    padding: "16px 20px",
                    overflowX: "auto",
                    marginBottom: "24px",
                    fontFamily: "var(--v16-font-mono), monospace",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  }}
                >
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div style={{ overflowX: "auto", marginBottom: "24px" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.95rem",
                    }}
                  >
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--v16-chrome-deep)",
                    fontFamily: "var(--v16-font-mono), monospace",
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--v16-ink-muted)",
                  }}
                >
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--v16-chrome)",
                  }}
                >
                  {children}
                </td>
              ),
              hr: () => (
                <hr
                  style={{
                    border: "none",
                    borderTop: "1px solid var(--v16-chrome)",
                    margin: "40px 0",
                  }}
                />
              ),
              img: ({ src, alt }) => (
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={alt ?? ""}
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: "var(--v16-radius-md)",
                    margin: "24px 0",
                  }}
                />
              ),
            }}
          >
            {article.body}
          </ReactMarkdown>
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
