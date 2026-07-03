// /pulse — F8 Sentiment Heatmap.
// Real-time scrape of Reddit + X + Telegram + news + LinkedIn chatter
// about UAE real estate, plotted as a heatmap by area + developer.

import type { Metadata } from "next";
import Link from "next/link";
import { getMockSentimentSnapshot } from "@/lib/sentiment/mock";
import { scoreToColor, scoreToInk } from "@/lib/sentiment/types";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pulse — Live UAE real-estate sentiment heatmap",
  description:
    "Real-time scrape of Reddit, X, Telegram, news, and LinkedIn chatter about UAE real estate. Heatmap by area + developer. Where the market is whispering bullish, bearish, or neutral.",
  alternates: { canonical: `${SITE.url}/pulse` },
};

export default function PulsePage() {
  const snap = getMockSentimentSnapshot();
  const areas = snap.signals
    .filter((s) => s.kind === "area")
    .sort((a, b) => b.volume - a.volume);
  const devs = snap.signals
    .filter((s) => s.kind === "developer")
    .sort((a, b) => b.volume - a.volume);

  const channels = Object.entries(snap.byChannel)
    .map(([k, v]) => ({ name: k, ...v }))
    .sort((a, b) => b.volume - a.volume);

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      {/* Hero */}
      <section
        className="relative pt-20 md:pt-28 pb-12 md:pb-16"
        style={{ background: "var(--ink)", color: "var(--paper)" }}
      >
        <div className="max-w-[1240px] mx-auto px-6 md:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] mb-8 opacity-70 hover:opacity-100"
            style={{ color: "var(--paper)" }}
            data-magnetic
          >
            <span aria-hidden>←</span>
            <span>Back to the desk</span>
          </Link>

          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--gold-bright, #E0C076)" }}
          >
            Live · {snap.source} · refreshes every 30m
          </span>
          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--paper)",
              fontSize: "clamp(2.25rem, 5vw, 4rem)",
              fontWeight: 500,
            }}
          >
            Where the market is{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-bright, #E0C076)" }}>
              whispering.
            </span>
          </KineticHeadline>
          <p
            className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
            style={{ color: "rgba(248, 250, 252, 0.78)" }}
          >
            Reddit threads, X replies, Telegram channels, trade press, and
            LinkedIn — scraped, scored, and plotted. Green = bullish chatter,
            gold = neutral, red = bearish. Volume = how many mentions feed each
            score.
          </p>

          {/* Channel-level aggregate strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-4">
            {channels.map((c) => (
              <div key={c.name} className="border-l-2 pl-4" style={{ borderColor: scoreToColor(c.score) }}>
                <div className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: "rgba(248,250,252,0.5)" }}>
                  {c.name}
                </div>
                <div
                  className="mt-1 text-xl tabular-nums"
                  style={{ color: scoreToColor(c.score), fontFamily: "var(--font-fraunces), Georgia, serif" }}
                >
                  {c.score >= 0 ? "+" : ""}
                  {c.score.toFixed(2)}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] mt-1" style={{ color: "rgba(248,250,252,0.45)" }}>
                  vol {c.volume}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heatmap — Areas */}
      <section className="py-16 md:py-20" style={{ background: "var(--paper)" }}>
        <div className="max-w-[1240px] mx-auto px-6 md:px-12">
          <h2
            className="leading-[1.05] tracking-[-0.025em] mb-8"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 500,
            }}
          >
            By area
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((s) => (
              <SignalCard key={s.subject} signal={s} />
            ))}
          </div>
        </div>
      </section>

      {/* Heatmap — Developers */}
      <section className="py-16 md:py-20" style={{ background: "var(--paper-warm)" }}>
        <div className="max-w-[1240px] mx-auto px-6 md:px-12">
          <h2
            className="leading-[1.05] tracking-[-0.025em] mb-8"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
              fontWeight: 500,
            }}
          >
            By developer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devs.map((s) => (
              <SignalCard key={s.subject} signal={s} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SignalCard({
  signal,
}: {
  signal: ReturnType<typeof getMockSentimentSnapshot>["signals"][0];
}) {
  const color = scoreToColor(signal.score); // vivid — progress-bar fill (data viz)
  const ink = scoreToInk(signal.score); // AA-on-light — the score TEXT on the card
  const href =
    signal.kind === "area" ? `/areas/${signal.subject}` : `/developer/${signal.subject}`;

  return (
    <Link
      href={href}
      data-magnetic
      className="group rounded-2xl border p-5 transition-transform hover:-translate-y-0.5"
      style={{
        borderColor: "var(--gold-soft)",
        background: "var(--paper-pure, #FFFFFF)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] mb-1.5" style={{ color: "var(--ink-faint)" }}>
            {signal.channel} · vol {signal.volume}
          </div>
          <h3
            className="text-base md:text-lg leading-tight transition-colors group-hover:text-[var(--gold-deep)]"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontWeight: 500,
            }}
          >
            {signal.name}
          </h3>
        </div>
        <div
          className="text-right tabular-nums shrink-0"
          style={{ color: ink, fontFamily: "var(--font-fraunces), Georgia, serif" }}
        >
          <div className="text-xl md:text-2xl leading-none">
            {signal.score >= 0 ? "+" : ""}
            {signal.score.toFixed(2)}
          </div>
        </div>
      </div>
      <p className="text-sm leading-[1.55]" style={{ color: "var(--ink-soft)" }}>
        {signal.summary}
      </p>
      <div
        className="mt-4 h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(10, 16, 36, 0.08)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.abs(signal.score) * 100}%`,
            background: color,
          }}
        />
      </div>
    </Link>
  );
}
