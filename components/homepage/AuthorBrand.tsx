// Author-as-brand section — Raj as the masthead.
//
// Puck + Information + Mansion Global pattern. Below the hero, before the
// verticals: signature, credentials line, and the editorial promise.

import Link from "next/link";
import { CONTACT } from "@/lib/constants";

export function AuthorBrand() {
  return (
    <section
      className="relative py-20 md:py-28"
      style={{ background: "var(--paper-warm)" }}
      aria-labelledby="author-heading"
    >
      <div className="max-w-[1080px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-center">
          {/* Portrait column — Raj's image (deferred — placeholder for Day-1) */}
          <div className="md:col-span-5">
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-3xl"
              style={{
                background:
                  "linear-gradient(180deg, var(--paper-cream), var(--paper-warm))",
                border: "1px solid var(--gold-soft)",
                boxShadow:
                  "0 20px 60px -20px rgba(10, 16, 36, 0.18), inset 0 0 0 1px rgba(255,255,255,0.5)",
              }}
            >
              {/* Placeholder mark — replace with actual portrait when available */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <div
                  aria-hidden
                  className="leading-none mb-6"
                  style={{
                    color: "var(--gold-deep)",
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    fontSize: "clamp(5rem, 12vw, 9rem)",
                    fontWeight: 400,
                    fontVariationSettings: '"SOFT" 100, "opsz" 144',
                    fontStyle: "italic",
                    opacity: 0.62,
                  }}
                >
                  RT
                </div>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.28em]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  Portrait · forthcoming
                </p>
              </div>
              {/* Subtle gold rim */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none rounded-3xl"
                style={{
                  border: "1px solid rgba(201, 169, 97, 0.35)",
                }}
              />
            </div>
          </div>

          {/* Text column */}
          <div className="md:col-span-7">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.22em]"
              style={{
                background: "rgba(255, 255, 255, 0.7)",
                color: "var(--gold-deep)",
                border: "1px solid var(--gold-soft)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: "var(--gold-deep)" }} />
              The desk operator
            </span>

            <h2
              id="author-heading"
              className="mt-6 leading-[1.02] tracking-[-0.025em]"
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-fraunces), Georgia, serif",
                fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
                fontWeight: 500,
                fontVariationSettings: '"SOFT" 80, "opsz" 144',
              }}
            >
              Raj Tomar.{" "}
              <span
                className="editorial-italic"
                style={{
                  color: "var(--gold-deep)",
                  fontStyle: "italic",
                  fontVariationSettings: '"SOFT" 100, "opsz" 18',
                }}
              >
                Broker, builder,&nbsp;writer.
              </span>
            </h2>

            <p
              className="mt-7 text-base md:text-lg leading-[1.65] max-w-[58ch]"
              style={{ color: "var(--ink-soft)" }}
            >
              DLD-licensed broker, Dubai-based. I publish what I'd otherwise email
              to one client — the daily prints, the off-plan reads, the UHNW trades,
              and the slow essays nobody else writes about UAE real estate.
            </p>

            {/* Credential line */}
            <div
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono uppercase tracking-[0.18em]"
              style={{ color: "var(--ink-muted)" }}
            >
              <span>DLD · Licensed</span>
              <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>
              <span>MBA · Construction Mgmt</span>
              <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>
              <span>B.Plan · Urban Planning</span>
              <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>
              <span>Wharton · AI Apps</span>
            </div>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href={CONTACT.linkedinNewsletter}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-graphite group"
                data-magnetic
              >
                <span>Subscribe to Beyond the Deal</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span>
              </a>
              <Link
                href="/v/dld-pulse"
                className="btn-ghost group"
                data-magnetic
              >
                <span>Start with DLD Pulse</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
