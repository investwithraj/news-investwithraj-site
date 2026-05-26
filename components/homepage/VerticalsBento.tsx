// Bento grid of Raj's 5 verticals. Each card = one vertical with its glyph,
// gradient, tagline, cadence, and link into the dedicated /v/[slug] page.
//
// Layout: 12-column bento. DLD Pulse (lead) spans 6, Beyond the Deal spans 6
// in the top row. Bottom row: 3 cards × 4 cols each. Mobile collapses to stack.

import Link from "next/link";
import { VERTICALS, type Vertical } from "@/lib/verticals";

export function VerticalsBento() {
  return (
    <section
      className="relative py-20 md:py-32"
      style={{ background: "var(--paper)" }}
      aria-labelledby="verticals-heading"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10">
        {/* Eyebrow + section heading */}
        <div className="text-center mb-12 md:mb-16">
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em]"
            style={{
              background: "var(--gold-soft)",
              color: "var(--gold-deep)",
              border: "1px solid var(--gold-soft)",
            }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: "var(--gold-deep)" }} />
            The desk
          </span>
          <h2
            id="verticals-heading"
            className="mt-6 leading-[1.05] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: "clamp(1.875rem, 4.5vw, 3.25rem)",
              fontWeight: 500,
              fontVariationSettings: '"SOFT" 80, "opsz" 144',
            }}
          >
            Five reads.{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              One desk.
            </span>
          </h2>
          <p
            className="mt-5 max-w-xl mx-auto text-base md:text-lg leading-[1.6]"
            style={{ color: "var(--ink-soft)" }}
          >
            Every vertical pinned to one job: turn UAE real-estate noise into
            something you can act on within the hour.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
          {/* Row 1 — DLD Pulse (lead) + Beyond the Deal (newsletter) */}
          <BentoCard vertical={VERTICALS[0]} size="lead" />
          <BentoCard vertical={VERTICALS[4]} size="lead" />
          {/* Row 2 — three secondary cards */}
          <BentoCard vertical={VERTICALS[1]} size="standard" />
          <BentoCard vertical={VERTICALS[2]} size="standard" />
          <BentoCard vertical={VERTICALS[3]} size="standard" />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  vertical,
  size,
}: {
  vertical: Vertical;
  size: "lead" | "standard";
}) {
  const span =
    size === "lead" ? "md:col-span-6" : "md:col-span-4";
  const heightClass = size === "lead" ? "min-h-[280px]" : "min-h-[240px]";

  return (
    <Link
      href={`/v/${vertical.slug}`}
      data-magnetic
      className={`group relative overflow-hidden rounded-3xl border ${span} ${heightClass} flex flex-col justify-between p-7 md:p-9 transition-transform duration-500 hover:-translate-y-1`}
      style={{
        background: vertical.gradient,
        borderColor: "var(--gold-soft)",
      }}
    >
      {/* Top — glyph + cadence chip */}
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden
          className="block leading-none"
          style={{
            color: vertical.accent,
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: size === "lead" ? "3.5rem" : "2.75rem",
            opacity: 0.85,
          }}
        >
          {vertical.glyph}
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded-full"
          style={{
            background: "rgba(255, 255, 255, 0.55)",
            color: "var(--ink-soft)",
            backdropFilter: "blur(8px)",
          }}
        >
          {vertical.cadence}
        </span>
      </div>

      {/* Bottom — name + tagline */}
      <div>
        <h3
          className="leading-[1.05] tracking-[-0.02em] mb-2"
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: size === "lead" ? "clamp(1.75rem, 3.2vw, 2.25rem)" : "clamp(1.4rem, 2.4vw, 1.75rem)",
            fontWeight: 500,
            fontVariationSettings: '"SOFT" 70, "opsz" 144',
          }}
        >
          {vertical.name}
        </h3>
        <p
          className="text-sm md:text-[15px] leading-[1.5] max-w-[40ch]"
          style={{ color: "var(--ink-soft)" }}
        >
          {vertical.tagline}
        </p>
        <div
          className="mt-5 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] transition-transform group-hover:translate-x-1"
          style={{ color: vertical.accent }}
        >
          <span>Open desk</span>
          <span aria-hidden>→</span>
        </div>
      </div>

      {/* Subtle ambient overlay on hover */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 0%, rgba(255,255,255,0.25), transparent 60%)",
        }}
      />
    </Link>
  );
}
