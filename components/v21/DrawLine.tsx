"use client";

/**
 * DrawLine — a hairline rule that DRAWS ON (left → right) as it scrolls into
 * view, via the GSAP DrawSVGPlugin. Ported from the main site
 * (components/v20/system/DrawLine.tsx) for the V21 brand-motion unification;
 * kernel import rewired to @/lib/motion/v21.
 *
 * News restraint cut-line: use ONLY on the /pulse, /closing-bell and
 * /power-list mastheads/stats — never inside ticker/feed rows.
 *
 * Discipline (gsap-mastery.md): DrawSVGPlugin on a viewBox'd <line> (reliable
 * length math), `immediateRender:false` + `once`, full reduced-motion bail
 * (the line renders fully drawn, no JS), clean kill on unmount. Pass `start`
 * later than "top 36%" when placed inside a SectionWipe so it isn't drawn
 * behind the cover.
 */

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { registerGsap, prefersReducedMotion, EASES } from "@/lib/motion/v21";

interface DrawLineProps {
  className?: string;
  style?: CSSProperties;
  /** Stroke colour. Default the accent. */
  color?: string;
  /** Stroke thickness in px. Default 1. */
  weight?: number;
  /** Draw duration (s). Default 1.1. */
  duration?: number;
  /** Extra delay (s). Default 0. */
  delay?: number;
  /** ScrollTrigger start. Default "top 85%" (use "top 46%" inside a SectionWipe). */
  start?: string;
}

export default function DrawLine({
  className,
  style,
  color = "var(--accent-text, #5E7BFF)",
  weight = 1,
  duration = 1.1,
  delay = 0,
  start = "top 85%",
}: DrawLineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || prefersReducedMotion()) return;
    registerGsap();
    gsap.registerPlugin(DrawSVGPlugin);
    const line = svg.querySelector("line");
    if (!line) return;
    const tween = gsap.fromTo(
      line,
      { drawSVG: "0%" },
      {
        drawSVG: "100%",
        duration,
        delay,
        ease: EASES.outQuint,
        immediateRender: false,
        scrollTrigger: { trigger: svg, start, once: true },
      },
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [duration, delay, start]);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox="0 0 1000 2"
      preserveAspectRatio="none"
      width="100%"
      height={weight}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <line x1="0" y1="1" x2="1000" y2="1" stroke={color} strokeWidth={weight} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
