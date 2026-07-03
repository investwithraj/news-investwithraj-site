/**
 * lib/motion/v21.ts — the IWR brand motion kernel, unified with the main
 * site's lib/motion/v18.ts (V21 best-of-five revamp, W3). Same eases, same
 * scrub, same hooks — one motion language across investwithraj.com and
 * news.investwithraj.com.
 *
 * Single source of GSAP setup for every v21 component:
 *   - registerGsap()        idempotent plugin + CustomEase registration (client-only)
 *   - EASES                 the four named house eases (use as `ease: EASES.outQuint`)
 *   - SCRUB                 the linted scroll-scrub default (0.4 — the luxury lag)
 *   - useSectionReveal()    SplitText line-cascade reveal (once, never reverse-hides)
 *   - useCountUp()          once-on-enter counter, no scrub ("data lands, doesn't smear")
 *   - prefersReducedMotion()
 *
 * SSR-safe: no window/document access at module scope; all DOM work runs
 * inside effects behind guards. Text is server-rendered and only ever
 * animated via transforms — never injected client-side.
 */

import { useEffect } from "react";
import type { RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { CustomEase } from "gsap/CustomEase";

/* ── Eases ──────────────────────────────────────────────────────────── */

/** Named CustomEase ids — registered once by registerGsap(). */
export const EASES = {
  /** cubic-bezier(.22,1,.36,1) — house default: reveals, masks, The Path */
  outQuint: "iwr-out-quint",
  /** cubic-bezier(.16,1,.3,1) — hovers, buttons */
  outExpo: "iwr-out-expo",
  /** cubic-bezier(.83,0,.17,1) — state swaps, register flips */
  inOutQuint: "iwr-inout-quint",
  /** cubic-bezier(.23,1,.32,1) — drag grab/release */
  drag: "iwr-drag",
} as const;

/** The linted default for every scroll-tied transform (contract §4). */
export const SCRUB = 0.4;

/* ── Registration ───────────────────────────────────────────────────── */

let easesRegistered = false;

/**
 * Registers ScrollTrigger / SplitText / Flip / CustomEase and creates the
 * four house CustomEases. Idempotent and client-only — safe to call from
 * every component effect.
 */
export function registerGsap(): void {
  if (typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip, CustomEase);
  if (easesRegistered) return;
  if (!CustomEase.get(EASES.outQuint)) {
    CustomEase.create(EASES.outQuint, "0.22,1,0.36,1");
  }
  if (!CustomEase.get(EASES.outExpo)) {
    CustomEase.create(EASES.outExpo, "0.16,1,0.3,1");
  }
  if (!CustomEase.get(EASES.inOutQuint)) {
    CustomEase.create(EASES.inOutQuint, "0.83,0,0.17,1");
  }
  if (!CustomEase.get(EASES.drag)) {
    CustomEase.create(EASES.drag, "0.23,1,0.32,1");
  }
  easesRegistered = true;
}

/* ── Utilities ──────────────────────────────────────────────────────── */

/** True when the visitor asks for reduced motion. False on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── useSectionReveal ───────────────────────────────────────────────── */

export interface SectionRevealOptions {
  /**
   * Selector for reveal targets inside the ref element.
   * Default "[data-reveal]". Pass null to reveal the ref element itself.
   */
  selector?: string | null;
  /** Extra delay (s) before the cascade starts. Default 0. */
  delay?: number;
  /** Per-line stagger (s). Default .08 (contract §4). */
  stagger?: number;
  /** ScrollTrigger start. Default "top 80%" (contract §4). */
  start?: string;
  /** Per-line duration (s). Default 1.0 (contract §4). */
  duration?: number;
}

/**
 * SplitText line cascade: lines rise y 100% → 0 inside clip masks, dur 1.0,
 * stagger .08, ease iwr-out-quint, ONCE on enter at "top 80%".
 *
 * Reveal-safe by design: content is fully visible at SSR; lines are only
 * hidden by JS immediately before their tween is armed, the tween fires
 * once and never reverses, splits revert on unmount, and the whole hook
 * no-ops under prefers-reduced-motion.
 */
export function useSectionReveal(
  ref: RefObject<HTMLElement | null>,
  options: SectionRevealOptions = {},
): void {
  const {
    selector = "[data-reveal]",
    delay = 0,
    stagger = 0.08,
    start = "top 80%",
    duration = 1.0,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    registerGsap();

    let cancelled = false;
    const splits: SplitText[] = [];
    const tweens: gsap.core.Tween[] = [];

    const build = () => {
      if (cancelled || !el.isConnected) return;

      const targets: HTMLElement[] = selector
        ? Array.from(el.querySelectorAll<HTMLElement>(selector))
        : [el];
      if (targets.length === 0) return;

      targets.forEach((target) => {
        const split = new SplitText(target, {
          type: "lines",
          mask: "lines",
          linesClass: "v18-split-line",
        } as SplitText.Vars);
        splits.push(split);
        if (split.lines.length === 0) return;

        gsap.set(split.lines, { yPercent: 100 });
        tweens.push(
          gsap.to(split.lines, {
            yPercent: 0,
            duration,
            stagger,
            delay,
            ease: EASES.outQuint,
            immediateRender: false,
            scrollTrigger: {
              trigger: target,
              start,
              once: true,
            },
          }),
        );
      });

      /* New masks change layout — keep every other trigger honest. */
      ScrollTrigger.refresh();
    };

    /* Split only after fonts settle so line boundaries are final. */
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(
        () => build(),
        () => build(),
      );
    } else {
      build();
    }

    return () => {
      cancelled = true;
      tweens.forEach((tween) => {
        tween.scrollTrigger?.kill();
        tween.kill();
      });
      splits.forEach((split) => split.revert());
    };
  }, [ref, selector, delay, stagger, start, duration]);
}

/* ── useCountUp ─────────────────────────────────────────────────────── */

export interface CountUpOptions {
  /** Count duration (s). Default 1.2. */
  duration?: number;
  /** ScrollTrigger start. Default "top 85%". */
  start?: string;
  /** Fraction digits when using the default formatter. Default 0. */
  decimals?: number;
  /**
   * Custom formatter for each frame (e.g. n => `AED ${n.toFixed(1)}M`).
   * Without it, the element's ORIGINAL server-rendered text is restored
   * on complete, so prefixes/suffixes in the SSR string survive intact.
   */
  format?: (value: number) => string;
}

/**
 * Once-on-enter count-up — NO scrub (contract §4: data lands, doesn't
 * smear). The element must be server-rendered with its final text; the
 * hook counts 0 → value when the element enters, exactly once, then
 * restores/settles the final string. No-ops under reduced motion (the
 * SSR value simply stays visible).
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  value: number,
  options: CountUpOptions = {},
): void {
  const { duration = 1.2, start = "top 85%", decimals = 0, format } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value) || prefersReducedMotion()) return;
    registerGsap();

    const original = el.textContent ?? "";
    const fmt =
      format ??
      ((v: number) =>
        v.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }));
    const proxy = { v: 0 };

    const tween = gsap.to(proxy, {
      v: value,
      duration,
      ease: EASES.outQuint,
      immediateRender: false,
      scrollTrigger: {
        trigger: el,
        start,
        once: true,
      },
      onStart: () => {
        el.textContent = fmt(0);
      },
      onUpdate: () => {
        el.textContent = fmt(proxy.v);
      },
      onComplete: () => {
        el.textContent = format ? fmt(value) : original;
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.textContent = original;
    };
  }, [ref, value, duration, start, decimals, format]);
}
