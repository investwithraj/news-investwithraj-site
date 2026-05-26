import Link from "next/link";
import { SITE, CONTACT, rootCtaUrl } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { AuroraBackground } from "@/components/futurism/AuroraBackground";
import { CurrencyPicker } from "@/components/ticker/FxProvider";
import { AuthorBrand } from "@/components/homepage/AuthorBrand";
import { VerticalsBento } from "@/components/homepage/VerticalsBento";
import { DubaiSkyline3DLoader } from "@/components/futurism/DubaiSkyline3DLoader";
import { CapitalFlowGlobeLoader } from "@/components/futurism/CapitalFlowGlobeLoader";
import { DailyAnchorPane } from "@/components/anchor/DailyAnchorPane";
import MaterialDivider from "@/components/MaterialDivider";

/**
 * news.investwithraj.com homepage — Block 3 Wave 4.
 *
 * Restructured from "latest articles" feed into a Puck / Information /
 * Mansion Global author-as-brand layout:
 *
 *   1. Hero        — brand promise, kinetic Fraunces, magnetic CTAs
 *   2. AuthorBrand — Raj's masthead, credentials, the operator identity
 *   3. Verticals   — 5-card bento grid (DLD Pulse / Off-Plan Watch /
 *                    UHNW Trades / Sovereign Plays / Beyond the Deal)
 *   4. CrossLink   — back to investwithraj.com for the Note + mandates
 *   5. Footer      — links + currency picker
 */
export default function Home() {
  return (
    <main>
      <Hero />
      <MaterialDivider material="brass-strip" />
      <DailyAnchorPane />
      <MaterialDivider material="cashmere" />
      <AuthorBrand />
      <MaterialDivider material="ink-cream" />
      <CapitalFlowSection />
      <MaterialDivider material="cream-fade" />
      <VerticalsBento />
      <MaterialDivider material="brass-strip" />
      <CrossLink />
    </main>
  );
}

function CapitalFlowSection() {
  return (
    <section
      className="relative py-20 md:py-28 overflow-hidden"
      style={{ background: "var(--navy)", color: "var(--paper)" }}
      data-section="dark"
    >
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-5 order-2 lg:order-1">
          <span
            className="font-mono inline-flex items-center gap-2.5 uppercase"
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.28em",
              color: "rgba(245, 239, 227, 0.6)",
            }}
          >
            <span
              aria-hidden="true"
              className="block"
              style={{
                width: "22px",
                height: "1px",
                background: "var(--gold-bright, #E0C076)",
              }}
            />
            Capital flow · live
          </span>
          <KineticHeadline
            as="h2"
            className="editorial-h1 mt-6"
            style={{
              color: "var(--paper)",
              fontSize: "clamp(2rem, 4.5vw, 3.75rem)",
              maxWidth: "16ch",
            }}
          >
            Where the{" "}
            <span
              className="editorial-h1-italic"
              style={{ color: "var(--gold-bright, #E0C076)" }}
            >
              UAE money
            </span>{" "}
            comes from.
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[44ch]"
            style={{ color: "rgba(248, 250, 252, 0.78)" }}
          >
            Every dot is a buyer-nationality lane feeding into Dubai land
            registry prints. Comet brightness ≈ DLD volume share. Live data
            wires up when the DLD nationality feed is connected.
          </p>
          <div
            className="mt-8 grid grid-cols-2 gap-4 text-xs font-mono uppercase tracking-[0.16em]"
            style={{ color: "rgba(248, 250, 252, 0.55)" }}
          >
            <span>India · #1 buyer</span>
            <span>UK · #2</span>
            <span>Russia · #3</span>
            <span>Pakistan · #4</span>
            <span>China · #5</span>
            <span>+ 5 more</span>
          </div>
        </div>
        <div className="lg:col-span-7 order-1 lg:order-2">
          <CapitalFlowGlobeLoader height="560px" />
        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden gold-mesh-hero"
      style={{ background: "var(--paper-warm)" }}
    >
      {/* F2 — procedural 3D Dubai skyline. Time-of-day responsive (UAE local).
          Sits behind everything. ~150 KB lazy-loaded three.js bundle. */}
      <div className="absolute inset-0 z-0">
        <DubaiSkyline3DLoader height="100svh" />
      </div>

      {/* F12 — aurora overlay layered above skyline for soft brand wash */}
      <AuroraBackground opacity={0.32} />

      {/* Readability gradient so headline pops over the 3D scene */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(249, 246, 240, 0.65) 0%, rgba(249, 246, 240, 0.25) 38%, rgba(249, 246, 240, 0.55) 78%, rgba(249, 246, 240, 0.95) 100%)",
        }}
      />

      {/* v13 SOTY — flat editorial eyebrow, no glass */}
      <div className="relative z-20 w-full max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-28 flex justify-center">
        <span className="editorial-eyebrow-sotm">
          news.investwithraj.com
        </span>
      </div>

      {/* Main composition */}
      <div className="relative z-20 flex-1 w-full max-w-[980px] mx-auto px-6 md:px-12 flex flex-col items-center justify-center text-center -mt-10">
        {/* F11 — kinetic Fraunces variable headline */}
        <KineticHeadline
          className="editorial-h1"
          style={{
            fontSize: "clamp(2.75rem, 8.4vw, 7.75rem)",
            maxWidth: "16ch",
          }}
        >
          The daily{" "}
          <span
            className="editorial-h1-italic"
            style={{ color: "var(--gold-deep)" }}
          >
            UAE real-estate
          </span>{" "}
          read.
        </KineticHeadline>

        <p
          className="mt-8 md:mt-10 text-base md:text-xl leading-relaxed max-w-2xl"
          style={{
            color: "var(--ink-soft)",
            textShadow: "0 1px 2px rgba(249, 246, 240, 0.6)",
          }}
        >
          Independent intelligence on Dubai, Abu Dhabi, and Ras Al Khaimah.
          5–15 verified-source articles a day. Every piece cites DLD, RERA,
          Knight Frank, JLL, Khaleej Times, Arabian Business. Written for
          serious investors.
        </p>

        <div className="mt-10 md:mt-12 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <a
            href={CONTACT.linkedinNewsletter}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-graphite group"
            data-cursor-label="OPEN"
            data-magnetic
          >
            <span>Subscribe to Beyond the Deal</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <Link
            href={rootCtaUrl({ campaign: "subdomain-hero", content: "request-note" })}
            className="btn-ghost group"
            data-cursor-label="OPEN"
            data-magnetic
          >
            <span>Request the current Note</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              ↗
            </span>
          </Link>
        </div>

        {/* Status pill */}
        <div className="mt-14 inline-flex items-center gap-3">
          <span className="eyebrow-live">
            <span>Publishing imminently</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function CrossLink() {
  return (
    <section
      className="relative py-24 md:py-32"
      style={{ background: "var(--paper-warm)" }}
    >
      <div className="relative max-w-[920px] mx-auto px-6 md:px-12 text-center">
        <span className="eyebrow-holo justify-center" style={{ display: "inline-flex" }}>
          The home page
        </span>
        <KineticHeadline
          as="h2"
          className="editorial-display mt-6"
          style={{
            color: "var(--ink)",
            fontSize: "clamp(1.75rem, 4vw, 3rem)",
            fontWeight: 500,
          }}
        >
          For the 12-page institutional Note + curated mandates →{" "}
          <Link
            href={rootCtaUrl({ campaign: "subdomain-footer", content: "back-to-iwr" })}
            className="editorial-italic text-gold-grad"
            data-cursor-label="OPEN"
            data-magnetic
          >
            investwithraj.com
          </Link>
        </KineticHeadline>
      </div>

      <footer
        className="relative mt-20 pt-12 pb-10 border-t"
        style={{ borderColor: "var(--gold-soft)" }}
      >
        <div className="max-w-[920px] mx-auto px-6 md:px-12 flex flex-wrap items-center justify-between gap-6 font-mono text-xs tracking-[0.22em] uppercase">
          <span style={{ color: "var(--ink-muted)" }}>
            © 2026 Raj Tomar
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2" style={{ color: "var(--ink-muted)" }}>
            <CurrencyPicker />
            <Link
              href={`${SITE.rootUrl}/legal/privacy`}
              className="transition-colors hover:text-[var(--gold-deep)]"
              data-cursor="active"
            >
              Privacy
            </Link>
            <a
              href={CONTACT.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--gold-deep)]"
              data-cursor="active"
            >
              LinkedIn ↗
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              className="transition-colors hover:text-[var(--gold-deep)]"
              data-cursor="active"
            >
              {CONTACT.email}
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}
