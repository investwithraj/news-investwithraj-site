import Link from "next/link";
import { SITE, CONTACT, rootCtaUrl } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { AuroraBackground } from "@/components/futurism/AuroraBackground";
import { CurrencyPicker } from "@/components/ticker/FxProvider";
import { AuthorBrand } from "@/components/homepage/AuthorBrand";
import { VerticalsBento } from "@/components/homepage/VerticalsBento";
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
      className="relative min-h-[100svh] flex items-center overflow-hidden"
      style={{ background: "var(--paper-warm)" }}
    >
      {/* Full-bleed cinematic skyline (Pexels Dubai aerial sunset), kept at
          FULL opacity. v16 hero pass (31 May 2026): per the 28-May direction
          — "keep the videos full, just put a box behind the text" — the cream
          readability wash that was flattening the footage is gone; the frosted
          glass card is now the only thing competing with the video, mirroring
          the main-site hero grammar (full-bleed motion + single glass panel). */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        src="/hero.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />

      {/* Whisper-soft brand shimmer — far below the old 0.32 wash so the
          skyline stays vivid. */}
      <AuroraBackground opacity={0.14} />

      {/* Minimal depth only: a soft darkening on the left third so the glass
          card separates from the sky, plus a thin fade into the next section
          at the very bottom. The centre + right of the skyline stay untouched. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(100deg, rgba(12,16,22,0.5) 0%, rgba(12,16,22,0.2) 32%, rgba(12,16,22,0) 58%), linear-gradient(180deg, transparent 78%, var(--paper-warm) 100%)",
        }}
      />

      {/* Left-aligned frosted-glass card — main-site hero grammar */}
      <div className="relative z-20 w-full max-w-[1320px] mx-auto px-6 md:px-12">
        <div
          style={{
            maxWidth: "640px",
            background: "rgba(252, 249, 242, 0.7)",
            backdropFilter: "blur(22px) saturate(1.08)",
            WebkitBackdropFilter: "blur(22px) saturate(1.08)",
            border: "1px solid rgba(255, 255, 255, 0.55)",
            borderRadius: "28px",
            boxShadow:
              "0 28px 90px rgba(18, 16, 10, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
            padding: "38px clamp(28px, 4vw, 44px) 34px",
          }}
        >
          <span className="editorial-eyebrow-sotm" style={{ display: "inline-flex" }}>
            news.investwithraj.com · live
          </span>

          <KineticHeadline
            className="editorial-h1 mt-6"
            style={{
              fontSize: "clamp(2.5rem, 5.6vw, 4.75rem)",
              maxWidth: "13ch",
              lineHeight: 0.98,
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
            className="mt-6 text-base md:text-lg leading-[1.6]"
            style={{ color: "var(--ink-soft)", maxWidth: "46ch" }}
          >
            Independent intelligence on Dubai, Abu Dhabi, and Ras Al Khaimah —
            5–15 verified-source articles a day, every figure cited to DLD, RERA,
            Knight Frank, JLL, and the UAE desks. Written for serious investors.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
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

          <div className="mt-8 inline-flex items-center gap-3">
            <span className="eyebrow-live">
              <span>Publishing imminently</span>
            </span>
          </div>
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
