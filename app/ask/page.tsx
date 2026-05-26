// /ask — F16 Personalized AI Brief UI. "Ask Raj's desk anything about UAE
// real estate." Server component renders the shell; the prompt + response
// is a client island below.

import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import { AskRajClient } from "./AskRajClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Ask Raj — Personalized UAE real-estate briefs",
  description:
    "Ask the desk anything. Get a 500-word Beyond the Deal · Generated Insight brief on any UAE real-estate topic, grounded in Raj's published coverage. Free, 5 briefs per hour.",
  alternates: { canonical: `${SITE.url}/ask` },
};

export default function AskPage() {
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
            Beyond the Deal · Generated Insight
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--ink)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            Ask the desk{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-deep)" }}>
              anything.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "var(--ink-soft)" }}
          >
            Pose a topic. Get a 500-word brief in 10 seconds — counter-intuitive
            lead, hard numbers, "how I'd trade it" close. Grounded only in Raj's
            published coverage. Five briefs per hour, free.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-6 md:px-12">
          <AskRajClient />
        </div>
      </section>
    </main>
  );
}
