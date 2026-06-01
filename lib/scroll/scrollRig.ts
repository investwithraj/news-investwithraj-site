// v17 scroll-rig — the single source of truth for scroll-driven 3D (NEWS).
//
// A module singleton that R3F scenes read in their frame loop WITHOUT causing
// React re-renders. `progress` is 0..1 across the whole document, fed by one
// GSAP ScrollTrigger. `invalidate` is R3F's on-demand render trigger — wired by
// ImmersiveWorld so a `frameloop="demand"` canvas re-renders exactly when scroll
// moves (60fps while scrolling, 0 cost when idle). Ported from the MAIN repo so
// the NEWS /v17 terminal shares the same dark persistent-world rig.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface ScrollRig {
  /** 0..1 across the full document */
  progress: number;
  /** signed scroll velocity (px/s) — drives motion-blur / lean effects */
  velocity: number;
  /** R3F invalidate(), set by ImmersiveWorld; call to render one on-demand frame */
  invalidate: (() => void) | null;
}

export const scrollRig: ScrollRig = {
  progress: 0,
  velocity: 0,
  invalidate: null,
};

let trigger: ScrollTrigger | null = null;

/** Create the document-spanning ScrollTrigger that feeds `scrollRig`.
 *  Client-only; returns a cleanup fn. Safe to call once on mount. */
export function initScrollRig(): () => void {
  if (typeof window === "undefined") return () => {};
  trigger?.kill();
  trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      scrollRig.progress = self.progress;
      scrollRig.velocity = self.getVelocity();
      scrollRig.invalidate?.();
    },
  });
  // one paint on mount so the first frame is correct before any scroll
  scrollRig.invalidate?.();
  return () => {
    trigger?.kill();
    trigger = null;
  };
}
