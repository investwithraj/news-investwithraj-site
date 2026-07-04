// /closing-bell — daily 16:30 GST end-of-business-day flash archive.

import type { Metadata } from "next";
import Link from "next/link";
import { CLOSING_BELLS, sortBells } from "@/content/closing-bell";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";
import DrawLine from "@/components/v21/DrawLine";
import WordmarkSignoff from "@/components/v21/WordmarkSignoff";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Closing Bell — 16:30 GST end-of-day flash",
  description:
    "Every weekday at 16:30 GST. The end-of-business-day UAE real-estate flash — DLD prints, off-plan moves, the headlines that matter for tomorrow.",
  alternates: { canonical: `${SITE.url}/closing-bell` },
};

export default function ClosingBellIndex() {
  const bells = sortBells(CLOSING_BELLS);
  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <section className="relative pt-20 md:pt-28 pb-12 md:pb-16" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="max-w-[1080px] mx-auto px-6 md:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] mb-8 opacity-70 hover:opacity-100"
            style={{ color: "var(--paper)" }}
            data-magnetic
          >
            <span aria-hidden>←</span>
            <span>Back to the desk</span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-bright, #E0C076)" }}>
            16:30 GST · weekdays
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--paper)",
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 500,
            }}
          >
            Closing Bell.
          </KineticHeadline>

          {/* V21 data-cinematics — DrawSVG hairline under the page heading */}
          <DrawLine
            className="mt-6 max-w-[520px]"
            color="var(--gold-bright, #E0C076)"
            style={{ opacity: 0.9 }}
          />

          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "rgba(248, 250, 252, 0.78)" }}
          >
            The Dubai-business-day close, in three bullets and a line. Drops
            on Telegram and Discord at 16:30 GST. The desk's last word before
            the lights go out.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-[920px] mx-auto px-6 md:px-12">
          {bells.length === 0 ? (
            <div
              className="rounded-2xl border p-10 text-center"
              style={{ borderColor: "var(--gold-soft)", background: "var(--paper-warm)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-deep)" }}>
                Bell · forthcoming
              </span>
              <p className="mt-4 text-lg leading-[1.55] max-w-[44ch] mx-auto" style={{ color: "var(--ink-soft)" }}>
                First Closing Bell drops with the next business-day close.
                Subscribe to the Telegram channel to catch every one.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {bells.map((b) => (
                <Link
                  key={b.slug}
                  href={`/closing-bell/${b.slug}`}
                  data-magnetic
                  className="group block rounded-2xl border p-6 md:p-8 transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2" style={{ color: "var(--gold-deep)" }}>
                    {b.displayDate} · 16:30 GST
                  </div>
                  <h2
                    className="text-xl md:text-2xl leading-[1.15] mb-3 transition-colors group-hover:text-[var(--gold-deep)]"
                    style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
                  >
                    {b.title}
                  </h2>
                  <ul className="space-y-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
                    {b.highlights.map((h, i) => (
                      <li key={i} className="pl-4 relative">
                        <span className="absolute left-0 top-[0.6em] w-2 h-px" style={{ background: "var(--gold-deep)" }} aria-hidden />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 italic text-sm" style={{ color: "var(--ink-soft)" }}>
                    “{b.rajClose}”
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* V21 — giant INVEST WITH RAJ sign-off (same band as the Terminal home) */}
      <WordmarkSignoff />
    </main>
  );
}
