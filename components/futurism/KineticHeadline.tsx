"use client";

// Kinetic Fraunces variable-font headline.
// On scroll into view, the SOFT axis morphs from sharp (0) → soft (100)
// and letter-spacing tightens. Subtle but unmistakably 2026.
//
// Use sparingly — only on hero + section H1s. Don't apply to body type.

import { createElement, useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  initialSoft?: number;
  targetSoft?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Heading level to render. Defaults to h1. */
  as?: "h1" | "h2" | "h3" | "h4";
}

export function KineticHeadline({
  children,
  initialSoft = 0,
  targetSoft = 100,
  duration = 1400,
  className = "",
  style,
  as = "h1",
}: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimated(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setAnimated(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const softValue = animated ? targetSoft : initialSoft;

  return createElement(
    as,
    {
      ref,
      className: `kinetic-headline ${className}`,
      style: {
        ...style,
        fontFamily: "var(--font-fraunces), Georgia, serif",
        fontVariationSettings: `"SOFT" ${softValue}, "opsz" 144`,
        transition: `font-variation-settings ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), letter-spacing ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        letterSpacing: animated ? "-0.04em" : "-0.02em",
      },
    },
    children
  );
}
