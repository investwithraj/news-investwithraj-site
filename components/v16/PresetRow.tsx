"use client";

import { CSSProperties, ReactNode } from "react";

/**
 * v16 PresetRow — bottom-of-hero row of icon+label tile cards.
 *
 * Reference: Brandly bottom row "Frame Blox / North Peak / Luma Works /
 * Studio Arc / Pixel & Co / Boldmark". Each tile is a clickable card
 * with a small icon + name. Tiles are equal-width, 6 across on desktop,
 * 3 across on tablet, 2 across on mobile.
 *
 * Used on:
 *   • Homepage Hero bottom (links to /practice service lines)
 *   • /practice page (the 6 service offerings)
 *   • /media page (content categories)
 */
interface PresetItem {
  icon: ReactNode;        // SVG element OR text glyph
  label: string;
  href?: string;
  description?: string;   // optional hover-only description
}

interface Props {
  items: PresetItem[];
  columns?: 4 | 5 | 6;
  variant?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
}

export default function PresetRow({
  items,
  columns = 6,
  variant = "light",
  className,
  style,
}: Props) {
  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: "12px",
    ...style,
  };

  const tileStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "20px 16px",
    borderRadius: "var(--v16-radius-md)",
    background:
      variant === "dark" ? "var(--v16-ink-card)" : "var(--v16-paper-pure)",
    border: `1px solid ${variant === "dark" ? "var(--v16-ink-card-border)" : "var(--v16-chrome)"}`,
    color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)",
    textDecoration: "none",
    transition:
      "transform var(--v16-dur-micro) var(--v16-ease-out), border-color var(--v16-dur-micro) var(--v16-ease-out), background var(--v16-dur-micro) var(--v16-ease-out)",
    cursor: "pointer",
    aspectRatio: "1 / 1.05",
  };

  return (
    <div
      className={`v16-preset-row ${className ?? ""}`}
      style={containerStyle}
    >
      {items.map((item, i) => {
        const inner = (
          <>
            <span
              aria-hidden="true"
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: variant === "dark" ? "var(--v16-ink-faint)" : "var(--v16-ink-muted)",
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontFamily: "var(--v16-font-body), system-ui, sans-serif",
                fontSize: "0.8125rem",
                fontWeight: 500,
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {item.label}
            </span>
          </>
        );

        return item.href ? (
          <a
            key={i}
            href={item.href}
            style={tileStyle}
            className="v16-preset-tile"
            title={item.description}
          >
            {inner}
          </a>
        ) : (
          <div
            key={i}
            style={tileStyle}
            className="v16-preset-tile"
            title={item.description}
          >
            {inner}
          </div>
        );
      })}

      <style jsx global>{`
        .v16-preset-tile:hover {
          transform: translateY(-2px);
          border-color: var(--v16-holo-blue) !important;
        }
        @media (max-width: 768px) {
          .v16-preset-row {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .v16-preset-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
