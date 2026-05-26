"use client";

import { useEffect } from "react";
import { initAudio, playSound } from "@/lib/audio";

/**
 * v13 SOTY — UI sound dispatcher.
 *
 * Wires global delegated listeners that fire the appropriate sound:
 *   - Hover over [data-magnetic] or button:   cta-hover
 *   - Click on [data-magnetic] or button:     cta-click
 *   - Hover over [data-cursor-label]:         cursor-tick (debounced 1.2s)
 *   - "open-cmdk" CustomEvent:                cmdk-swell
 *   - Custom 'section-reveal' CustomEvent:    section-reveal whoosh
 *
 * All sounds gated by AmbientAudio toggle state (localStorage). No separate
 * sounds-toggle — the ambient pill is the master switch.
 *
 * Lives in the root layout. Touches no DOM beyond event listeners.
 */
export default function UISounds() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Lazy-init audio context on first user gesture
    function onFirstGesture() {
      initAudio();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    }
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });

    // Hover sound dispatch — delegated, debounced per element so quickly
    // moving across many CTAs doesn't fire 20 sounds
    let lastHoverEl: Element | null = null;
    let lastHoverTime = 0;
    function onPointerOver(e: PointerEvent) {
      const t = e.target as HTMLElement;
      const el = t.closest("[data-magnetic], button, a");
      if (!el) return;
      const now = performance.now();
      if (el === lastHoverEl && now - lastHoverTime < 400) return;
      lastHoverEl = el;
      lastHoverTime = now;
      playSound("cta-hover");
    }

    // Cursor tick — for [data-cursor-label] elements specifically
    let lastTickEl: Element | null = null;
    let lastTickTime = 0;
    function onCursorLabelEnter(e: PointerEvent) {
      const t = e.target as HTMLElement;
      const el = t.closest("[data-cursor-label]");
      if (!el) return;
      const now = performance.now();
      if (el === lastTickEl && now - lastTickTime < 1200) return;
      lastTickEl = el;
      lastTickTime = now;
      playSound("cursor-tick");
    }

    // Click sound dispatch
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      const el = t.closest("[data-magnetic], button, a");
      if (!el) return;
      playSound("cta-click");
    }

    // CustomEvents from other components
    function onOpenCmdk() {
      playSound("cmdk-swell");
    }
    function onSectionReveal() {
      playSound("section-reveal");
    }

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerover", onCursorLabelEnter, {
      passive: true,
    });
    document.addEventListener("click", onClick, { passive: true });
    document.addEventListener("open-cmdk", onOpenCmdk);
    document.addEventListener("iwr-section-reveal", onSectionReveal);

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerover", onCursorLabelEnter);
      document.removeEventListener("click", onClick);
      document.removeEventListener("open-cmdk", onOpenCmdk);
      document.removeEventListener("iwr-section-reveal", onSectionReveal);
    };
  }, []);

  return null;
}
