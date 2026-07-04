"use client";

/**
 * CountUp — a tiny client wrapper around the v21 kernel's useCountUp for
 * server-rendered stat numerals. The child text IS the SSR final value
 * (SEO/a11y/no-JS safe); the hook counts 0 → value once on enter, then
 * settles the exact formatted string. Reduced-motion → the SSR value simply
 * stays visible (kernel no-ops).
 *
 * Restraint cut-line: counters are allowed ONLY on the /pulse,
 * /closing-bell and /power-list mastheads/stats — never in ticker/feed
 * rows, and NEVER on numbers the page doesn't already render.
 */

import { useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useCountUp } from "@/lib/motion/v21";

interface CountUpProps {
  /** The numeric value the page already renders (no invented numbers). */
  value: number;
  /** Fraction digits. Default 0. */
  decimals?: number;
  /** Prepend "+" for non-negative values (sentiment-score style). */
  plus?: boolean;
  className?: string;
  style?: CSSProperties;
  /** The server-rendered final text — must match the settled format. */
  children: ReactNode;
}

export default function CountUp({
  value,
  decimals = 0,
  plus = false,
  className,
  style,
  children,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  const format = useMemo(
    () => (v: number) => {
      const s = v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return plus && v >= 0 ? `+${s}` : s;
    },
    [decimals, plus],
  );

  useCountUp(ref, value, { decimals, format });

  return (
    <span ref={ref} className={className} style={style}>
      {children}
    </span>
  );
}
