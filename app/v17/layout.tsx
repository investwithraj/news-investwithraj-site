/* ────────────────────────────────────────────────────────────────────────
   app/v17/layout.tsx — NEWS repo (Wave-A3)
   ─────────────────────────────────────────────────────────────────────
   v17-scoped layout that:
     • Hides the root <DldTicker/> top strip — the v17 immersive terminal
       has its own pulse / capital-flow surfaces, the cream Bloomberg-style
       ticker fights the dark-cinematic register.
     • Does NOT mount a smooth-scroll provider — the page is server-rendered
       and uses native scroll; if a Lenis instance is added later it should
       live on the page, not the layout (single-mount rule).
     • Adds a skip-link + <main id="main"> wrapper.
     • Mounts the corner-only <V17EdgeNav/>.
   The chrome override is a single scoped <style> block keyed off the
   `data-v17-route` attribute on <body>, set by the V17BodyFlag client
   component on mount and cleaned up on unmount.
   ──────────────────────────────────────────────────────────────────── */

import type { Metadata } from "next";
import V17EdgeNav from "@/components/v17/chrome/V17EdgeNav";
import V17BodyFlag from "@/components/v17/chrome/V17BodyFlag";

export const metadata: Metadata = {
  title: "v17 · Terminal — Invest With Raj News",
  description:
    "The immersive Dubai real-estate intelligence terminal — live DLD pulse, capital-flow globe, daily brief, and the five beats that move the market.",
  robots: { index: false, follow: false },
};

export default function V17NewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Sets data-v17-route on <body> so the override CSS below takes
          effect + cleans it up when navigating away. Client-only. */}
      <V17BodyFlag />

      {/* Skip-link — keyboard-first accessibility. Pure CSS :focus
          pattern so the layout stays a server component. */}
      <a href="#main" className="v17-skip-link">
        Skip to content
      </a>

      {/* Corner-only chrome */}
      <V17EdgeNav />

      {/* Children = the v17 page, which renders its own <main> wrapper.
          We tag the outer slot id="main" so the skip-link target works
          even before the page-level main hydrates. */}
      <div id="main">{children}</div>

      {/* Override root chrome that breaks on /v17. The root layout wraps
          everything in <FxProvider> + <DldTicker/>, so we just hide the
          ticker (the FX context can stay — harmless). */}
      <style>{`
        body[data-v17-route="true"] .dld-ticker,
        body[data-v17-route="true"] [data-iwr-page-load-curtain],
        body[data-v17-route="true"] [data-iwr-ambient-audio] {
          display: none !important;
        }
        /* True-black background so route transitions don't flash cream. */
        body[data-v17-route="true"] {
          background: #05070d !important;
        }
        /* Skip-link — off-screen until focused (pure CSS). */
        .v17-skip-link {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 100;
          padding: 10px 16px;
          background: #05070d;
          color: #EAF0FA;
          border: 1px solid #2563EB;
          border-radius: 6px;
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transform: translateY(-200%);
          transition: transform 160ms ease;
        }
        .v17-skip-link:focus,
        .v17-skip-link:focus-visible {
          transform: translateY(0);
          outline: 2px solid #5BA5F5;
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
