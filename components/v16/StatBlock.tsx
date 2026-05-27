"use client";

import { CSSProperties } from "react";

/**
 * v16 StatBlock — big numeral + small uppercase caption.
 *
 * Reference: Brandly "50+ BRANDS / 5+ YEARS" top-right stat callouts.
 * The number uses Fraunces display serif (.v16-stat); the caption uses
 * Geist Mono uppercase with wide tracking.
 *
 * Three sizes (sm/md/lg) scale the numeral. Caption stays small.
 * Alignment controls text-align (left/right/center).
 */
type Size = "sm" | "md" | "lg" | "xl";
type Align = "left" | "right" | "center";

interface Props {
  value: string;             // e.g. "50+", "AED 11.97B", "474"
  label: string;             // e.g. "BRANDS", "Q1 2026 ABSORPTION"
  unit?: string;             // optional small label between number + caption (e.g. "PER SQFT")
  size?: Size;
  align?: Align;
  variant?: "light" | "dark" | "accent";
  className?: string;
  style?: CSSProperties;
}

const SIZE_MAP: Record<Size, string> = {
  sm: "clamp(1.5rem, 2.5vw, 2rem)",
  md: "clamp(2rem, 4vw, 3rem)",
  lg: "clamp(2.5rem, 6vw, 4.5rem)",
  xl: "clamp(4rem, 10vw, 8rem)",
};

const COLOR_MAP: Record<"light" | "dark" | "accent", { num: string; label: string }> = {
  light:  { num: "var(--v16-ink)",       label: "var(--v16-ink-muted)" },
  dark:   { num: "var(--v16-paper)",      label: "var(--v16-ink-faint)" },
  accent: { num: "var(--v16-holo-deep)",  label: "var(--v16-ink-muted)" },
};

export default function StatBlock({
  value,
  label,
  unit,
  size = "md",
  align = "left",
  variant = "light",
  className,
  style,
}: Props) {
  const colors = COLOR_MAP[variant];
  return (
    <div
      className={`v16-stat-block ${className ?? ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        textAlign: align,
        alignItems:
          align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--v16-font-display), Georgia, serif",
          fontVariationSettings: '"SOFT" 30, "opsz" 144, "WONK" 0',
          fontSize: SIZE_MAP[size],
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: colors.num,
          fontFeatureSettings: '"tnum", "lnum"',
        }}
      >
        {value}
      </span>
      {unit && (
        <span
          style={{
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.625rem",
            fontWeight: 500,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "var(--v16-holo-deep)",
            marginTop: "-2px",
          }}
        >
          {unit}
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--v16-font-mono), monospace",
          fontSize: "0.6875rem",
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: colors.label,
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}
