"use client";

import { useEffect, useRef } from "react";

/**
 * v12 SOTM cursor — Cartier + Oryzo pattern.
 *
 * Three states, in order of escalation:
 *   1. Idle      — 7px gold dot, 32px outline ring lags behind at 0.18 lerp
 *   2. Hover     — ring expands to 56px (over a/button/input/textarea)
 *   3. Label     — ring expands to 96px filled-ink, shows a centered word
 *                  ("VIEW NOTE", "OPEN", "PLAY", "DRAG") read from a
 *                  [data-cursor-label="..."] attribute on the hovered element
 *
 * Magnetic pull is handled by the per-element useMagnetic hook in
 * lib/motion.ts — this component just paints the cursor.
 *
 * Hidden on touch devices. Mix-blend-mode on the dot stays "multiply" by
 * default and switches off inside [data-section="dark"] containers.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Skip on touch — finger doesn't need a custom cursor
    if (window.matchMedia("(hover: none)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!dot || !ring || !label) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot!.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    }

    function animateRing() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring!.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      requestAnimationFrame(animateRing);
    }
    const rafId = requestAnimationFrame(animateRing);

    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const labelEl = t.closest<HTMLElement>("[data-cursor-label]");
      const interactiveEl = t.closest(
        "a, button, input, textarea, [data-cursor='active'], [data-magnetic]"
      );

      if (labelEl) {
        const text = labelEl.getAttribute("data-cursor-label") || "";
        label!.textContent = text;
        ring!.classList.add("cursor-ring--label");
        ring!.classList.remove("cursor-ring--hover");
      } else if (interactiveEl) {
        ring!.classList.add("cursor-ring--hover");
        ring!.classList.remove("cursor-ring--label");
      }
    }

    function onOut(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const labelEl = t.closest<HTMLElement>("[data-cursor-label]");
      const interactiveEl = t.closest(
        "a, button, input, textarea, [data-cursor='active'], [data-magnetic]"
      );

      if (labelEl) {
        ring!.classList.remove("cursor-ring--label");
        label!.textContent = "";
      }
      if (interactiveEl) {
        ring!.classList.remove("cursor-ring--hover");
      }
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    document.body.classList.add("has-custom-cursor");

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true">
        <span ref={labelRef} className="cursor-ring__label" />
      </div>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
