"use client";

// DLD daily-pulse ticker — Bloomberg-style auto-scrolling strip pinned to top
// of every page. Pulls /api/dld-pulse every 6h. Items rotate continuously.
//
// Three states:
//   - loading:     shimmer skeleton (~1s before first fetch)
//   - live/ref:    real ticker data — "DLD · LIVE" (Dubai Pulse feed) or
//                  "DLD · OFFICIAL" (latest cited DLD print). Never fabricated.
//   - error:       silent fail — strip just doesn't render

import { useEffect, useState } from "react";
import type { DldDailyPulse } from "@/lib/dld/types";
import { formatAed } from "@/lib/dld/types";
import { useFx, Price } from "./FxProvider";

export function DldTicker() {
  const [pulse, setPulse] = useState<DldDailyPulse | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchPulse() {
      try {
        const res = await fetch("/api/dld-pulse", { cache: "default" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as DldDailyPulse;
        if (mounted) setPulse(data);
      } catch {
        if (mounted) setErrored(true);
      }
    }
    fetchPulse();
    const t = setInterval(fetchPulse, 6 * 60 * 60 * 1000); // 6h
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (errored) return null;

  const items = pulse ? buildTickerItems(pulse) : null;

  return (
    <div
      role="status"
      aria-label="Live DLD market pulse"
      className="dld-ticker w-full overflow-hidden border-b"
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        borderColor: "rgba(201, 169, 97, 0.25)",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <div className="flex items-center gap-6 px-4 py-2 text-[11px] tracking-[0.12em] uppercase">
        {/* Brand chip */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: pulse?.source === "live" ? "#22c55e" : "var(--gold-bright, #E0C076)",
              boxShadow:
                pulse?.source === "live"
                  ? "0 0 8px #22c55e"
                  : "0 0 8px rgba(224, 192, 118, 0.65)",
              animation: "ticker-pulse 1.4s ease-in-out infinite",
            }}
          />
          <span style={{ color: "var(--gold-bright, #E0C076)" }}>
            DLD · {pulse?.source === "live" ? "LIVE" : pulse ? "OFFICIAL" : "…"}
          </span>
        </div>

        {/* Scrolling track */}
        {items && (
          <div className="ticker-track flex-1 overflow-hidden">
            <div className="ticker-track-inner flex items-center gap-10 whitespace-nowrap will-change-transform">
              {items.map((it, i) => (
                <TickerItem key={`a-${i}`} {...it} />
              ))}
              {/* Duplicate for seamless loop */}
              {items.map((it, i) => (
                <TickerItem key={`b-${i}`} {...it} />
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ticker-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .ticker-track-inner {
          animation: ticker-scroll 60s linear infinite;
        }
        .ticker-track:hover .ticker-track-inner {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track-inner { animation: none; }
        }
      `}</style>
    </div>
  );
}

interface TickerItemData {
  label: string;
  value: string | React.ReactNode;
  delta?: number;
}

function buildTickerItems(p: DldDailyPulse): TickerItemData[] {
  const out: TickerItemData[] = [];
  out.push({
    label: "DLD VOL",
    value: <Price amount={p.volumeAed} compact />,
    delta: p.dodVolumeChangePct,
  });
  out.push({ label: "TXNS", value: p.txnCount.toLocaleString("en-US") });
  out.push({ label: "AVG", value: <Price amount={p.avgPriceAed} compact /> });
  if (p.medianPpsfAed) out.push({ label: "PPSF", value: <Price amount={p.medianPpsfAed} /> });
  if (p.hottestArea)
    out.push({
      label: "HOTTEST",
      value: `${p.hottestArea.name} · ${formatAed(p.hottestArea.volumeAed)}`,
    });
  if (p.topDeveloper)
    out.push({
      label: "TOP DEV",
      value: `${p.topDeveloper.name} · ${p.topDeveloper.txnCount} txns`,
    });
  out.push({ label: "AS OF", value: p.sourceNote || p.periodLabel || p.date });
  return out;
}

function TickerItem({ label, value, delta }: TickerItemData) {
  const deltaColor =
    delta === undefined
      ? undefined
      : delta >= 0
        ? "#7ED99F"
        : "#E58E89";
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <span style={{ color: "rgba(248, 250, 252, 0.45)" }}>{label}</span>
      <span style={{ color: "var(--paper)" }} className="font-medium">
        {value}
      </span>
      {delta !== undefined && (
        <span style={{ color: deltaColor }} className="text-[10px]">
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
