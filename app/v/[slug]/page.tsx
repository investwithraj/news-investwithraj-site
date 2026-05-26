// Per-vertical landing page — /v/dld-pulse, /v/off-plan-watch, etc.
//
// Each vertical is a curated stream of NewsArticles by category. Static-
// generated for SEO (every long-tail "Dubai off-plan launches 2026" type
// query lands here).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VERTICALS, getVerticalBySlug } from "@/lib/verticals";
import { NEWS_ARTICLES } from "@/content/news";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return VERTICALS.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const v = getVerticalBySlug(slug);
  if (!v) return { title: "Not found" };
  return {
    title: `${v.name} — ${v.tagline}`,
    description: v.description,
    alternates: { canonical: `${SITE.url}/v/${slug}` },
    openGraph: {
      title: `${v.name} — Invest With Raj`,
      description: v.description,
      url: `${SITE.url}/v/${slug}`,
    },
  };
}

export default async function VerticalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const v = getVerticalBySlug(slug);
  if (!v) notFound();

  // Filter articles into this vertical's stream
  const stream = NEWS_ARTICLES
    .filter((a) => v.categories.includes(a.category))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section
        className="relative pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden"
        style={{ background: v.gradient }}
      >
        <div className="max-w-[1080px] mx-auto px-6 md:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] mb-8"
            style={{ color: "var(--ink-soft)" }}
            data-magnetic
          >
            <span aria-hidden>←</span>
            <span>Back to the desk</span>
          </Link>

          <div className="flex items-start gap-6 md:gap-10">
            <span
              aria-hidden
              className="leading-none shrink-0"
              style={{
                color: v.accent,
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: "clamp(4rem, 12vw, 8rem)",
                opacity: 0.7,
              }}
            >
              {v.glyph}
            </span>
            <div className="flex-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: v.accent }}
              >
                {v.cadence}
              </span>
              <KineticHeadline
                className="mt-3 leading-[1.02] tracking-[-0.025em]"
                style={{
                  color: "var(--ink)",
                  fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
                  fontWeight: 500,
                }}
              >
                {v.name}
              </KineticHeadline>
              <p
                className="mt-5 text-base md:text-xl leading-[1.55] max-w-[60ch]"
                style={{ color: "var(--ink-soft)" }}
              >
                {v.tagline}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Description + stream */}
      <section className="relative py-16 md:py-20" style={{ background: "var(--paper)" }}>
        <div className="max-w-[1080px] mx-auto px-6 md:px-12">
          <p
            className="text-lg md:text-xl leading-[1.65] max-w-[65ch] mb-12 md:mb-16"
            style={{ color: "var(--ink-soft)" }}
          >
            {v.description}
          </p>

          {stream.length === 0 ? (
            <div
              className="rounded-2xl border p-10 md:p-14 text-center"
              style={{
                borderColor: "var(--gold-soft)",
                background: "var(--paper-warm)",
              }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-deep)" }}>
                Status
              </span>
              <p
                className="mt-4 text-lg leading-[1.55] max-w-[40ch] mx-auto"
                style={{ color: "var(--ink-soft)" }}
              >
                Publishing imminently. The first stories drop with the morning cron at 07:00 GST.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:gap-6">
              {stream.map((a) => (
                <Link
                  key={a.slug}
                  href={`/news/${a.slug}`}
                  data-magnetic
                  className="group block rounded-2xl border p-6 md:p-8 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{
                    borderColor: "var(--gold-soft)",
                    background: "var(--paper-pure, #FFFFFF)",
                  }}
                >
                  <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-faint)" }}>
                    <span style={{ color: v.accent }}>{a.category}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={a.publishedAt}>{a.displayDate}</time>
                  </div>
                  <h3
                    className="text-xl md:text-2xl leading-[1.15] tracking-[-0.015em] mb-2 transition-colors group-hover:text-[var(--gold-deep)]"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      fontWeight: 500,
                      fontVariationSettings: '"SOFT" 60, "opsz" 144',
                    }}
                  >
                    {a.title}
                  </h3>
                  <p
                    className="text-sm md:text-base leading-[1.55] max-w-[70ch]"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {a.subtitle}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
