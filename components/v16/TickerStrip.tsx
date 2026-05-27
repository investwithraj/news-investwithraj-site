"use client";

import { CSSProperties } from "react";

/**
 * v16 TickerStrip — top-of-page horizontal ticker (news subdomain only).
 *
 * Reference: news.investwithraj.com current top ticker. Scrolling row of
 * mono-typed market data + headlines, styled for the v16 register
 * (chrome border, holographic accents).
 *
 * Each item is a small data badge with a label + value + optional trend.
 * Auto-loops left ← right via CSS animation (no JS).
 */
interface TickerItem {
  label: string;        // e.g. "DLD VOL"
  value: string;        // e.g. "AED 3B"
  trend?: "up" | "down" | "flat";
  delta?: string;       // e.g. "1.4%"
}

interface Props {
  items: TickerItem[];
  speed?: "slow" | "medium" | "fast";
  variant?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
}

const SPEED_MAP = { slow: "180s", medium: "90s", fast: "45s" };
const TREND_COLOR = { up: "var(--v16-holo-cyan)", down: "#FF6B6B", flat: "var(--v16-ink-faint)" };
const TREND_ARROW = { up: "▲", down: "▼", flat: "•" };

export default function TickerStrip({
  items,
  speed = "medium",
  variant = "light",
  className,
  style,
}: Props) {
  // Duplicate items for seamless loop
  const looped = [...items, ...items];

  const wrapperStyle: CSSProperties = {
    width: "100%",
    overflow: "hidden",
    padding: "8px 0",
    background:
      variant === "dark" ? "var(--v16-ink-card)" : "var(--v16-paper-cool)",
    borderTop: `1px solid ${variant === "dark" ? "var(--v16-ink-card-border)" : "var(--v16-chrome)"}`,
    borderBottom: `1px solid ${variant === "dark" ? "var(--v16-ink-card-border)" : "var(--v16-chrome)"}`,
    color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)",
    fontFamily: "var(--v16-font-mono), monospace",
    fontSize: "0.6875rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontWeight: 500,
    ...style,
  };

  return (
    <div
      className={`v16-ticker-strip ${className ?? ""}`}
      style={wrapperStyle}
    >
      <div
        className="v16-ticker-track"
        style={{
          display: "flex",
          gap: "32px",
          width: "max-content",
          animation: `v16-ticker-scroll ${SPEED_MAP[speed]} linear infinite`,
        }}
      >
        {looped.map((item, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "var(--v16-ink-faint)" }}>{item.label}</span>
            <span style={{ color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)", fontVariantNumeric: "tabular-nums" }}>
              {item.value}
            </span>
            {item.trend && (
              <span style={{ color: TREND_COLOR[item.trend], display: "inline-flex", gap: "2px" }}>
                <span aria-hidden="true">{TREND_ARROW[item.trend]}</span>
                {item.delta && <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.delta}</span>}
              </span>
            )}
            <span aria-hidden="true" style={{ color: "var(--v16-chrome-deep)" }}>·</span>
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes v16-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .v16-ticker-track {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
