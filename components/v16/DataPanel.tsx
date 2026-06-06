"use client";

import { CSSProperties, useEffect, useState } from "react";

/**
 * v16 DataPanel — holographic floating UI card with live stat + sparkline hint.
 *
 * Reference: futuristic-office-stockcake.webp — the curved Bloomberg-terminal
 * monitor with radial data viz. This component is the "card" version of that
 * — used on the news subdomain hero, the TheNote chapter overlays, and any
 * "live data" callout across the site.
 *
 * Renders:
 *   • Eyebrow tag (mono uppercase, holo-blue)
 *   • Big value (Fraunces serif, tabular-nums)
 *   • Delta indicator (up/down arrow + percentage, color-coded)
 *   • Optional sparkline (SVG path drawn from sparkline[] number array)
 *   • Holographic ring glow on hover
 */
interface Props {
  eyebrow: string;
  value: string;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  sparkline?: number[];           // 8-32 data points for the inline chart
  variant?: "light" | "dark" | "holo";
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
}

const SIZE_MAP = {
  sm: { padding: "16px", value: "1.5rem",   eyebrow: "0.625rem" },
  md: { padding: "20px", value: "2.25rem",  eyebrow: "0.6875rem" },
  lg: { padding: "28px", value: "clamp(2.5rem, 4vw, 3.5rem)", eyebrow: "0.75rem" },
};

const TREND_COLORS = {
  up:   "var(--v16-holo-cyan)",
  down: "#FF6B6B",
  flat: "var(--v16-ink-faint)",
};

function buildSparkline(data: number[], width = 120, height = 28): string {
  if (data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  return data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function DataPanel({
  eyebrow,
  value,
  delta,
  sparkline,
  variant = "holo",
  size = "md",
  className,
  style,
}: Props) {
  const [hover, setHover] = useState(false);
  const sz = SIZE_MAP[size];

  // Light pulse animation for the holo glow
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (variant !== "holo") return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const dt = (t - t0) / 1000;
      setPulse(0.5 + 0.5 * Math.sin(dt * 1.2));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  const panelStyle: CSSProperties = {
    position: "relative",
    padding: sz.padding,
    borderRadius: "var(--v16-radius-md)",
    background:
      variant === "dark"
        ? "var(--v16-ink-card)"
        : "var(--v16-paper-pure)",
    // Dark variant = dark card (--v16-ink-card), so default text must be LIGHT.
    // (Previously inherited --v16-ink near-black → dark-on-dark on /v17.)
    color: variant === "dark" ? "#F2F4F7" : "var(--v16-ink)",
    border: `1px solid ${
      variant === "holo"
        ? `rgba(91, 165, 245, ${0.3 + pulse * 0.3})`
        : variant === "dark"
        ? "var(--v16-ink-card-border)"
        : "var(--v16-chrome)"
    }`,
    boxShadow:
      variant === "holo"
        ? `var(--v16-shadow-card), 0 0 ${24 + pulse * 16}px var(--v16-holo-glow)`
        : variant === "dark"
        ? "var(--v16-shadow-card-dark)"
        : "var(--v16-shadow-card)",
    transition: "transform var(--v16-dur-micro) var(--v16-ease-out)",
    transform: hover ? "translateY(-1px)" : "translateY(0)",
    overflow: "hidden",
    ...style,
  };

  return (
    <div
      className={`v16-data-panel ${className ?? ""}`}
      style={panelStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Eyebrow */}
      <div
        style={{
          fontFamily: "var(--v16-font-mono), monospace",
          fontSize: sz.eyebrow,
          fontWeight: 500,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: variant === "holo" ? "var(--v16-holo-deep)" : variant === "dark" ? "var(--v16-ink-faint)" : "var(--v16-ink-muted)",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "var(--v16-holo-blue)",
            boxShadow: "0 0 8px var(--v16-holo-blue)",
            opacity: 0.4 + pulse * 0.6,
          }}
        />
        {eyebrow}
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: "var(--v16-font-display), Georgia, serif",
          fontVariationSettings: '"SOFT" 30, "opsz" 100, "WONK" 0',
          fontSize: sz.value,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontFeatureSettings: '"tnum", "lnum"',
          color: variant === "dark" ? "#F2F4F7" : "var(--v16-ink)",
        }}
      >
        {value}
      </div>

      {/* Delta + sparkline row */}
      {(delta || sparkline) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "10px",
          }}
        >
          {delta && (
            <div
              style={{
                fontFamily: "var(--v16-font-mono), monospace",
                fontSize: "0.75rem",
                fontWeight: 500,
                color: TREND_COLORS[delta.trend],
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span aria-hidden="true">
                {delta.trend === "up" ? "▲" : delta.trend === "down" ? "▼" : "•"}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {delta.value}
              </span>
            </div>
          )}

          {sparkline && sparkline.length > 1 && (
            <svg
              width="120"
              height="28"
              viewBox="0 0 120 28"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <path
                d={buildSparkline(sparkline)}
                fill="none"
                stroke="var(--v16-holo-blue)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
              <path
                d={
                  buildSparkline(sparkline) +
                  ` L 120 28 L 0 28 Z`
                }
                fill="var(--v16-holo-glow)"
                opacity={0.3}
              />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
