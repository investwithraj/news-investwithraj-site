"use client";

import { CSSProperties, ElementType, ReactNode } from "react";

/**
 * v16 GlassCard — the foundational surface for stat callouts, testimonials,
 * CTA cards, and any "floating UI" element. Frosted backdrop-blur, 1px
 * chrome hairline, soft elevation shadow, 24px radius (Brandly cards).
 *
 * Variants:
 *   • light — default. Pure-white tint, chrome border.
 *   • dark  — for /notes/[slug], /media, /podcast, /press pages.
 *   • holo  — adds a soft holographic-blue glow ring (for data panels).
 *
 * Sizes (sm/md/lg) control padding. Interactive=true adds hover-lift -2px.
 */
type Variant = "light" | "dark" | "holo";
type Padding = "sm" | "md" | "lg" | "none";

interface Props {
  children: ReactNode;
  variant?: Variant;
  padding?: Padding;
  interactive?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  href?: string;
  onClick?: () => void;
}

const PAD_MAP: Record<Padding, string> = {
  none: "0",
  sm: "16px",
  md: "24px",
  lg: "32px",
};

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  light: {
    background: "var(--v16-paper-glass)",
    color: "var(--v16-ink)",
    border: "1px solid var(--v16-chrome)",
    boxShadow: "var(--v16-shadow-glass)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
  },
  dark: {
    background: "var(--v16-ink-card)",
    color: "var(--v16-paper)",
    border: "1px solid var(--v16-ink-card-border)",
    boxShadow: "var(--v16-shadow-card-dark)",
  },
  holo: {
    background: "var(--v16-paper-glass)",
    color: "var(--v16-ink)",
    border: "1px solid var(--v16-holo-blue)",
    boxShadow:
      "var(--v16-shadow-glass), 0 0 24px var(--v16-holo-glow)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
  },
};

export default function GlassCard({
  children,
  variant = "light",
  padding = "md",
  interactive = false,
  as: Component = "div",
  className,
  style,
  href,
  onClick,
}: Props) {
  const baseStyle: CSSProperties = {
    padding: PAD_MAP[padding],
    borderRadius: "var(--v16-radius-lg)",
    transition: interactive
      ? "transform var(--v16-dur-micro) var(--v16-ease-out), box-shadow var(--v16-dur-micro) var(--v16-ease-out), border-color var(--v16-dur-micro) var(--v16-ease-out)"
      : "transform var(--v16-dur-micro) var(--v16-ease-out)",
    willChange: interactive ? "transform" : "auto",
    cursor: href || onClick ? "pointer" : "default",
    textDecoration: "none",
    display: "block",
    position: "relative",
    overflow: "hidden",
    ...VARIANT_STYLES[variant],
    ...style,
  };

  const cls = `v16-glass-card${interactive ? " v16-glass-card--interactive" : ""} ${className ?? ""}`;

  // If href is set, render as anchor. Otherwise default element or specified element.
  // We avoid full polymorphic typing to keep this simple — the common cases are <div> + <a>.
  if (href) {
    return (
      <>
        <a
          href={href}
          onClick={onClick}
          className={cls}
          style={baseStyle}
        >
          {children}
        </a>
        <style jsx global>{`
          .v16-glass-card--interactive:hover {
            transform: translateY(-2px);
            border-color: var(--v16-chrome-deep);
          }
        `}</style>
      </>
    );
  }

  // Default: render as <div>. The `as` prop is honored when a string element
  // name is passed (e.g. "section", "article") — we render it via createElement
  // to sidestep the strict polymorphic typing in React 19.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Tag = Component as any;
  return (
    <>
      <Tag
        onClick={onClick}
        className={cls}
        style={baseStyle}
      >
        {children}
      </Tag>
      <style jsx global>{`
        .v16-glass-card--interactive:hover {
          transform: translateY(-2px);
          border-color: var(--v16-chrome-deep);
        }
      `}</style>
    </>
  );
}
