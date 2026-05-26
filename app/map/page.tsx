// /map — DLD-velocity heatmap.
// SVG fallback Day-1 (no Mapbox token required). When MAPBOX_TOKEN is set on
// Vercel, the client component below upgrades to a true 3D-buildings Mapbox
// map with timeline scrubber + filters. Both flows show the same area
// volume + median PSF + sentiment overlay.

import type { Metadata } from "next";
import Link from "next/link";
import { AREAS } from "@/content/areas";
import { getMockSentimentSnapshot } from "@/lib/sentiment/mock";
import { scoreToColor } from "@/lib/sentiment/types";
import { SITE } from "@/lib/constants";
import { KineticHeadline } from "@/components/futurism/KineticHeadline";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "DLD Map — Live UAE sale-velocity heatmap",
  description:
    "Interactive heatmap of UAE real-estate transaction velocity by area. DLD daily volume + sentiment overlay. Mapbox 3D-buildings mode when token is configured.",
  alternates: { canonical: `${SITE.url}/map` },
};

// Bounding box of the UAE (approx) — used to project lat/lng → SVG x/y
const UAE_BOUNDS = {
  minLat: 22.5,
  maxLat: 26.1,
  minLng: 51.5,
  maxLng: 56.4,
};
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;

function projectToSvg(lat: number, lng: number): { x: number; y: number } {
  const x =
    ((lng - UAE_BOUNDS.minLng) / (UAE_BOUNDS.maxLng - UAE_BOUNDS.minLng)) *
    SVG_WIDTH;
  const y =
    SVG_HEIGHT -
    ((lat - UAE_BOUNDS.minLat) / (UAE_BOUNDS.maxLat - UAE_BOUNDS.minLat)) *
      SVG_HEIGHT;
  return { x, y };
}

export default function MapPage() {
  // Merge area data + sentiment into a single map dataset
  const sentiment = getMockSentimentSnapshot();
  const sentimentByArea = new Map(
    sentiment.signals
      .filter((s) => s.kind === "area")
      .map((s) => [s.subject, s])
  );

  const dataset = AREAS.map((a) => ({
    slug: a.slug,
    name: a.name,
    emirate: a.emirate,
    lat: a.coords.lat,
    lng: a.coords.lng,
    medianPsf: a.medianAedPerSqft || 0,
    score: sentimentByArea.get(a.slug)?.score ?? 0,
    volume: sentimentByArea.get(a.slug)?.volume ?? 0,
    ...projectToSvg(a.coords.lat, a.coords.lng),
  }));

  return (
    <main className="min-h-screen" style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <section className="relative pt-16 md:pt-24 pb-8">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] mb-6 opacity-70 hover:opacity-100"
            style={{ color: "var(--paper)" }}
            data-magnetic
          >
            <span aria-hidden>←</span>
            <span>Back to the desk</span>
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex-1 min-w-0">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "var(--gold-bright, #E0C076)" }}
              >
                Live UAE velocity map
              </span>
              <KineticHeadline
                className="mt-3 leading-[1.02] tracking-[-0.025em]"
                style={{
                  color: "var(--paper)",
                  fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                  fontWeight: 500,
                }}
              >
                Where the deals{" "}
                <span className="editorial-italic" style={{ color: "var(--gold-bright, #E0C076)" }}>
                  are landing.
                </span>
              </KineticHeadline>
              <p
                className="mt-4 text-base md:text-lg leading-[1.55] max-w-[60ch]"
                style={{ color: "rgba(248, 250, 252, 0.78)" }}
              >
                Every covered area as a node. Size = chatter volume.
                Colour = sentiment polarity. Click any node to open the area
                desk. Mapbox 3D-buildings mode activates when{" "}
                <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> is
                set on Vercel.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.22em]">
              <LegendDot color={scoreToColor(0.7)} label="Bullish" />
              <LegendDot color={scoreToColor(0)} label="Neutral" />
              <LegendDot color={scoreToColor(-0.7)} label="Bearish" />
            </div>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12">
          <div
            className="rounded-2xl border overflow-hidden relative"
            style={{ borderColor: "rgba(201, 169, 97, 0.2)", background: "#05081A" }}
          >
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-auto"
              role="img"
              aria-label="UAE sale-velocity heatmap"
            >
              {/* Background — radial glow over Dubai / AD / RAK */}
              <defs>
                <radialGradient id="bg-glow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#1a2540" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#05081A" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
              </defs>

              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#bg-glow)" />

              {/* Subtle grid */}
              {Array.from({ length: 12 }).map((_, i) => (
                <line
                  key={`gx-${i}`}
                  x1={(i / 12) * SVG_WIDTH}
                  x2={(i / 12) * SVG_WIDTH}
                  y1={0}
                  y2={SVG_HEIGHT}
                  stroke="rgba(201,169,97,0.05)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line
                  key={`gy-${i}`}
                  y1={(i / 8) * SVG_HEIGHT}
                  y2={(i / 8) * SVG_HEIGHT}
                  x1={0}
                  x2={SVG_WIDTH}
                  stroke="rgba(201,169,97,0.05)"
                  strokeWidth={1}
                />
              ))}

              {/* Emirate label markers */}
              <text
                x={projectToSvg(25.2048, 55.2708).x}
                y={projectToSvg(25.2048, 55.2708).y - 80}
                fill="rgba(248, 250, 252, 0.3)"
                fontSize={18}
                fontFamily="monospace"
                textAnchor="middle"
                letterSpacing="0.22em"
              >
                DUBAI
              </text>
              <text
                x={projectToSvg(24.4539, 54.3773).x}
                y={projectToSvg(24.4539, 54.3773).y - 80}
                fill="rgba(248, 250, 252, 0.3)"
                fontSize={18}
                fontFamily="monospace"
                textAnchor="middle"
                letterSpacing="0.22em"
              >
                ABU DHABI
              </text>
              <text
                x={projectToSvg(25.7000, 55.7800).x}
                y={projectToSvg(25.7000, 55.7800).y - 80}
                fill="rgba(248, 250, 252, 0.3)"
                fontSize={18}
                fontFamily="monospace"
                textAnchor="middle"
                letterSpacing="0.22em"
              >
                RAK
              </text>

              {/* Area nodes */}
              {dataset.map((node) => {
                const radius = 10 + Math.min(node.volume, 480) * 0.07;
                const color = scoreToColor(node.score);
                return (
                  <g key={node.slug}>
                    {/* Glow ring */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius + 18}
                      fill={color}
                      opacity={0.15}
                    />
                    {/* Core dot */}
                    <a href={`/areas/${node.slug}`}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={color}
                        opacity={0.85}
                        className="hover:opacity-100"
                        style={{ cursor: "pointer", transition: "opacity 200ms" }}
                      />
                      {/* Label */}
                      <text
                        x={node.x + radius + 6}
                        y={node.y + 4}
                        fill="rgba(248, 250, 252, 0.78)"
                        fontSize={12}
                        fontFamily="sans-serif"
                      >
                        {node.name}
                      </text>
                    </a>
                  </g>
                );
              })}
            </svg>

            {/* Footer hint */}
            <div
              className="px-4 py-3 text-[10px] font-mono uppercase tracking-[0.22em] border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: "rgba(201, 169, 97, 0.18)", color: "rgba(248, 250, 252, 0.45)" }}
            >
              <span>SVG fallback · 30 areas · {sentiment.signals.length} signals</span>
              <span>
                Mapbox 3D mode <span style={{ color: "rgba(248,250,252,0.7)" }}>auto-enables</span> with NEXT_PUBLIC_MAPBOX_TOKEN
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ color: "rgba(248,250,252,0.7)" }}>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
