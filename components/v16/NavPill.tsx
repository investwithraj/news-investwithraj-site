"use client";

import { CSSProperties, useEffect, useState } from "react";
import CTAPill from "./CTAPill";

/**
 * v16 NavPill — sticky pill-shaped top navigation.
 *
 * Reference: Brandly + draftly.space top nav. Floating pill that condenses
 * after scroll, with brand mark left, nav links centered, CTA + theme
 * toggle right. Pure white background with chrome hairline.
 *
 * Scroll behavior: starts full-width, shrinks to a pill on scroll
 * (translateY + max-width transition). Reduced motion: no shrink.
 *
 * Props are deliberately minimal — for v16 the nav structure is locked
 * across the site: brand mark + 4-6 links + 1 CTA + theme toggle.
 */

interface NavItem {
  label: string;
  href: string;
  isActive?: boolean;
}

interface Props {
  brandMark?: string;      // "RT" by default (italic Fraunces monogram)
  brandText?: string;       // "INVEST WITH RAJ" by default
  items?: NavItem[];
  ctaLabel?: string;
  ctaHref?: string;
  showThemeToggle?: boolean;
  variant?: "light" | "dark";
}

const DEFAULT_ITEMS: NavItem[] = [
  { label: "Operator",  href: "/operator" },
  { label: "Practice",  href: "/practice" },
  { label: "Notes",     href: "/notes" },
  { label: "Media",     href: "/media" },
  { label: "Engage",    href: "/engage" },
];

export default function NavPill({
  brandMark = "RT",
  brandText = "INVEST WITH RAJ",
  items = DEFAULT_ITEMS,
  ctaLabel = "Request note",
  ctaHref = "/engage",
  showThemeToggle = true,
  variant = "light",
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("iwr-v16-theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("iwr-v16-theme", next);
  }

  const containerStyle: CSSProperties = {
    position: "fixed",
    top: scrolled ? "16px" : "24px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 500,
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: scrolled ? "6px 10px 6px 16px" : "8px 12px 8px 20px",
    background:
      variant === "dark"
        ? "rgba(20, 24, 31, 0.85)"
        : "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    border: `1px solid ${variant === "dark" ? "var(--v16-ink-card-border)" : "var(--v16-chrome)"}`,
    borderRadius: "var(--v16-radius-pill)",
    boxShadow: scrolled
      ? "0 8px 32px -8px rgba(10, 14, 20, 0.12)"
      : "0 4px 16px -4px rgba(10, 14, 20, 0.06)",
    transition:
      "top var(--v16-dur-reveal) var(--v16-ease-out), " +
      "padding var(--v16-dur-reveal) var(--v16-ease-out), " +
      "box-shadow var(--v16-dur-reveal) var(--v16-ease-out)",
    fontFamily: "var(--v16-font-body), system-ui, sans-serif",
    color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)",
    maxWidth: "calc(100vw - 32px)",
  };

  const linkStyle: CSSProperties = {
    color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
    padding: "8px 12px",
    borderRadius: "var(--v16-radius-pill)",
    transition: "background var(--v16-dur-micro) var(--v16-ease-out), color var(--v16-dur-micro) var(--v16-ease-out)",
  };

  return (
    <nav style={containerStyle} aria-label="Primary navigation">
      {/* Brand mark */}
      <a
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "inherit",
        }}
        aria-label="Invest With Raj — home"
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: "var(--v16-brass)",
            color: "var(--v16-paper-pure)",
            fontFamily: "var(--v16-font-display), serif",
            fontVariationSettings: '"SOFT" 50, "opsz" 144, "WONK" 1',
            fontStyle: "italic",
            fontSize: "0.95rem",
            fontWeight: 500,
            letterSpacing: "-0.05em",
          }}
        >
          {brandMark}
        </span>
        <span
          className="v16-brand-text"
          style={{
            fontFamily: "var(--v16-font-mono), monospace",
            fontSize: "0.6875rem",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {brandText}
        </span>
      </a>

      {/* Center nav */}
      <ul
        className="v16-nav-links"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          margin: 0,
          padding: 0,
          listStyle: "none",
        }}
      >
        {items.map((item) => (
          <li key={item.href} style={{ margin: 0, padding: 0 }}>
            <a
              href={item.href}
              style={{
                ...linkStyle,
                background: item.isActive
                  ? variant === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(10, 14, 20, 0.06)"
                  : "transparent",
              }}
              className="v16-nav-link"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Right: theme toggle + CTA */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {showThemeToggle && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            style={{
              width: "32px",
              height: "32px",
              padding: 0,
              borderRadius: "var(--v16-radius-pill)",
              border: "1px solid var(--v16-chrome-deep)",
              background: variant === "dark" ? "var(--v16-ink-card)" : "var(--v16-paper-pure)",
              color: variant === "dark" ? "var(--v16-paper)" : "var(--v16-ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.875rem",
              transition: "background var(--v16-dur-micro) var(--v16-ease-out)",
            }}
          >
            {theme === "light" ? "○" : "●"}
          </button>
        )}
        <CTAPill href={ctaHref} variant="graphite" size="sm" arrow>
          {ctaLabel}
        </CTAPill>
      </div>

      <style jsx>{`
        .v16-nav-link:hover {
          background: ${variant === "dark" ? "rgba(255,255,255,0.06)" : "rgba(10, 14, 20, 0.06)"} !important;
        }
        @media (max-width: 900px) {
          .v16-nav-links {
            display: none !important;
          }
          .v16-brand-text {
            display: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
