"use client";

import { CSSProperties, ReactNode } from "react";

/**
 * v16 CTAPill — pill-shaped CTA button.
 *
 * Three variants:
 *   • graphite  — solid near-black on light bg (PRIMARY CTA — Brandly "Sign Up")
 *   • paper     — solid white with chrome border (SECONDARY — Brandly "Log In")
 *   • glass     — frosted glass with chrome border (TERTIARY — Max Reed "Let's Team Up")
 *
 * Hover lifts -1px + dilates shadow. Arrow icon slides 4px right.
 * No bounce / spring — ease-out only (SOTM rule preserved from v12).
 */
type Variant = "graphite" | "paper" | "glass";
type Size = "sm" | "md" | "lg";

interface Props {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const SIZE_MAP: Record<Size, { padY: string; padX: string; font: string; gap: string }> = {
  sm: { padY: "8px",  padX: "16px", font: "0.8125rem", gap: "6px" },
  md: { padY: "12px", padX: "22px", font: "0.875rem",  gap: "8px" },
  lg: { padY: "16px", padX: "28px", font: "1rem",      gap: "10px" },
};

const VARIANT_STYLES: Record<Variant, CSSProperties> = {
  graphite: {
    background: "var(--v16-ink)",
    color: "var(--v16-paper)",
    border: "1px solid var(--v16-ink)",
  },
  paper: {
    background: "var(--v16-paper-pure)",
    color: "var(--v16-ink)",
    border: "1px solid var(--v16-chrome-deep)",
  },
  glass: {
    background: "var(--v16-paper-glass)",
    color: "var(--v16-ink)",
    border: "1px solid var(--v16-chrome)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
  },
};

export default function CTAPill({
  children,
  href,
  onClick,
  variant = "graphite",
  size = "md",
  arrow = true,
  disabled = false,
  className,
  style,
  ariaLabel,
}: Props) {
  const sizeStyle = SIZE_MAP[size];
  const variantStyle = VARIANT_STYLES[variant];

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: sizeStyle.gap,
    padding: `${sizeStyle.padY} ${sizeStyle.padX}`,
    borderRadius: "var(--v16-radius-pill)",
    fontFamily: "var(--v16-font-body), system-ui, sans-serif",
    fontSize: sizeStyle.font,
    fontWeight: 500,
    lineHeight: 1,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition:
      "transform var(--v16-dur-micro) var(--v16-ease-out), " +
      "box-shadow var(--v16-dur-micro) var(--v16-ease-out), " +
      "border-color var(--v16-dur-micro) var(--v16-ease-out)",
    willChange: "transform",
    ...variantStyle,
    ...style,
  };

  const content = (
    <>
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
      {arrow && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transition: "transform var(--v16-dur-micro) var(--v16-ease-out)",
            fontSize: "1.1em",
            lineHeight: 1,
          }}
          className="v16-cta-arrow"
        >
          →
        </span>
      )}
      <style jsx>{`
        :global(.v16-cta-pill:hover) {
          transform: translateY(-1px);
        }
        :global(.v16-cta-pill:hover .v16-cta-arrow) {
          transform: translateX(4px);
        }
      `}</style>
    </>
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        className={`v16-cta-pill ${className ?? ""}`}
        style={baseStyle}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`v16-cta-pill ${className ?? ""}`}
      style={baseStyle}
    >
      {content}
    </button>
  );
}
