// /areas index — all UAE areas covered, grouped by emirate.

import type { Metadata } from "next";
import Link from "next/link";
import { AREAS, sortAreas, filterByEmirate } from "@/content/areas";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import PageMotion from "@/components/v21/PageMotion";
import WordmarkSignoff from "@/components/v21/WordmarkSignoff";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Areas — Every UAE community Raj covers",
  description:
    "Every Dubai, Abu Dhabi, and Ras Al Khaimah community Raj covers on news.investwithraj.com — Hudayriyat, Palm Jebel Ali, Wynn Al Marjan, Downtown Dubai, Dubai Marina, Saadiyat, Yas, and 22 more.",
  alternates: { canonical: `${SITE.url}/areas` },
};

export default function AreasIndex() {
  const dubai = sortAreas(filterByEmirate(AREAS, "Dubai"));
  const abuDhabi = sortAreas(filterByEmirate(AREAS, "Abu Dhabi"));
  const rak = sortAreas(filterByEmirate(AREAS, "Ras Al Khaimah"));

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* V21 — PageMotion island. The h1 keeps its existing KineticHeadline
          reveal (no data-split → no double-mount); motion here is ONE grid
          stagger on the Dubai block's cards via data-reveal. */}
      <PageMotion />
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
            The map · {AREAS.length} areas
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            Every UAE community,{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              covered.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "var(--ink-soft)" }}
          >
            Each area page = stats, active developers, recent news coverage,
            median price + yield, and Raj's take on what's working.
          </p>
        </div>
      </section>

      <EmirateBlock title="Dubai" items={dubai} stagger />
      <EmirateBlock title="Abu Dhabi" items={abuDhabi} accent="dark" />
      <EmirateBlock title="Ras Al Khaimah" items={rak} />

      {/* V21 — giant INVEST WITH RAJ sign-off (same band as the Terminal home) */}
      <WordmarkSignoff />
    </main>
  );
}

function EmirateBlock({
  title,
  items,
  accent,
  stagger,
}: {
  title: string;
  items: typeof AREAS;
  accent?: "dark";
  /** V21 — one grid stagger MAX per page: only the first block sets it. */
  stagger?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section
      className="py-16 md:py-20"
      style={{ background: accent === "dark" ? "var(--paper-warm)" : "var(--paper)" }}
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-12">
        <h2
          className="mb-8 leading-[1.05] tracking-[-0.025em]"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            fontWeight: 500,
          }}
        >
          {title} <span style={{ color: "var(--ink-faint)" }}>· {items.length}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <Link
              key={a.slug}
              href={`/areas/${a.slug}`}
              data-magnetic
              data-reveal={stagger ? "" : undefined}
              className="group rounded-2xl border p-5 hover:-translate-y-0.5 transition-transform"
              style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "var(--gold-deep)" }}>
                {a.kind.replace(/-/g, " ")}
              </div>
              <h3
                className="text-base md:text-lg leading-tight mb-1.5 transition-colors group-hover:text-[var(--gold-deep)]"
                style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
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
  );
}
