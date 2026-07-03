"use client";

/**
 * SectionWipe — the B&C "page-change" WIPE, ported from the main site
 * (components/v20/system/SectionWipe.tsx) for the V21 brand-motion
 * unification. A dark panel covers the wrapped section, then WIPES off
 * (left → right, with a gold leading edge) to reveal it as you scroll in.
 *
 * News-repo adaptation (identity preserved, palette localized):
 *   - motion kernel import → @/lib/motion/v21 (same eases / SCRUB)
 *   - cover panel gradient → the Terminal navy (--navy / --navy-rich)
 *     instead of the main site's cobalt; leading edge → brand gold
 *   - CSS de-scoped from the main site's .v19 root (news pages have no
 *     .v19 wrapper) — scoped by the component's own .v21-sw-* classes
 *
 * Motion-engine rules kept intact: ONE scrubbed ScrollTrigger, transform
 * only (xPercent), immediateRender:false (rest = the panel covering, before
 * the section enters), gsap.matchMedia desktop-gate that auto-reverts, and
 * a CSS flatten so mobile / reduced-motion show the section with no cover.
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerGsap, SCRUB } from "@/lib/motion/v21";

const CSS = `
.v21-sw-wrap { position: relative; }
.v21-sw-cover {
  position: absolute; inset: 0; z-index: 6; pointer-events: none;
  will-change: transform; transform: translateZ(0);
  background: linear-gradient(105deg, var(--navy-deep, #050817) 0%, var(--navy-rich, #141A2C) 50%, var(--navy-deep, #050817) 100%);
  border-left: 3px solid var(--gold, #C9A961);
}
@media (max-width: 767px), (prefers-reduced-motion: reduce) {
  .v21-sw-cover { display: none; }
}
`;

export default function SectionWipe({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerGsap();
    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const cover = el.querySelector<HTMLElement>(".v21-sw-cover");
      if (!cover) return;
      gsap.fromTo(
        cover,
        { xPercent: 0 },
        {
          xPercent: 102,
          ease: "none",
          immediateRender: false,
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            end: "top 36%",
            scrub: SCRUB,
            invalidateOnRefresh: true,
          },
        },
      );
      ScrollTrigger.refresh();
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={ref} className="v21-sw-wrap">
      <style>{CSS}</style>
      {children}
      <div className="v21-sw-cover" aria-hidden="true" />
    </div>
  );
}
