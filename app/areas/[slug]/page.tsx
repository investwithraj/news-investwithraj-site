// Per-area landing page — /areas/[slug]
//
// Programmatic SEO honeypot. Every priority UAE community/island/free-zone/
// master-plan gets a page: stats, developers, related news, FAQ, citations.
// Each page links into IWR root if a Note covers the area, and into
// /developer/[slug] for each active developer.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AREAS, getAreaBySlug, getAllAreaSlugs } from "@/content/areas";
import { NEWS_ARTICLES } from "@/content/news";
import { getDevelopersForArea } from "@/lib/developers";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { Price } from "@/components/ticker/FxProvider";
import {
  placeSchema,
  realEstateAgentSchema,
  breadcrumbSchema,
  BREADCRUMB_PRESETS,
  asGraph,
} from "@/lib/schema";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllAreaSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getAreaBySlug(slug);
  if (!a) return { title: "Not found" };
  return {
    title: `${a.name} — ${a.oneLiner}`,
    description: a.excerpt,
    alternates: { canonical: `${SITE.url}/areas/${slug}` },
    openGraph: {
      title: `${a.name} — Invest With Raj`,
      description: a.excerpt,
      url: `${SITE.url}/areas/${slug}`,
      images: a.heroImage.src ? [{ url: a.heroImage.src, alt: a.heroImage.alt }] : undefined,
    },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getAreaBySlug(slug);
  if (!a) notFound();

  const activeDevs = getDevelopersForArea(slug);
  const relatedNews = NEWS_ARTICLES.filter(
    (n) => n.market.includes(a.emirate as "Dubai" | "Abu Dhabi" | "Ras Al Khaimah" | "UAE" | "GCC")
  ).slice(0, 6);

  const graph = asGraph(
    placeSchema(a),
    realEstateAgentSchema(a),
    breadcrumbSchema(BREADCRUMB_PRESETS.area({ slug: a.slug, name: a.name }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative pt-20 md:pt-28 pb-12 md:pb-16 overflow-hidden" style={{ background: "var(--paper-warm)" }}>
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

            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-faint)" }}>
              <span style={{ color: "var(--gold-deep)" }}>{a.emirate}</span>
              <span aria-hidden>·</span>
              <span>{a.kind.replace(/-/g, " ")}</span>
            </div>

            <KineticHeadline
              className="leading-[1.02] tracking-[-0.025em]"
              style={{
                color: "var(--ink)",
                fontSize: "clamp(2.5rem, 6vw, 4.75rem)",
                fontWeight: 500,
              }}
            >
              {a.name}
            </KineticHeadline>

            <p
              className="mt-6 text-lg md:text-xl leading-[1.55] max-w-[60ch] editorial-italic"
              style={{ color: "var(--ink-soft)", fontStyle: "italic" }}
            >
              {a.oneLiner}
            </p>

            <p
              className="mt-6 text-base md:text-lg leading-[1.65] max-w-[65ch]"
              style={{ color: "var(--ink-soft)" }}
            >
              {a.excerpt}
            </p>

            {/* Stats strip */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {a.stats.map((s, i) => (
                <div
                  key={i}
                  className="border-l-2 pl-5"
                  style={{ borderColor: "var(--gold-deep)" }}
                >
                  <div
                    className="leading-none tracking-[-0.025em]"
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      fontSize: "clamp(1.5rem, 2.5vw, 2.25rem)",
                      fontWeight: 500,
                      fontVariationSettings: '"SOFT" 60, "opsz" 144',
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em]"
                    style={{ color: "var(--gold-deep)" }}
                  >
                    {s.unit}
                  </div>
                  <div
                    className="mt-2 text-sm leading-[1.5]"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Median price / yield strip — converts via FX */}
            {(a.medianAedPerSqft || a.netYieldBand) && (
              <div
                className="mt-10 rounded-2xl p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-4 md:gap-10"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid var(--gold-soft)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {a.medianAedPerSqft && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "var(--ink-faint)" }}>
                      Median price per sqft
                    </div>
                    <div className="text-2xl md:text-3xl tracking-[-0.02em]" style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif" }}>
                      <Price amount={a.medianAedPerSqft} /> <span className="text-base" style={{ color: "var(--ink-faint)" }}>/ sqft</span>
                    </div>
                  </div>
                )}
                {a.netYieldBand && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: "var(--ink-faint)" }}>
                      Net yield band
                    </div>
                    <div className="text-2xl md:text-3xl tracking-[-0.02em]" style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif" }}>
                      {a.netYieldBand.min.toFixed(1)}–{a.netYieldBand.max.toFixed(1)}<span className="text-base" style={{ color: "var(--ink-faint)" }}>%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Active developers */}
        {activeDevs.length > 0 && (
          <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
            <div className="max-w-[1080px] mx-auto px-6 md:px-12">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                Active developers
              </span>
              <h2
                className="mt-3 mb-8 leading-[1.05] tracking-[-0.025em]"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                  fontWeight: 500,
                }}
              >
                Who's building here
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDevs.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/developer/${d.slug}`}
                    data-magnetic
                    className="group rounded-2xl border p-5 hover:-translate-y-0.5 transition-transform"
                    style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="leading-none"
                        style={{ color: d.accent, fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: "1.75rem" }}
                      >
                        {d.glyph}
                      </span>
                      <div>
                        <div
                          className="text-base md:text-lg leading-tight"
                          style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
                        >
                          {d.name}
                        </div>
                        {d.ticker && (
                          <div className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--ink-faint)" }}>
                            {d.ticker}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
                      {d.tagline}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Related news */}
        {relatedNews.length > 0 && (
          <section className="py-16 md:py-20" style={{ background: "var(--paper-warm)" }}>
            <div className="max-w-[1080px] mx-auto px-6 md:px-12">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                Recent coverage
              </span>
              <h2
                className="mt-3 mb-8 leading-[1.05] tracking-[-0.025em]"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                  fontWeight: 500,
                }}
              >
                The {a.name} desk
              </h2>
              <div className="grid gap-5">
                {relatedNews.map((n) => (
                  <Link
                    key={n.slug}
                    href={`/news/${n.slug}`}
                    data-magnetic
                    className="group block rounded-2xl border p-5 md:p-6 transition-transform hover:-translate-y-0.5"
                    style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
                  >
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "var(--ink-faint)" }}>
                      {n.category} · {n.displayDate}
                    </div>
                    <h3
                      className="text-lg md:text-xl leading-[1.15] mb-1 transition-colors group-hover:text-[var(--gold-deep)]"
                      style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
                    >
                      {n.title}
                    </h3>
                    <p className="text-sm leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
                      {n.subtitle}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* IWR Note cross-link */}
        {a.iwrNoteSlug && (
          <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
            <div className="max-w-[760px] mx-auto px-6 md:px-12 text-center">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                Institutional Note
              </span>
              <p
                className="mt-6 text-xl md:text-2xl leading-[1.4]"
                style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                {a.name} is covered by the curated{" "}
                <a
                  href={`${SITE.rootUrl}/?utm_source=news&utm_medium=area-page&utm_campaign=note-cross-link&utm_content=${a.iwrNoteSlug}`}
                  className="editorial-italic text-gold-grad"
                  data-magnetic
                >
                  Beyond the Deal Note
                </a>{" "}
                on investwithraj.com.
              </p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

// Force-static prerender — every area page gets a static HTML file
export const revalidate = 86400;
// Suppress unused-import warnings for partially-applied imports
void AREAS;
