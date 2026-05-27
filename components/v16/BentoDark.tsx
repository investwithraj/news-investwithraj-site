"use client";

import { CSSProperties, ReactNode } from "react";

/**
 * v16 BentoDark — Max Reed-style dark-register bento grid container.
 *
 * Reference: Screenshot 2026-05-27 100011.png — Max Reed portfolio.
 * Near-black background, frosted glass cards in a 3-column asymmetric grid,
 * mixed content per cell (portrait + testimonial + tool grid + timeline +
 * stat + contact card).
 *
 * Used on /operator, /media, /podcast, /press where rich media + bento
 * layouts dominate. Light pages stick with the Brandly register.
 *
 * Children pattern:
 *   <BentoDark>
 *     <BentoDark.Cell span={2} rowSpan={2}>...</BentoDark.Cell>
 *     <BentoDark.Cell>...</BentoDark.Cell>
 *     ...
 *   </BentoDark>
 *
 * Cells use --v16-ink-card background + chrome-deep border + soft shadow.
 */
interface BentoProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

interface CellProps {
  children: ReactNode;
  span?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  eyebrow?: string;
  variant?: "card" | "portrait" | "stat" | "ghost";
  /** When set, cell becomes a clickable anchor */
  href?: string;
  className?: string;
  style?: CSSProperties;
  /** Background image OR video src — overlays children with scrim */
  backdrop?: { src: string; type?: "image" | "video"; poster?: string };
}

export function BentoCell({
  children,
  span = 1,
  rowSpan = 1,
  eyebrow,
  variant = "card",
  href,
  className,
  style,
  backdrop,
}: CellProps) {
  const cellStyle: CSSProperties = {
    gridColumn: span > 1 ? `span ${span}` : undefined,
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
    position: "relative",
    overflow: "hidden",
    borderRadius: "var(--v16-radius-lg)",
    background:
      variant === "ghost" ? "transparent" : "var(--v16-ink-card)",
    border:
      variant === "ghost"
        ? "none"
        : "1px solid var(--v16-ink-card-border)",
    color: "var(--v16-paper)",
    boxShadow:
      variant === "ghost" ? "none" : "var(--v16-shadow-card-dark)",
    transition:
      "transform var(--v16-dur-micro) var(--v16-ease-out), border-color var(--v16-dur-micro) var(--v16-ease-out)",
    cursor: href ? "pointer" : "default",
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    minHeight: variant === "portrait" ? "320px" : "auto",
    ...style,
  };

  const inner = (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          {backdrop.type === "video" ||
          /\.(mp4|webm|mov)$/i.test(backdrop.src) ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={backdrop.src}
              poster={backdrop.poster}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.75,
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdrop.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.75,
              }}
            />
          )}
          {/* Scrim for text legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(5,8,17,0.2) 0%, rgba(5,8,17,0.6) 70%, rgba(5,8,17,0.95) 100%)",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          flex: 1,
        }}
      >
        {eyebrow && (
          <span
            style={{
              fontFamily: "var(--v16-font-mono), monospace",
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "var(--v16-ink-faint)",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "16px",
                height: "1px",
                background: "var(--v16-electric)",
                flexShrink: 0,
              }}
            />
            {eyebrow}
          </span>
        )}
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className={`v16-bento-cell v16-bento-cell--interactive ${className ?? ""}`} style={cellStyle}>
        {inner}
      </a>
    );
  }

  return (
    <div className={`v16-bento-cell ${className ?? ""}`} style={cellStyle}>
      {inner}
    </div>
  );
}

function BentoGrid({
  children,
  columns = 3,
  gap = 20,
  className,
  style,
}: BentoProps) {
  return (
    <>
      <div
        className={`v16-bento-grid ${className ?? ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridAutoRows: "minmax(180px, auto)",
          gap: `${gap}px`,
          ...style,
        }}
      >
        {children}
      </div>
      <style jsx global>{`
        .v16-bento-cell--interactive:hover {
          transform: translateY(-2px);
          border-color: var(--v16-electric) !important;
        }
        @media (max-width: 900px) {
          .v16-bento-grid {
            grid-template-columns: 1fr !important;
          }
          .v16-bento-cell {
            grid-column: span 1 !important;
            grid-row: span 1 !important;
          }
        }
      `}</style>
    </>
  );
}

/** Default export — the grid container.
 *  Pair with `import BentoDark, { BentoCell } from ...` and use as
 *  <BentoDark><BentoCell/></BentoDark>. The previous composite-namespace
 *  pattern (BentoDark.Cell) broke Next.js client-boundary serialization
 *  on dynamic routes. */
export default BentoGrid;
