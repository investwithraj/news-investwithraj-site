"use client";

// Aurora background — slowly-shifting WebGL noise field in brand colors.
// Used behind hero. Fully accessibility-aware: pauses on
// prefers-reduced-motion, hidden on prefers-contrast: more.
//
// Implementation: HTML5 canvas + 2D simplex-style gradient blending. We
// avoid a true GLSL shader to keep the bundle small (~3 KB minified).
// Visual fidelity is "high enough" for a brand-warm background — true
// shader aurora would be ~80 KB with shader-park.

import { useEffect, useRef } from "react";

/** A single aurora color stop (0–255 RGB + 0–1 alpha). */
export interface AuroraStop {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Props {
  /** Animation speed multiplier */
  speed?: number;
  /** Opacity 0..1 */
  opacity?: number;
  /** className passthrough */
  className?: string;
  style?: React.CSSProperties;
  /** Override the 4 color stops — e.g. the v17 dark register passes a cobalt
   *  set so the aurora reads as a cobalt glow on the true-black world instead
   *  of the live site's warm gold/cream. Defaults to the brand brass+cream. */
  stops?: AuroraStop[];
}

/** v17 dark-cinematic cobalt aurora stops (cobalt glow on the true-black void). */
export const AURORA_COBALT_STOPS: AuroraStop[] = [
  { r: 37, g: 99, b: 235, a: 0.30 },   // cobalt
  { r: 91, g: 165, b: 245, a: 0.20 },  // bright cobalt
  { r: 30, g: 58, b: 138, a: 0.26 },   // deep cobalt
  { r: 5, g: 7, b: 13, a: 0.10 },      // void wash
];

export function AuroraBackground({
  speed = 1,
  opacity = 0.55,
  className = "",
  style,
  stops: stopsProp,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Skip animation if user prefers reduced motion — show static gradient
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      if (ctx) ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    // Color stops in brand palette (gold + navy + warm cream) — overridable
    // via the `stops` prop (the v17 dark register passes a cobalt set).
    const stops: AuroraStop[] =
      stopsProp && stopsProp.length >= 4
        ? stopsProp
        : [
            { r: 201, g: 169, b: 97, a: 0.32 },   // brand gold
            { r: 224, g: 192, b: 118, a: 0.22 },  // bright gold
            { r: 249, g: 246, b: 240, a: 0.45 },  // paper-warm
            { r: 10, g: 16, b: 36, a: 0.10 },     // ink wash
          ];

    let t = 0;
    let rafId = 0;

    function blob(
      x: number,
      y: number,
      r: number,
      color: { r: number; g: number; b: number; a: number }
    ) {
      if (!ctx) return;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
      grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    function draw() {
      if (!ctx) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";
      const base = reducedMotion ? 0 : t * 0.0005 * speed;

      // Four blobs slowly orbiting in offset patterns
      blob(
        width * (0.5 + Math.sin(base * 1.3) * 0.35),
        height * (0.4 + Math.cos(base * 1.7) * 0.25),
        Math.max(width, height) * 0.55,
        stops[0]
      );
      blob(
        width * (0.5 + Math.cos(base * 1.5) * 0.4),
        height * (0.5 + Math.sin(base * 0.9) * 0.3),
        Math.max(width, height) * 0.45,
        stops[1]
      );
      blob(
        width * (0.5 + Math.sin(base * 0.7) * 0.5),
        height * (0.6 + Math.cos(base * 1.2) * 0.35),
        Math.max(width, height) * 0.6,
        stops[2]
      );
      blob(
        width * (0.5 + Math.cos(base * 2.1) * 0.45),
        height * (0.5 + Math.sin(base * 1.6) * 0.3),
        Math.max(width, height) * 0.35,
        stops[3]
      );

      if (!reducedMotion) {
        t += 1;
        rafId = requestAnimationFrame(draw);
      }
    }
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [speed, stopsProp]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`aurora-bg ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
        filter: "blur(28px)",
        ...style,
      }}
    />
  );
}
