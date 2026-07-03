"use client";

/**
 * GiantWordmark — the reusable GIANT BOTTOM WORDMARK, ported from the main
 * site (components/v20/system/GiantWordmark.tsx) for the V21 brand-motion
 * unification: the brand name set MASSIVE across the very bottom edge of a
 * band, exactly as the main-site footer signs off with "INVEST WITH RAJ".
 *
 * News-repo adaptation:
 *   - motion kernel import → @/lib/motion/v21 (same eases / SCRUB)
 *   - the .v21-giant-wordmark CSS ships inline here (the main site keeps it
 *     in globals.css) so the component is self-contained; typography maps to
 *     the news tokens (--font-display / --ink)
 *
 * Optional `trackingBreathe`: letter-spacing animates WIDE → TIGHT and the
 * line settles up as the band scrolls in (scrub 0.4 — the luxury lag). The
 * text is SERVER-RENDERED (SEO + a11y); JS only animates letter-spacing/
 * transform/opacity. prefers-reduced-motion + <768px → final state.
 *
 * Usage:
 *   <GiantWordmark text="INVEST WITH RAJ" trackingBreathe />
 *   <GiantWordmark text="IWR" align="center" />
 */

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerGsap, prefersReducedMotion, EASES, SCRUB } from "@/lib/motion/v21";

const CSS = `
.v21-giant-wordmark {
  display: block;
  font-family: var(--font-display, var(--font-body, sans-serif));
  font-weight: 800;
  text-transform: uppercase;
  line-height: 0.78;
  letter-spacing: -0.02em;
  font-size: var(--gw-size, clamp(3.5rem, 17vw, 17rem));
  color: var(--ink, #2B2621);
  white-space: nowrap;
  user-select: none;
}
.v21-giant-wordmark[data-align="center"] { text-align: center; }
.v21-giant-wordmark[data-align="right"] { text-align: right; }
@media (prefers-reduced-motion: reduce) {
  .v21-giant-wordmark { transition: none !important; animation: none !important; }
}
`;

export interface GiantWordmarkProps {
  /** The wordmark text. Rendered caps via CSS. */
  text: string;
  /** When true, letter-spacing breathes wide→tight + rises on scroll-in. */
  trackingBreathe?: boolean;
  /** Horizontal anchor of the line. Default "left". */
  align?: "left" | "center" | "right";
  /** CSS font-size value (clamp, px-MAXED). Default the band-filling clamp. */
  sizeClamp?: string;
  className?: string;
  style?: CSSProperties;
  /** Optional aria-hidden when the wordmark is purely decorative (a real
   *  heading/logo carries the accessible name elsewhere). Default false. */
  decorative?: boolean;
}

export default function GiantWordmark({
  text,
  trackingBreathe = false,
  align = "left",
  sizeClamp = "clamp(3.5rem,17vw,17rem)",
  className,
  style,
  decorative = false,
}: GiantWordmarkProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !trackingBreathe || prefersReducedMotion()) return;
    registerGsap();

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { letterSpacing: "0.22em", yPercent: 14, opacity: 0.55 },
        {
          letterSpacing: "-0.02em",
          yPercent: 0,
          opacity: 1,
          ease: EASES.outQuint,
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "top 95%",
            end: "bottom 70%",
            scrub: SCRUB,
          },
        },
      );
    }, el);

    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [trackingBreathe, text]);

  return (
    <>
      <style>{CSS}</style>
      <span
        ref={ref}
        className={`v21-giant-wordmark${className ? ` ${className}` : ""}`}
        data-align={align}
        aria-hidden={decorative || undefined}
        style={{ ["--gw-size" as string]: sizeClamp, ...style }}
      >
        {text}
      </span>
    </>
  );
}
