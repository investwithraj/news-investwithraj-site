// /wallet — Daily Digest Wallet Pass install page.
// One-tap install on iPhone (Apple PassKit) + Android (Google Wallet).
// Lock-screen-native delivery of the morning Beyond the Deal brief.

import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Wallet Pass — Daily digest on your lock screen",
  description:
    "Install the Beyond the Deal daily digest as an Apple Wallet or Google Wallet pass. Lock-screen delivery, refreshes with each morning brief. No app required.",
  alternates: { canonical: `${SITE.url}/wallet` },
};

export default function WalletPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <section
        className="relative pt-20 md:pt-28 pb-12 md:pb-16"
        style={{ background: "var(--paper-warm)" }}
      >
        <div className="max-w-[920px] mx-auto px-6 md:px-12">
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
            Lock-screen edition
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            The desk on your{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              lock screen.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "var(--ink-soft)" }}
          >
            Install once. Each morning at 07:00 GST, the pass refreshes with
            the day's lead story + the DLD print. No app to open, no inbox to
            check — the brief surfaces on the lock screen. Goes silent the
            moment you stop tapping it.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-6 md:px-12">
          <div
            className="rounded-3xl overflow-hidden shadow-xl mx-auto max-w-md"
            style={{
              background:
                "linear-gradient(180deg, #0a1024 0%, #141a2c 100%)",
              border: "1px solid rgba(201, 169, 97, 0.4)",
              boxShadow:
                "0 32px 80px -24px rgba(10, 16, 36, 0.35), 0 0 0 1px rgba(201, 169, 97, 0.15) inset",
            }}
          >
            {/* Pass header */}
            <div
              className="px-6 py-5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]"
              style={{ color: "var(--gold-bright, #E0C076)", borderBottom: "1px solid rgba(201,169,97,0.2)" }}
            >
              <span>Beyond the Deal</span>
              <span>Daily digest</span>
            </div>

            {/* Pass body */}
            <div className="px-6 py-8" style={{ color: "var(--paper)" }}>
              <div className="text-[9px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "rgba(248,250,252,0.45)" }}>
                Today
              </div>
              <h3
                className="leading-[1.15] mb-6"
                style={{
                  color: "var(--paper)",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: "1.5rem",
                  fontWeight: 500,
                }}
              >
                A daily firehose of UAE real-estate intelligence — straight to your wallet.
              </h3>

              <div className="grid grid-cols-2 gap-4 text-[10px] font-mono uppercase tracking-[0.18em]">
                <div>
                  <div style={{ color: "rgba(248,250,252,0.5)" }}>Refreshes</div>
                  <div className="mt-1" style={{ color: "var(--gold-bright, #E0C076)" }}>07:00 GST · Daily</div>
                </div>
                <div>
                  <div style={{ color: "rgba(248,250,252,0.5)" }}>Author</div>
                  <div className="mt-1" style={{ color: "var(--gold-bright, #E0C076)" }}>Raj · DLD-licensed</div>
                </div>
              </div>
            </div>

            {/* Pass barcode strip (decorative) */}
            <div
              className="px-6 py-5 flex items-center justify-center"
              style={{ borderTop: "1px solid rgba(201,169,97,0.2)", background: "rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-end gap-[2px] h-10">
                {Array.from({ length: 38 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-[2px]"
                    style={{
                      background: i % 3 === 0 ? "var(--paper)" : "var(--gold-bright, #E0C076)",
                      height: `${30 + ((i * 37) % 70)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Install CTAs */}
          <div className="mt-10 flex flex-col md:flex-row items-center gap-4 justify-center">
            <a
              href="/api/wallet/install?platform=apple"
              data-magnetic
              className="btn-graphite group inline-flex"
            >
              <span>Add to Apple Wallet</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span>
            </a>
            <a
              href="/api/wallet/install?platform=google"
              data-magnetic
              className="btn-ghost group inline-flex"
            >
              <span>Save to Google Wallet</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span>
            </a>
          </div>

          <p
            className="mt-6 text-xs text-center"
            style={{ color: "var(--ink-faint)" }}
          >
            Wallet signing certs activate the install on production. Until then,
            both buttons return the pass preview JSON.
          </p>
        </div>
      </section>
    </main>
  );
}
