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
          {/* Portrait column — Cucinelli-grade RT monogram placeholder */}
          <div className="md:col-span-5">
            <div
              className="relative aspect-[4/5] overflow-hidden"
              style={{
                background: "var(--paper-warm)",
                border: "1px solid var(--gold-soft)",
                outline: "1px solid rgba(201, 169, 97, 0.15)",
                outlineOffset: "8px",
                borderRadius: "12px",
              }}
              data-cursor-label="THE OPERATOR"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <div
                  aria-hidden
                  className="leading-none mb-6 editorial-h1-italic"
                  style={{
                    color: "var(--gold-deep)",
                    fontSize: "clamp(6rem, 14vw, 11rem)",
                    opacity: 0.32,
                    letterSpacing: "-0.06em",
                  }}
                >
                  RT
                </div>
                <p
                  className="font-mono uppercase"
                  style={{
                    fontSize: "0.625rem",
                    letterSpacing: "0.3em",
                    color: "var(--ink-faint)",
                  }}
                >
                  Portrait · forthcoming
                </p>
              </div>
            </div>
          </div>

          {/* Text column */}
          <div className="md:col-span-7">
            <span className="editorial-eyebrow-sotm">
              The desk operator
            </span>

            <h2
              id="author-heading"
              className="editorial-h1 mt-6"
              style={{
                fontSize: "clamp(2.25rem, 5.2vw, 4rem)",
                maxWidth: "16ch",
              }}
            >
              Raj Tomar.{" "}
              <span
                className="editorial-h1-italic"
                style={{ color: "var(--gold-deep)" }}
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
                data-cursor-label="SUBSCRIBE"
                data-magnetic
              >
                <span>Subscribe to Beyond the Deal</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span>
              </a>
              <Link
                href="/v/dld-pulse"
                className="btn-ghost group"
                data-cursor-label="EXPLORE"
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
