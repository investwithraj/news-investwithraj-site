// /power-list/[year] — annual UAE real-estate Power List.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPowerListByYear, getAllPowerListYears } from "@/content/power-list";
import type { PowerListCategory } from "@/content/power-list";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";

// Always include 2026 in static params so we render the editorial-in-progress
// stub for visitors who land on /power-list/2026 before the list is live.
export function generateStaticParams() {
  const knownYears = getAllPowerListYears();
  const allYears = new Set<string>(knownYears);
  allYears.add(new Date().getFullYear().toString());
  return Array.from(allYears).map((year) => ({ year }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `The Power List ${year} — UAE real estate`,
    description: `The most influential UAE real-estate figures of ${year} — developers, brokers, investors, regulators. Curated by Raj Tomar.`,
    alternates: { canonical: `${SITE.url}/power-list/${year}` },
  };
}

const CATEGORY_COLOR: Record<PowerListCategory, string> = {
  developer: "var(--gold-deep)",
  broker: "var(--gold-rich)",
  investor: "var(--navy)",
  regulator: "var(--ink-soft)",
  sovereign: "var(--navy)",
  advisor: "var(--ink-muted)",
  media: "var(--gold-bright)",
};

export default async function PowerListPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const list = getPowerListByYear(year);

  // Validate year shape — 4 digits
  if (!/^\d{4}$/.test(year)) notFound();

  return (
    <main className="min-h-screen" style={{ background: "var(--paper)" }}>
      <section
        className="relative pt-20 md:pt-28 pb-12 md:pb-16"
        style={{ background: "var(--ink)", color: "var(--paper)" }}
      >
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

          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--gold-bright, #E0C076)" }}
          >
            Annual editorial · {year}
          </span>

          <KineticHeadline
            className="mt-3 leading-[1.02] tracking-[-0.025em]"
            style={{
              color: "var(--paper)",
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
              fontWeight: 500,
            }}
          >
            The Power List{" "}
            <span className="editorial-italic" style={{ color: "var(--gold-bright, #E0C076)" }}>
              {year}.
            </span>
          </KineticHeadline>

          {list ? (
            <p
              className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
              style={{ color: "rgba(248, 250, 252, 0.78)" }}
            >
              {list.intro}
            </p>
          ) : (
            <p
              className="mt-6 text-base md:text-lg leading-[1.65] max-w-[60ch]"
              style={{ color: "rgba(248, 250, 252, 0.78)" }}
            >
              The 100 most influential figures in UAE real estate, {year}.
              Curated by Raj — developers, brokers, investors, regulators,
              sovereign capital, advisors, media. Edition currently in
              production. Subscribe to Beyond the Deal to be first to read.
            </p>
          )}
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-[920px] mx-auto px-6 md:px-12">
          {!list || list.entries.length === 0 ? (
            <div
              className="rounded-2xl border p-10 md:p-14 text-center"
              style={{ borderColor: "var(--gold-soft)", background: "var(--paper-warm)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--gold-deep)" }}>
                In production · publication forthcoming
              </span>
              <p
                className="mt-5 text-lg md:text-xl leading-[1.55] max-w-[40ch] mx-auto"
                style={{ color: "var(--ink-soft)" }}
              >
                The Power List is hand-curated. No algorithms, no popularity contests.
                Submit names or context via the Beyond the Deal newsletter inbox.
              </p>
            </div>
          ) : (
            <ol className="space-y-6">
              {list.entries.map((entry) => (
                <li
                  key={entry.rank}
                  className="rounded-2xl border p-6 md:p-8 flex gap-6 md:gap-8"
                  style={{ borderColor: "var(--gold-soft)", background: "var(--paper-pure, #FFFFFF)" }}
                >
                  <div className="shrink-0 text-right">
                    <div
                      className="leading-none tabular-nums"
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-fraunces), Georgia, serif",
                        fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
                        fontWeight: 500,
                      }}
                    >
                      {entry.rank.toString().padStart(2, "0")}
                    </div>
                    {entry.lastYearRank !== undefined && (
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] mt-2" style={{ color: "var(--ink-faint)" }}>
                        {entry.rank < entry.lastYearRank ? "▲" : entry.rank > entry.lastYearRank ? "▼" : "="}{" "}
                        was #{entry.lastYearRank}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[10px] font-mono uppercase tracking-[0.22em] mb-2"
                      style={{ color: CATEGORY_COLOR[entry.category] }}
                    >
                      {entry.category}
                    </div>
                    <h3
                      className="text-xl md:text-2xl leading-tight mb-1"
                      style={{ color: "var(--ink)", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: 500 }}
                    >
                      {entry.name}
                    </h3>
                    <div className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
                      {entry.role} · <span style={{ color: "var(--gold-deep)" }}>{entry.company}</span>
                    </div>
                    <p className="text-base leading-[1.65]" style={{ color: "var(--ink-soft)" }}>
                      {entry.why}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}
