"use client";

// Magnetic cursor — gold orb follows mouse with spring physics, snaps
// toward CTAs / links when within 80px (data-magnetic attribute).
//
// Desktop only (touch devices skip). Honors prefers-reduced-motion.
// Renders absolutely positioned, doesn't intercept clicks.

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Base orb radius in px */
  size?: number;
  /** Hover radius — when over magnetic target */
  hoverSize?: number;
  /** Magnetic snap radius in px */
  snapRadius?: number;
  /** Trail length (set 0 to disable) */
  trail?: number;
}

export function MagneticCursor({
  size = 12,
  hoverSize = 32,
  snapRadius = 80,
  trail = 0,
}: Props) {
  const orbRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Skip on touch + reduced-motion
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setMounted(true);

    const orb = orbRef.current;
    if (!orb) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let orbX = mouseX;
    let orbY = mouseY;
    let currentSize = size;
    let targetSize = size;
    let rafId = 0;

    function getMagneticTarget(x: number, y: number): {
      el: Element | null;
      cx: number;
      cy: number;
      dist: number;
    } {
      const candidates = document.querySelectorAll(
        '[data-magnetic], a, button, [role="button"], input[type="submit"]'
      );
      let best: { el: Element | null; cx: number; cy: number; dist: number } = {
        el: null,
        cx: x,
        cy: y,
        dist: Infinity,
      };
      candidates.forEach((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < snapRadius && dist < best.dist) {
          best = { el, cx, cy, dist };
        }
      });
      return best;
    }

    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const target = getMagneticTarget(mouseX, mouseY);
      if (target.el) {
        // Snap partial-way toward target center
        const pull = 0.35;
        mouseX = mouseX + (target.cx - mouseX) * pull;
        mouseY = mouseY + (target.cy - mouseY) * pull;
        targetSize = hoverSize;
      } else {
        targetSize = size;
      }
    }

    function tick() {
      // Spring toward mouse position
      orbX += (mouseX - orbX) * 0.22;
      orbY += (mouseY - orbY) * 0.22;
      currentSize += (targetSize - currentSize) * 0.18;
      if (orb) {
        orb.style.transform = `translate3d(${orbX - currentSize / 2}px, ${orbY - currentSize / 2}px, 0)`;
        orb.style.width = `${currentSize}px`;
        orb.style.height = `${currentSize}px`;
      }
      rafId = requestAnimationFrame(tick);
    }

    function onLeave() {
      if (orb) orb.style.opacity = "0";
    }
    function onEnter() {
      if (orb) orb.style.opacity = "1";
    }

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, [size, hoverSize, snapRadius]);

  if (!mounted) return null;

  return (
    <div
      ref={orbRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 30% 30%, rgba(224, 192, 118, 0.95), rgba(201, 169, 97, 0.55) 60%, transparent 100%)",
        boxShadow:
          "0 0 24px rgba(201, 169, 97, 0.45), 0 0 60px rgba(201, 169, 97, 0.18)",
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 1,
        transition: "opacity 240ms ease-out",
        mixBlendMode: "multiply",
        willChange: "transform, width, height",
      }}
    />
  );
}
