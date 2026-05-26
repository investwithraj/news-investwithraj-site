// /developers index — every UAE developer Raj covers.

import type { Metadata } from "next";
import Link from "next/link";
import { DEVELOPERS } from "@/lib/developers";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Developers — Every UAE builder Raj covers",
  description:
    "Per-developer pages for every UAE builder Raj covers — Emaar, Aldar, Nakheel, Modon, Damac, Sobha, Dubai Holding, IFA, Marjan. Credit takes, active areas, flagship projects, recent news.",
  alternates: { canonical: `${SITE.url}/developers` },
};

export default function DevelopersIndex() {
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

          <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-deep)" }}>
            The roster · {DEVELOPERS.length} developers
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            Every UAE developer,{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              scored.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "var(--ink-soft)" }}
          >
            Each developer page = Raj's credit take, active areas, flagship
            projects, recent news mentions. The roster you'd want before
            wiring money on an off-plan.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
        <div className="max-w-[1080px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEVELOPERS.map((d) => (
              <Link
                key={d.slug}
                href={`/developer/${d.slug}`}
                data-magnetic
                className="group rounded-2xl border p-6 hover:-translate-y-1 transition-transform flex flex-col"
                style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span
                    aria-hidden
                    className="leading-none"
                    style={{
                      color: d.accent,
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      fontSize: "2.25rem",
                      opacity: 0.8,
                    }}
                  >
                    {d.glyph}
                  </span>
                  {d.ticker && (
                    <span
                      className="px-2 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.2em]"
                      style={{
                        background: "var(--gold-soft)",
                        color: "var(--gold-deep)",
                      }}
                    >
                      {d.ticker}
                    </span>
                  )}
                </div>
                <h3
                  className="text-xl md:text-2xl leading-tight mb-2 transition-colors group-hover:text-[var(--gold-deep)]"
                  style={{
                    color: "var(--ink)",
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    fontWeight: 500,
                  }}
                >
                  {d.name}
                </h3>
                <p
                  className="text-sm leading-[1.5] flex-1"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {d.tagline}
                </p>
                <div
                  className="mt-5 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] transition-transform group-hover:translate-x-1"
                  style={{ color: d.accent }}
                >
                  <span>Open profile</span>
                  <span aria-hidden>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
