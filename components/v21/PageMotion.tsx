"use client";

/**
 * PageMotion — drop-in B&C motion for the inner (mostly server-rendered)
 * pages, ported from the main site (components/v20/system/PageMotion.tsx)
 * for the V21 brand-motion unification; kernel import rewired to
 * @/lib/motion/v21. Mount it ONCE near the top of a page, then tag elements:
 *   • `data-split`  → headline gets the masked SplitText line-cascade (the
 *                     B&C "text rises out of a cut" reveal).
 *   • `data-reveal` → section / card fades + rises in via ScrollTrigger.batch.
 *
 * News restraint cut-lines: never tag ticker/feed rows or article BODY
 * content — heads and card grids only, and only one grid stagger per page.
 *
 * Keeps server pages as server components (this is a tiny client island, no
 * props). Discipline (gsap-mastery.md): desktop + no-reduced-motion only via
 * gsap.matchMedia (auto-reverts), transform/opacity only, fromTo +
 * immediateRender:false so SSR content is never parked hidden, SplitText
 * reverted on cleanup. Reduced-motion / <768px = no-op → the static SSR page.
 */

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { registerGsap, prefersReducedMotion, EASES } from "@/lib/motion/v21";

export default function PageMotion() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    registerGsap();

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const splits: SplitText[] = [];

      // headline masked line-cascade on [data-split] (gated on fonts so the line
      // boxes are final before splitting)
      const buildSplits = () => {
        gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
          const split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "v18-split-line" } as SplitText.Vars);
          splits.push(split);
          if (!split.lines.length) return;
          gsap.set(split.lines, { yPercent: 110 });
          gsap.to(split.lines, {
            yPercent: 0,
            duration: 1.0,
            stagger: 0.08,
            ease: EASES.outQuint,
            immediateRender: false,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });
      };
      if (typeof document !== "undefined" && document.fonts?.ready) document.fonts.ready.then(buildSplits, buildSplits);
      else buildSplits();

      // section / card batch reveal on [data-reveal]
      const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      if (reveals.length) {
        ScrollTrigger.batch(reveals, {
          start: "top 86%",
          once: true,
          onEnter: (batch) =>
            gsap.fromTo(
              batch,
              { autoAlpha: 0, y: 28 },
              { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: EASES.outQuint, immediateRender: false, clearProps: "transform,opacity,visibility" },
            ),
        });
      }

      ScrollTrigger.refresh();
      return () => { splits.forEach((s) => s.revert()); };
    });

    return () => mm.revert();
  }, []);

  return null;
}
