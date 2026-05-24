import Link from "next/link";
import { SITE, CONTACT, rootCtaUrl } from "@/lib/constants";

/**
 * news.investwithraj.com homepage — v11 design system, Block 1 scaffold.
 *
 * Day-1 state: editorial holding page with the v11 visual register +
 * cross-links to IWR root. Real content firehose (5-15 articles/day,
 * Postiz distribution, Listmonk digest) ships in Block 2.
 *
 * The hero sets the brand premise. Below it: a single "Coming
 * imminently" status card + lead-back to IWR + LinkedIn newsletter.
 * This is enough to ship + get the subdomain indexed on Day-1 while
 * Block 2's content pipeline gets built.
 */
export default function Home() {
  return (
    <main>
      <Hero />
      <ComingSoon />
      <CrossLink />
    </main>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden gold-mesh-hero"
      style={{ background: "var(--paper-warm)" }}
    >
      {/* Top eyebrow */}
      <div className="relative z-20 w-full max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-28 flex justify-center">
        <div
          className="eyebrow-holo px-3.5 py-1.5 rounded-full"
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(14px) saturate(180%)",
            WebkitBackdropFilter: "blur(14px) saturate(180%)",
            border: "1px solid var(--gold-soft)",
            boxShadow: "0 4px 18px -6px var(--gold-glow)",
          }}
        >
          <span>news.investwithraj.com</span>
        </div>
      </div>

      {/* Main composition */}
      <div className="relative z-20 flex-1 w-full max-w-[980px] mx-auto px-6 md:px-12 flex flex-col items-center justify-center text-center -mt-10">
        <h1
          className="tracking-[-0.04em] leading-[0.95]"
          style={{
            color: "var(--ink)",
            fontSize: "clamp(2.75rem, 8vw, 7rem)",
            fontWeight: 500,
            fontFamily: "var(--font-body), system-ui, sans-serif",
            maxWidth: "18ch",
          }}
        >
          The daily{" "}
          <span
            className="editorial-italic text-gold-grad"
            style={{ fontWeight: 400 }}
          >
            UAE real-estate
          </span>{" "}
          read.
        </h1>

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
            data-cursor="active"
          >
            <span>Subscribe to Beyond the Deal</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <Link
            href={rootCtaUrl({ campaign: "subdomain-hero", content: "request-note" })}
            className="btn-ghost group"
            data-cursor="active"
          >
            <span>Request the current Note</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              ↗
            </span>
          </Link>
        </div>

        {/* Status pill — "publishing imminently" */}
        <div className="mt-14 inline-flex items-center gap-3">
          <span className="eyebrow-live">
            <span>Publishing imminently</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function ComingSoon() {
  return (
    <section
      className="relative py-24 md:py-32"
      style={{ background: "var(--paper)" }}
    >
      <div className="relative max-w-[1080px] mx-auto px-6 md:px-12">
        <div
          className="rounded-3xl p-10 md:p-16 text-center"
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid var(--gold-soft)",
            boxShadow:
              "0 8px 32px rgba(10, 16, 36, 0.06), 0 0 0 1px rgba(201, 169, 97, 0.18)",
          }}
        >
          <span className="eyebrow-holo justify-center" style={{ display: "inline-flex" }}>
            What's coming
          </span>
          <h2
            className="editorial-display mt-6 tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
              fontWeight: 500,
            }}
          >
            A daily firehose, verified-source-first.
          </h2>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-left">
            <Stat num="5–15" unit="articles/day" label="Curated · cited · investor-grade" />
            <Stat num="20+" unit="Tier-1 sources" label="DLD · RERA · Knight Frank · JLL · CBRE · Savills" />
            <Stat num="14" unit="distribution channels" label="LinkedIn · X · IG · Threads · TikTok · YouTube" />
          </div>

          <p
            className="mt-12 max-w-2xl mx-auto text-base md:text-lg leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            Subscribe to{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              Beyond the Deal
            </span>{" "}
            on LinkedIn to be among the first to receive the daily digest
            when it goes live.
          </p>

          <div className="mt-8">
            <a
              href={CONTACT.linkedinNewsletter}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-graphite group inline-flex"
              data-cursor="active"
            >
              <span>Subscribe on LinkedIn</span>
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                ↗
              </span>
            </a>
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
        <h2
          className="editorial-display mt-6 tracking-[-0.025em]"
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
            data-cursor="active"
          >
            investwithraj.com
          </Link>
        </h2>
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

function Stat({ num, unit, label }: { num: string; unit: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 pl-5 border-l" style={{ borderColor: "var(--gold-soft)" }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="tracking-[-0.04em] leading-none"
          style={{
            color: "var(--ink)",
            fontSize: "clamp(2rem, 3.5vw, 3rem)",
            fontWeight: 500,
            fontFamily: "var(--font-body), sans-serif",
          }}
        >
          {num}
        </span>
        <span
          className="font-mono text-[0.65rem] tracking-[0.2em] uppercase"
          style={{ color: "var(--gold-deep)" }}
        >
          {unit}
        </span>
      </div>
      <span
        className="font-mono text-[0.65rem] tracking-[0.18em] uppercase mt-1"
        style={{ color: "var(--ink-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
