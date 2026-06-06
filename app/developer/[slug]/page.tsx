// Per-developer landing page — /developer/[slug]
//
// SEO honeypot for "[developer] news 2026" queries. Each page = developer
// profile + Raj's credit take + active areas (linked) + flagship projects +
// recent news mentions.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  DEVELOPERS,
  getDeveloperBySlug,
  getAllDeveloperSlugs,
} from "@/lib/developers";
import { AREAS } from "@/content/areas";
import { NEWS_ARTICLES } from "@/content/news";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllDeveloperSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = getDeveloperBySlug(slug);
  if (!d) return { title: "Not found" };
  return {
    title: `${d.name} — ${d.tagline}`,
    description: d.excerpt,
    alternates: { canonical: `${SITE.url}/developer/${slug}` },
    openGraph: {
      title: `${d.name} — Invest With Raj`,
      description: d.excerpt,
      url: `${SITE.url}/developer/${slug}`,
    },
  };
}

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = getDeveloperBySlug(slug);
  if (!d) notFound();

  const activeAreas = AREAS.filter((a) => d.activeAreas.includes(a.slug));
  const relatedNews = NEWS_ARTICLES.filter((n) =>
    n.title.toLowerCase().includes(d.name.toLowerCase().split(" ")[0])
  ).slice(0, 6);

  // JSON-LD — Organization + breadcrumb
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/developer/${d.slug}#org`,
    name: d.name,
    description: d.excerpt,
    foundingDate: d.founded ? `${d.founded}` : undefined,
    foundingLocation: {
      "@type": "Place",
      name: d.hq,
      containedInPlace: { "@type": "Country", name: "United Arab Emirates" },
    },
    ...(d.ticker && {
      tickerSymbol: d.ticker,
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section
          className="relative pt-20 md:pt-28 pb-12 md:pb-16"
          style={{ background: "var(--paper-warm)" }}
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
                  color: d.accent,
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: "clamp(4rem, 10vw, 7rem)",
                  opacity: 0.78,
                }}
              >
                {d.glyph}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-faint)" }}>
                  <span style={{ color: "var(--gold-deep)" }}>{d.hq}</span>
                  <span aria-hidden>·</span>
                  <span>{d.kind.replace(/-/g, " ")}</span>
                  {d.ticker && (
                    <>
                      <span aria-hidden>·</span>
                      <span style={{ color: "var(--gold-deep)" }}>{d.ticker}</span>
                    </>
                  )}
                  {d.founded && (
                    <>
                      <span aria-hidden>·</span>
                      <span>Founded {d.founded}</span>
                    </>
                  )}
                </div>
                <KineticHeadline
                  className="leading-[1.02] tracking-[-0.025em]"
                  style={{
                    color: "var(--ink)",
                    fontSize: "clamp(2.25rem, 5vw, 4rem)",
                    fontWeight: 500,
                  }}
                >
                  {d.name}
                </KineticHeadline>
                <p
                  className="mt-5 text-base md:text-xl leading-[1.5] max-w-[60ch] editorial-italic"
                  style={{ color: "var(--ink-soft)", fontStyle: "italic" }}
                >
                  {d.tagline}
                </p>
              </div>
            </div>

            <p
              className="mt-10 text-base md:text-lg leading-[1.65] max-w-[65ch]"
              style={{ color: "var(--ink-soft)" }}
            >
              {d.excerpt}
            </p>
          </div>
        </section>

        {/* Raj's take */}
        <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
          <div className="max-w-[920px] mx-auto px-6 md:px-12">
            <div
              className="rounded-3xl p-8 md:p-12"
              style={{
                background: "var(--paper-warm)",
                border: "1px solid var(--gold-soft)",
                boxShadow: "0 12px 40px -12px rgba(10, 16, 36, 0.12)",
              }}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                The Raj take
              </span>
              <p
                className="mt-5 text-xl md:text-2xl leading-[1.4]"
                style={{
                  color: "var(--ink)",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontVariationSettings: '"SOFT" 80, "opsz" 144',
                }}
              >
                “{d.rajTake}”
              </p>
              <p
                className="mt-5 text-[10px] font-mono uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-faint)" }}
              >
                — Raj Tomar · real-estate consultant
              </p>
            </div>
          </div>
        </section>

        {/* Active areas */}
        {activeAreas.length > 0 && (
          <section className="py-16 md:py-20" style={{ background: "var(--paper-warm)" }}>
            <div className="max-w-[1080px] mx-auto px-6 md:px-12">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                Where they build
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
                Active areas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAreas.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/areas/${a.slug}`}
                    data-magnetic
                    className="group rounded-2xl border p-5 hover:-translate-y-0.5 transition-transform"
                    style={{
                      borderColor: "var(--gold-soft)",
                      background: "var(--paper-pure, #FFFFFF)",
                    }}
                  >
                    <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "var(--ink-faint)" }}>
                      {a.emirate} · {a.kind.replace(/-/g, " ")}
                    </div>
                    <h3
                      className="text-base md:text-lg leading-tight mb-1.5 transition-colors group-hover:text-[var(--gold-deep)]"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-fraunces), Georgia, serif",
                        fontWeight: 500,
                      }}
                    >
                      {a.name}
                    </h3>
                    <p className="text-sm leading-[1.5]" style={{ color: "var(--ink-soft)" }}>
                      {a.oneLiner}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Flagship projects */}
        {d.flagshipProjects.length > 0 && (
          <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
            <div className="max-w-[1080px] mx-auto px-6 md:px-12">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-deep)" }}
              >
                Flagship inventory
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
                What they're known for
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {d.flagshipProjects.map((p, i) => (
                  <li
                    key={i}
                    className="pl-5 relative text-base md:text-lg leading-[1.55] py-1"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    <span
                      className="absolute left-0 top-[0.75em] w-3 h-px"
                      style={{ background: d.accent }}
                      aria-hidden
                    />
                    {p}
                  </li>
                ))}
              </ul>
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
                On the desk
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
      </main>
    </>
  );
}

// Suppress unused-import warnings
void DEVELOPERS;
