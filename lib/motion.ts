"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Hook: text reveal — split into lines, lines rise from below + fade in. */
export function useTextReveal<T extends HTMLElement = HTMLElement>(
  options: { delay?: number; stagger?: number; selector?: string } = {}
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const el = ref.current;
    const targets = options.selector
      ? el.querySelectorAll<HTMLElement>(options.selector)
      : [el];

    targets.forEach((t) => {
      gsap.set(t, { y: 32, opacity: 0 });
    });

    const ctx = gsap.context(() => {
      gsap.to(targets, {
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: "expo.out",
        stagger: options.stagger ?? 0.08,
        delay: options.delay ?? 0,
      });
    }, el);

    return () => ctx.revert();
  }, [options.delay, options.stagger, options.selector]);

  return ref;
}

/** Hook: animated number counter — counts from 0 to target on viewport enter. */
export function useCountUp(target: number, formatter?: (n: number) => string) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      el.textContent = formatter ? formatter(target) : String(target);
      return;
    }

    const counter = { value: 0 };
    el.textContent = formatter ? formatter(0) : "0";

    const ctx = gsap.context(() => {
      gsap.to(counter, {
        value: target,
        duration: 2.2,
        ease: "expo.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
        onUpdate: () => {
          el.textContent = formatter
            ? formatter(counter.value)
            : String(Math.round(counter.value));
        },
      });
    }, el);

    return () => ctx.revert();
  }, [target, formatter]);

  return ref;
}

/** Hook: draws a horizontal gold rule in from the left on viewport enter. */
export function useRuleDraw<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const el = ref.current;
    gsap.set(el, { transformOrigin: "left center", scaleX: 0 });

    const ctx = gsap.context(() => {
      gsap.to(el, {
        scaleX: 1,
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          toggleActions: "play none none none",
        },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return ref;
}

/** Hook: subtle parallax — element translates up as you scroll past. */
export function useParallax<T extends HTMLElement = HTMLElement>(
  intensity = 0.15
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const el = ref.current;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: -intensity * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [intensity]);

  return ref;
}

/** Hook: magnetic effect — element subtly pulls toward cursor on hover. */
export function useMagnetic<T extends HTMLElement = HTMLElement>(
  strength = 0.25
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const el = ref.current;
    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = (e.clientX - cx) * strength;
      targetY = (e.clientY - cy) * strength;
    }
    function onLeave() {
      targetX = 0;
      targetY = 0;
    }

    function loop() {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      el!.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}

/**
 * Vision-Pro-style spatial parallax — apply to a container of cards.
 * Each child with [data-spatial-card] tilts/shifts slightly based on cursor
 * position. Subtle, premium, "depth-aware" feel.
 */
export function useSpatialCards<T extends HTMLElement = HTMLElement>(
  intensity = 8
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = ref.current;
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-spatial-card]")
    );
    if (cards.length === 0) return;

    let mouseX = 0;
    let mouseY = 0;
    let rafId = 0;
    const targets = cards.map(() => ({ x: 0, y: 0, rx: 0, ry: 0 }));
    const currents = cards.map(() => ({ x: 0, y: 0, rx: 0, ry: 0 }));

    function onMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      cards.forEach((_, i) => {
        // each card shifts based on cursor position, scaled by index for parallax
        const depthFactor = 0.6 + (i % 3) * 0.3; // varied parallax intensity
        targets[i].x = mouseX * intensity * depthFactor;
        targets[i].y = mouseY * (intensity * 0.5) * depthFactor;
        targets[i].rx = -mouseY * 1.2; // tilt X
        targets[i].ry = mouseX * 1.8; // tilt Y
      });
    }

    function onLeave() {
      targets.forEach((t) => {
        t.x = 0;
        t.y = 0;
        t.rx = 0;
        t.ry = 0;
      });
    }

    function loop() {
      cards.forEach((card, i) => {
        const t = targets[i];
        const c = currents[i];
        c.x += (t.x - c.x) * 0.08;
        c.y += (t.y - c.y) * 0.08;
        c.rx += (t.rx - c.rx) * 0.08;
        c.ry += (t.ry - c.ry) * 0.08;
        card.style.transform = `perspective(1200px) translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
      });
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      cards.forEach((card) => {
        card.style.transform = "";
      });
    };
  }, [intensity]);

  return ref;
}

/** Scroll progress bar driver — exposes 0→1 progress in CSS var --scroll-progress. */
export function useScrollProgress() {
  useEffect(() => {
    let rafId = 0;
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max <= 0 ? 0 : window.scrollY / max;
      document.documentElement.style.setProperty(
        "--scroll-progress",
        String(p)
      );
      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
