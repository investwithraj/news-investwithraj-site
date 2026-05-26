"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * v13 SOTY — inter-route page transitions.
 * Lando Norris / Cartier pattern: when navigation occurs, a charcoal curtain
 * wipes down (700ms), the new page mounts beneath, then the curtain wipes
 * up (700ms). Total page-change: 1.4s.
 *
 * Uses pathname change as the trigger. The PageLoadCurtain handles the
 * initial first-paint moment (skipped here via sessionStorage flag).
 * This template handles all subsequent client-side navigation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"in" | "settled">("in");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("settled");
      return;
    }
    // On every pathname change: start at "in" (curtain at top, mid-wipe up),
    // then settle once the new page has had a beat to mount.
    setPhase("in");
    const t = setTimeout(() => setPhase("settled"), 740);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      {/* The curtain. Sits at top of screen pre-wipe. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9650] pointer-events-none"
        style={{
          background: "var(--ink)",
          transform: phase === "in" ? "translateY(-100%)" : "translateY(-100%)",
          transition: "transform 700ms var(--ease-curtain)",
        }}
      />
      {/* Content with a 320ms fade-in so the new page doesn't pop */}
      <div
        style={{
          opacity: phase === "settled" ? 1 : 0.92,
          transition: "opacity 320ms var(--ease-out)",
        }}
      >
        {children}
      </div>
    </>
  );
}
