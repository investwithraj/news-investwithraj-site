// /news — index of all news articles, most-recent first.

import type { Metadata } from "next";
import Link from "next/link";
import { NEWS_ARTICLES, sortNewsArticles } from "@/content/news";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "News — Daily UAE real-estate intelligence",
  description:
    "Every news.investwithraj.com article — 5–15 verified-source pieces a day on Dubai, Abu Dhabi, and Ras Al Khaimah real estate. Curated by Raj Tomar, DLD-licensed broker.",
  alternates: {
    canonical: `${SITE.url}/news`,
    types: { "application/rss+xml": `${SITE.url}/rss.xml` },
  },
};

export default function NewsIndex() {
  const articles = sortNewsArticles(NEWS_ARTICLES);
  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
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

          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--gold-deep)" }}
          >
            The firehose · {articles.length} article{articles.length === 1 ? "" : "s"}
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            Every piece,{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              cited.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "var(--ink-soft)" }}
          >
            5–15 verified-source articles a day on UAE real estate. Every piece
            cites DLD / RERA / Knight Frank / JLL / Khaleej Times / Arabian
            Business. Written for serious investors.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-[1080px] mx-auto px-6 md:px-12">
          {articles.length === 0 ? (
            <div
              className="rounded-2xl border p-10 md:p-14 text-center"
              style={{ borderColor: "var(--gold-soft)", background: "var(--paper-warm)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-deep)" }}>
                Status
              </span>
              <p className="mt-4 text-lg max-w-[40ch] mx-auto" style={{ color: "var(--ink-soft)" }}>
                First articles drop with the 07:00 GST morning cron.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:gap-6">
              {articles.map((a) => (
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
                    <span style={{ color: "var(--gold-deep)" }}>{a.category}</span>
                    <span aria-hidden>·</span>
                    <span>{a.market.join(" + ")}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={a.publishedAt}>{a.displayDate}</time>
                  </div>
                  <h3
                    className="text-xl md:text-2xl leading-[1.15] tracking-[-0.015em] mb-3 transition-colors group-hover:text-[var(--gold-deep)]"
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
                    className="text-sm md:text-base leading-[1.55] max-w-[70ch] mb-3 editorial-italic"
                    style={{ color: "var(--ink-soft)", fontStyle: "italic" }}
                  >
                    {a.subtitle}
                  </p>
                  <ul className="space-y-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                    {a.tldr.map((t, i) => (
                      <li key={i} className="pl-4 relative">
                        <span className="absolute left-0 top-[0.6em] w-2 h-px" style={{ background: "var(--gold-deep)" }} aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
