"use client";

/**
 * NavCurtain — the site-wide B&C "page change" transition, ported from the
 * main site (components/v20/system/NavCurtain.tsx) for the V21 brand-motion
 * unification. Same wipe grammar as investwithraj.com: a full-screen wordmark
 * panel WIPES DOWN to cover, the route commits via a client-side router.push,
 * then the panel WIPES UP to reveal.
 *
 * News-repo notes:
 *   • app/template.tsx keeps its (already-invisible) curtain div + a subtle
 *     320ms content fade; that fade settles UNDER this cover, so the two
 *     never visibly double-fire. PageLoadCurtain is first-paint only.
 *   • WAAPI only — no GSAP dependency; the v21 kernel is untouched.
 *
 * Safe by construction:
 *   • only same-origin in-app routes (starts with "/", not "//"); skips
 *     _blank / download / modifier-clicks / middle-click / hash-only / same
 *     path / /api / file assets.
 *   • prefers-reduced-motion → does nothing (native navigation proceeds).
 *   • a fallback timer force-reveals if the route never commits, so the panel
 *     can never get stuck covering the page.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const COVER_MS = 520;
const REVEAL_MS = 560;
const EASE = "cubic-bezier(.76,0,.24,1)";
const SKIP_RE = /\.(pdf|xml|png|jpe?g|webp|avif|gif|svg|zip|txt|json|ico|mp4|webm)$/i;

export default function NavCurtain() {
  const pathname = usePathname();
  const router = useRouter();
  const elRef = useRef<HTMLDivElement | null>(null);
  const covering = useRef(false);
  const fallback = useRef<number | null>(null);

  // Reveal (wipe up) once the new route has committed.
  useEffect(() => {
    if (!covering.current) return;
    covering.current = false;
    if (fallback.current) {
      clearTimeout(fallback.current);
      fallback.current = null;
    }
    const el = elRef.current;
    if (!el) return;
    // land the new page at the top, under the cover, before revealing
    try {
      const l = (window as unknown as { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis;
      if (l?.scrollTo) l.scrollTo(0, { immediate: true });
      else window.scrollTo(0, 0);
    } catch { /* noop */ }
    const word = el.querySelector<HTMLElement>(".rc-word");
    const a = el.animate(
      [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 100% 0)" }],
      { duration: REVEAL_MS, easing: EASE, fill: "forwards", delay: 90 },
    );
    word?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: "ease", fill: "forwards" });
    a.onfinish = () => {
      const cur = elRef.current;
      if (cur) {
        cur.style.display = "none";
        cur.style.clipPath = "";
      }
    };
  }, [pathname]);

  // Intercept internal link clicks → cover → client push.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function onClick(e: MouseEvent) {
      if (reduce || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return; // in-app only
      if (href.startsWith("/api") || SKIP_RE.test(href)) return;
      const path = href.split("#")[0];
      if (!path || path === pathname) return; // hash-only / same page → leave it
      e.preventDefault();
      const el = elRef.current;
      if (!el) {
        router.push(href);
        return;
      }
      el.style.display = "block";
      const word = el.querySelector<HTMLElement>(".rc-word");
      el.animate(
        [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        { duration: COVER_MS, easing: EASE, fill: "forwards" },
      );
      word?.animate(
        [
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: COVER_MS, easing: EASE, fill: "forwards" },
      );
      covering.current = true;
      window.setTimeout(() => router.push(href), COVER_MS - 40);
      // safety: if the route never commits, force-reveal
      fallback.current = window.setTimeout(() => {
        if (!covering.current) return;
        covering.current = false;
        const cur = elRef.current;
        if (cur) { cur.style.display = "none"; cur.style.clipPath = ""; }
      }, 4000);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

  return (
    <div ref={elRef} className="rc-curtain" aria-hidden="true">
      <span className="rc-word">
        Invest
        <br />
        With Raj
      </span>
      <style>{`
        .rc-curtain {
          position: fixed; inset: 0; z-index: 9999; display: none;
          pointer-events: none; background: #070810; will-change: clip-path;
          clip-path: inset(100% 0 0 0);
        }
        .rc-word {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center;
          padding: 0 6vw; color: #ECE7DF; opacity: 0;
          font-family: var(--font-space-grotesk), system-ui, sans-serif;
          font-weight: 700; text-transform: uppercase; letter-spacing: -0.03em;
          line-height: 0.92; font-size: clamp(2.4rem, 9vw, 8rem);
        }
        @media (prefers-reduced-motion: reduce) { .rc-curtain { display: none !important; } }
      `}</style>
    </div>
  );
}
